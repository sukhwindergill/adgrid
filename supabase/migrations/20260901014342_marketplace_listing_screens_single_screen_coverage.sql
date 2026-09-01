-- Closes a cross-table overlap gap found in a go-live review:
--
-- marketplace_listings_no_overlap only ever sees a bundle's *primary*
-- screen_id (marketplace_listing_screens_no_overlap, added in
-- 20260831034702_marketplace_bundle_listings.sql, only covers screens that
-- went through the *bundle* creation path). A plain single-screen listing
-- never gets a row in marketplace_listing_screens. Result: a bundle's
-- non-primary member screen and a separate single-screen listing on that
-- same screen, over overlapping dates, are invisible to each other's
-- exclusion constraint -- both inserts succeed, and the screen ends up
-- "exclusively" committed to two different overlapping listings.
--
-- Fix: give every listing (single-screen or bundle) a row in
-- marketplace_listing_screens, so its no-overlap constraint becomes the one
-- comprehensive per-screen guard. marketplace_listings_no_overlap is left in
-- place as a harmless backstop on the primary screen_id.
--
-- This also fixes a second, related bug the naive version of this fix would
-- have hit: marketplace_listing_screens_no_overlap has no status filter, and
-- cancelListing() (src/lib/marketplace.js) only ever updates
-- marketplace_listings.status -- a cancelled bundle listing's junction rows
-- were never cleaned up, permanently blocking that screen/date-range from
-- ever being listed again. Adding a status column (kept in sync via
-- trigger) and filtering the exclusion constraint on it fixes cancellation
-- for bundles too, and is required before backfilling single-screen
-- listings into this table -- without it, cancelling a single-screen
-- listing would newly become permanently blocking as well.

ALTER TABLE marketplace_listing_screens
  ADD COLUMN status text NOT NULL DEFAULT 'active';

-- Backfill: existing bundle rows inherit their parent listing's current status.
UPDATE marketplace_listing_screens mls
SET status = ml.status
FROM marketplace_listings ml
WHERE ml.id = mls.listing_id;

-- Backfill: give every existing single-screen (non-bundle) listing a row
-- here too, carrying its real status and dates.
INSERT INTO marketplace_listing_screens (listing_id, screen_id, start_date, end_date, status)
SELECT id, screen_id, start_date, end_date, status
FROM marketplace_listings
WHERE NOT is_bundle
ON CONFLICT (listing_id, screen_id) DO NOTHING;

-- Replace the unconditional exclusion constraint with one scoped to
-- live/bookable statuses, matching marketplace_listings_no_overlap's own
-- WHERE clause -- a cancelled/expired listing must not block a new one.
ALTER TABLE marketplace_listing_screens
  DROP CONSTRAINT marketplace_listing_screens_no_overlap;

ALTER TABLE marketplace_listing_screens
  ADD CONSTRAINT marketplace_listing_screens_no_overlap
  EXCLUDE USING gist (
    screen_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  ) WHERE (status IN ('draft', 'active', 'booked'));

-- Keep a single-screen listing's junction row in sync with its parent going
-- forward (status changes -- cancel, booked, expired -- previously never
-- propagated at all).
CREATE OR REPLACE FUNCTION sync_marketplace_listing_screens_status()
RETURNS trigger AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE marketplace_listing_screens
    SET status = NEW.status
    WHERE listing_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_marketplace_listing_screens_status ON marketplace_listings;
CREATE TRIGGER trg_sync_marketplace_listing_screens_status
  AFTER UPDATE OF status ON marketplace_listings
  FOR EACH ROW
  EXECUTE FUNCTION sync_marketplace_listing_screens_status();

-- Auto-populate marketplace_listing_screens for new single-screen listings
-- going forward. Bundle listings are excluded (is_bundle = true) --
-- createBundleListing() in src/lib/marketplace.js already inserts every
-- member screen (including the primary) explicitly; this trigger firing too
-- would violate the UNIQUE(listing_id, screen_id) constraint on the primary.
CREATE OR REPLACE FUNCTION insert_single_screen_listing_screens_row()
RETURNS trigger AS $$
BEGIN
  IF NOT NEW.is_bundle THEN
    INSERT INTO marketplace_listing_screens (listing_id, screen_id, start_date, end_date, status)
    VALUES (NEW.id, NEW.screen_id, NEW.start_date, NEW.end_date, NEW.status)
    ON CONFLICT (listing_id, screen_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_insert_single_screen_listing_screens_row ON marketplace_listings;
CREATE TRIGGER trg_insert_single_screen_listing_screens_row
  AFTER INSERT ON marketplace_listings
  FOR EACH ROW
  EXECUTE FUNCTION insert_single_screen_listing_screens_row();
