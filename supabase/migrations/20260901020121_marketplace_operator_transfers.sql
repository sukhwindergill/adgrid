-- Logs the Stripe Transfer of a marketplace booking's listed price (not the
-- platform fee, which the advertiser paid on top -- see MarketplaceListingDetail's
-- "total ${price + fee}" copy) from the platform account to the operator's
-- Connect account. Separate table from `operator_transfers` -- that one's
-- booking_id is a text FK into `bookings`, marketplace_bookings.id is a
-- different uuid-keyed table, and there's exactly one operator per
-- marketplace booking (same-operator-only bundles, no cross-operator split),
-- so the screen_count/total_screens split columns don't apply here.
CREATE TABLE IF NOT EXISTS marketplace_operator_transfers (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id         uuid NOT NULL REFERENCES marketplace_bookings(id),
  operator_id        uuid NOT NULL REFERENCES profiles(id),
  amount             numeric NOT NULL,          -- in major currency units (dollars)
  currency           text NOT NULL,
  stripe_transfer_id text UNIQUE,
  status             text NOT NULL DEFAULT 'transferred',
  created_at         timestamptz DEFAULT now()
);

-- One transfer per booking -- there's only ever one operator to pay out.
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_operator_transfers_booking_idx
  ON marketplace_operator_transfers (booking_id);

ALTER TABLE marketplace_operator_transfers ENABLE ROW LEVEL SECURITY;

-- Operators can read their own transfer records.
CREATE POLICY "operator_own_marketplace_transfers" ON marketplace_operator_transfers
  FOR SELECT TO authenticated USING (operator_id = auth.uid());

-- No INSERT/UPDATE policy for authenticated/anon -- only the marketplace-book
-- edge function writes here, using the service-role client, which bypasses
-- RLS entirely and needs no policy. (operator_transfers' own "service
-- inserts" policy has no TO clause, defaulting to PUBLIC with WITH CHECK
-- (true) -- that lets any authenticated user insert a fabricated transfer
-- row for themselves. Not repeating that here; flagged separately for
-- operator_transfers itself.)
