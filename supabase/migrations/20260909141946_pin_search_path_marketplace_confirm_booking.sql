-- Security-audit finding: marketplace_confirm_booking is SECURITY DEFINER
-- (runs with the definer's privileges) but had no SET search_path, so it
-- resolved unqualified relation/function names (marketplace_listings,
-- marketplace_bookings, marketplace_screen_has_booking_conflict) using
-- whatever search_path was in effect for the calling session -- normally
-- harmless now that EXECUTE is restricted to service_role, but a mutable
-- search_path on a SECURITY DEFINER function is flagged by the Supabase
-- linter for good reason: it's the standard defense against a caller
-- that could otherwise shadow those names with objects in an
-- earlier-searched schema. Pins it the same way every other
-- SECURITY DEFINER function in this codebase already does.

CREATE OR REPLACE FUNCTION public.marketplace_confirm_booking(p_listing_id uuid, p_advertiser_id uuid, p_fee_cents integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;
