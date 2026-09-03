-- Marketplace exclusivity Gap 1 (tracked in issue #81): nothing checked the
-- existing shared-rotation booking system (`bookings`) for conflicts when a
-- marketplace exclusive listing/booking was created, so an advertiser could
-- pay for an "exclusive" window on a screen still running normal rotation
-- ads. `bookings` already carries screen_id/start_date/end_date directly
-- (campaign_screens has no dates, so it isn't part of this check).

-- Single source of truth for "does this screen already have a live paid
-- booking overlapping this date range". rejected/completed bookings never
-- occupied the screen (or no longer do) so they're excluded; every other
-- status (pending_review/active/paused/scheduled) represents a paid,
-- inventory-claiming booking.
CREATE OR REPLACE FUNCTION marketplace_screen_has_booking_conflict(
  p_screen_id text, p_start date, p_end date
) RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM bookings
    WHERE screen_id = p_screen_id
      AND status IN ('pending_review', 'active', 'paused', 'scheduled')
      AND daterange(start_date, end_date, '[]') && daterange(p_start, p_end, '[]')
  );
$$;

-- Enforced at listing-create time via trigger (covers createListing,
-- createBundleListing, and any future insert path) rather than duplicated
-- application-side checks -- one place can't be bypassed by a new caller.
CREATE OR REPLACE FUNCTION marketplace_check_listing_conflict() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF marketplace_screen_has_booking_conflict(NEW.screen_id, NEW.start_date, NEW.end_date) THEN
    RAISE EXCEPTION 'This screen already has a paid campaign running in that window.'
      USING ERRCODE = '23P01';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marketplace_listings_check_conflict ON marketplace_listings;
CREATE TRIGGER marketplace_listings_check_conflict
  BEFORE INSERT ON marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION marketplace_check_listing_conflict();

-- marketplace_listing_screens (bundle membership rows) carries its own
-- start_date/end_date per screen -- same check, same trigger function
-- signature works since both tables share the screen_id/start_date/end_date
-- column names.
DROP TRIGGER IF EXISTS marketplace_listing_screens_check_conflict ON marketplace_listing_screens;
CREATE TRIGGER marketplace_listing_screens_check_conflict
  BEFORE INSERT ON marketplace_listing_screens
  FOR EACH ROW EXECUTE FUNCTION marketplace_check_listing_conflict();

-- Booking-confirm time: closes the race where a shared-rotation booking is
-- created *after* the listing went active but *before* an advertiser buys
-- it exclusively. marketplace_confirm_booking already SELECTs the listing
-- FOR UPDATE, so this check runs inside that same lock.
CREATE OR REPLACE FUNCTION marketplace_confirm_booking(
  p_listing_id uuid,
  p_advertiser_id uuid,
  p_fee_cents integer
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_listing marketplace_listings%ROWTYPE;
  v_booking_id uuid;
BEGIN
  SELECT * INTO v_listing FROM marketplace_listings WHERE id = p_listing_id FOR UPDATE;

  IF v_listing.id IS NULL THEN
    RAISE EXCEPTION 'listing % not found', p_listing_id;
  END IF;
  IF v_listing.status != 'active' THEN
    RAISE EXCEPTION 'listing % is not active (status=%)', p_listing_id, v_listing.status;
  END IF;
  IF marketplace_screen_has_booking_conflict(v_listing.screen_id, v_listing.start_date, v_listing.end_date) THEN
    RAISE EXCEPTION 'This screen already has a paid campaign running in that window.'
      USING ERRCODE = '23P01';
  END IF;

  UPDATE marketplace_listings SET status = 'booked', updated_at = now() WHERE id = p_listing_id;

  INSERT INTO marketplace_bookings (listing_id, advertiser_id, price_cents, platform_fee_cents)
  VALUES (p_listing_id, p_advertiser_id, v_listing.price_cents, p_fee_cents)
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$;
