-- Marketplace: exclusive-placement listings. An op lists a screen as
-- exclusive for a fixed date window at a fixed price; advertisers book it
-- through marketplace_bookings (next migration). No auction, no partial
-- exclusivity — see 2026-08-21-marketplace-exclusivity-design.md.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS marketplace_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  screen_id uuid NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
  operator_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  price_cents integer NOT NULL CHECK (price_cents > 0),
  start_date date NOT NULL,
  end_date date NOT NULL CHECK (end_date > start_date),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','booked','expired','cancelled')),
  auto_renew boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Prevents two active/booked listings on the same screen from overlapping
-- in date range. Cancelled/expired listings are excluded from the guard
-- (a cancelled listing shouldn't block a new one over the same dates).
ALTER TABLE marketplace_listings
  ADD CONSTRAINT marketplace_listings_no_overlap
  EXCLUDE USING gist (
    screen_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  ) WHERE (status IN ('draft','active','booked'));

CREATE INDEX IF NOT EXISTS marketplace_listings_screen_idx ON marketplace_listings(screen_id);
CREATE INDEX IF NOT EXISTS marketplace_listings_operator_idx ON marketplace_listings(operator_id);
CREATE INDEX IF NOT EXISTS marketplace_listings_status_idx ON marketplace_listings(status) WHERE status = 'active';

ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "operator_manages_own_listings" ON marketplace_listings
    FOR ALL USING (operator_id = auth.uid()) WITH CHECK (operator_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated_reads_active_listings" ON marketplace_listings
    FOR SELECT USING (status = 'active');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
