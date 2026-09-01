-- Found building the marketplace bookings view: marketplace_listings only
-- has two SELECT policies -- the operator who owns it (any status), or
-- anyone when status='active'. The moment marketplace_confirm_booking flips
-- a listing to 'booked', the advertiser who just paid for it can no longer
-- read that listing row at all -- neither policy covers them. Their own
-- booking becomes invisible on their own bookings view.
CREATE POLICY "advertiser_reads_own_booked_listings" ON marketplace_listings
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM marketplace_bookings b
      WHERE b.listing_id = id AND b.advertiser_id = auth.uid()
    )
  );
