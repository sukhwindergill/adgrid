-- Marketplace: a confirmed exclusive booking against a marketplace_listings
-- row. payment_intent_id/payment_status mirror the existing bookings table's
-- columns (screen_tokens_payments migration) so this reuses the same
-- payment-status vocabulary rather than inventing a new one.

CREATE TABLE IF NOT EXISTS marketplace_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES marketplace_listings(id) ON DELETE RESTRICT,
  advertiser_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  price_cents integer NOT NULL CHECK (price_cents > 0),
  platform_fee_cents integer NOT NULL CHECK (platform_fee_cents >= 0),
  booked_at timestamptz DEFAULT now(),
  payment_intent_id text,
  payment_status text DEFAULT 'unpaid',
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','active','completed','cancelled'))
);

CREATE INDEX IF NOT EXISTS marketplace_bookings_listing_idx ON marketplace_bookings(listing_id);
CREATE INDEX IF NOT EXISTS marketplace_bookings_advertiser_idx ON marketplace_bookings(advertiser_id);

ALTER TABLE marketplace_bookings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "advertiser_sees_own_bookings" ON marketplace_bookings
    FOR SELECT USING (advertiser_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "operator_sees_bookings_on_own_listings" ON marketplace_bookings
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM marketplace_listings l WHERE l.id = listing_id AND l.operator_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- No direct INSERT/UPDATE policy for authenticated roles — all writes go
-- through marketplace_confirm_booking (SECURITY DEFINER) called from the
-- marketplace-book edge function using the service role, so the atomic
-- check-then-flip can't race two simultaneous bookings on one listing.
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

  UPDATE marketplace_listings SET status = 'booked', updated_at = now() WHERE id = p_listing_id;

  INSERT INTO marketplace_bookings (listing_id, advertiser_id, price_cents, platform_fee_cents)
  VALUES (p_listing_id, p_advertiser_id, v_listing.price_cents, p_fee_cents)
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$;

REVOKE ALL ON FUNCTION marketplace_confirm_booking(uuid, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION marketplace_confirm_booking(uuid, uuid, integer) TO service_role;
