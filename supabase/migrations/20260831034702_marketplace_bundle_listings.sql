-- Bundle listings: a single marketplace_listings row (one price, one date
-- range, one booking) covering multiple screens instead of one. Booking
-- itself is unchanged -- marketplace_confirm_booking only ever operates on
-- listing_id, never screen_id, so a bundle books exactly like a
-- single-screen listing today.
--
-- marketplace_listings.screen_id is kept as-is (the bundle's "primary"
-- screen, for backward-compat display) -- every screen in the bundle,
-- including the primary, gets a row in marketplace_listing_screens below.

ALTER TABLE marketplace_listings ADD COLUMN is_bundle boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS marketplace_listing_screens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  screen_id text NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
  -- Denormalized from the parent listing at insert time (immutable
  -- thereafter -- a listing's dates don't change after creation in this
  -- flow) so the no-overlap guard below doesn't need a join back to
  -- marketplace_listings, matching the pattern of the existing single-screen
  -- exclusion constraint.
  start_date date NOT NULL,
  end_date date NOT NULL CHECK (end_date > start_date),
  UNIQUE (listing_id, screen_id)
);

-- Same guard as marketplace_listings_no_overlap, but per screen-in-bundle:
-- no two active/booked listings (bundle or single) may cover the same
-- screen over overlapping dates. Only enforceable here for bundle member
-- rows; the primary screen_id on marketplace_listings itself is still
-- separately protected by the existing single-screen constraint.
ALTER TABLE marketplace_listing_screens
  ADD CONSTRAINT marketplace_listing_screens_no_overlap
  EXCLUDE USING gist (
    screen_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  );

CREATE INDEX IF NOT EXISTS marketplace_listing_screens_listing_idx ON marketplace_listing_screens(listing_id);
CREATE INDEX IF NOT EXISTS marketplace_listing_screens_screen_idx ON marketplace_listing_screens(screen_id);

ALTER TABLE marketplace_listing_screens ENABLE ROW LEVEL SECURITY;

-- Scoped TO authenticated explicitly, not left to default PUBLIC -- see
-- 20260830050250_scope_marketplace_reads_to_authenticated.sql for why that
-- matters (an unscoped policy on this table applies to anon too).
DO $$ BEGIN
  CREATE POLICY "operator_manages_own_listing_screens" ON marketplace_listing_screens
    FOR ALL TO authenticated USING (
      EXISTS (SELECT 1 FROM marketplace_listings l WHERE l.id = listing_id AND l.operator_id = auth.uid())
    ) WITH CHECK (
      EXISTS (SELECT 1 FROM marketplace_listings l WHERE l.id = listing_id AND l.operator_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated_reads_listing_screens" ON marketplace_listing_screens
    FOR SELECT TO authenticated USING (
      EXISTS (SELECT 1 FROM marketplace_listings l WHERE l.id = listing_id AND l.status = 'active')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
