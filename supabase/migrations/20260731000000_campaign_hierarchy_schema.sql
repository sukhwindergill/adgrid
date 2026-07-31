-- Campaign Hierarchy Phase 1 — parent Campaign tier.
--
-- `bookings` is today's flat "campaign" (targeting + budget + schedule +
-- creative all on one row) and keeps that exact shape — it becomes the
-- Targeting tier in place. This migration only adds a parent it can belong
-- to, plus a per-Targeting-group switch for whether budget subdivides across
-- its creatives. A prior `campaigns` table existed pre-pivot, had zero rows
-- and zero code references, and was dropped in
-- 20260703000003_drop_legacy_schema.sql — this is an unrelated, freshly
-- designed table that happens to reuse the name.

CREATE TABLE IF NOT EXISTS campaigns (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  advertiser_id uuid NOT NULL REFERENCES profiles(id),
  name          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES campaigns(id);

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS budget_level text
    CHECK (budget_level IN ('unified', 'per_creative'))
    DEFAULT 'unified';
  -- 'unified' (default): today's exact behavior, one budget number for the
  --   whole targeting group.
  -- 'per_creative': this targeting group's budget is tracked per
  --   campaign_creatives.budget instead (Phase 3 UI, not built in this phase).

-- Backfill: every existing bookings row gets its own auto-created campaigns
-- row, so no existing campaign is ever left with a null campaign_id.
--
-- A handful of pre-existing bookings rows already violate the NOT VALID
-- `bookings_paid_requires_destination` check (paid with no destination_url —
-- grandfathered in when that constraint was added without retroactive
-- validation). Any UPDATE touches the full row, so Postgres re-enforces the
-- check even though campaign_id is the only column changing here. Drop and
-- recreate the identical NOT VALID constraint around the backfill so it
-- comes back exactly as it was, unblocking this unrelated column update.
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_paid_requires_destination;

DO $$
DECLARE
  r RECORD;
  new_campaign_id uuid;
BEGIN
  FOR r IN SELECT id, advertiser_id, campaign_name, created_at FROM bookings WHERE campaign_id IS NULL LOOP
    INSERT INTO campaigns (advertiser_id, name, created_at)
    VALUES (r.advertiser_id, COALESCE(r.campaign_name, 'Untitled Campaign'), r.created_at)
    RETURNING id INTO new_campaign_id;

    UPDATE bookings SET campaign_id = new_campaign_id WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE bookings ADD CONSTRAINT bookings_paid_requires_destination
  CHECK ((payment_status IS DISTINCT FROM 'paid') OR (destination_url IS NOT NULL))
  NOT VALID;
