-- Advertisers must not write financial columns on bookings (self-marking
-- paid/scheduled with no Stripe charge). Edge functions use service role,
-- which bypasses these grants/policies.
-- Note: bookings has no `currency` column yet; it is added in
-- 20260611000004_booking_currency.sql (and excluded from the column grants
-- in 20260611000003_lock_bookings_update_columns.sql).
REVOKE UPDATE (payment_status, status, budget, payment_intent_id)
  ON public.bookings FROM authenticated;

ALTER POLICY "Advertisers can update own bookings" ON public.bookings
  USING (advertiser_id = current_advertiser_id())
  WITH CHECK (advertiser_id = current_advertiser_id());
