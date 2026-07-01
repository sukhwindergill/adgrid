-- Logs per-campaign Stripe Transfers from platform account → operator Connect account.
-- One row per (booking_id, operator_id) pair. Prevents double-transfer via unique constraint.
-- Note: bookings.id is type text, so booking_id is text here to match.
CREATE TABLE IF NOT EXISTS operator_transfers (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id         text NOT NULL REFERENCES bookings(id),
  operator_id        uuid NOT NULL REFERENCES profiles(id),
  amount             numeric NOT NULL,          -- in major currency units (dollars)
  currency           text NOT NULL,
  stripe_transfer_id text UNIQUE,
  status             text NOT NULL DEFAULT 'transferred',
  screen_count       int  NOT NULL DEFAULT 1,   -- screens this operator had in the campaign
  total_screens      int  NOT NULL DEFAULT 1,   -- total screens in the campaign
  created_at         timestamptz DEFAULT now()
);

-- Prevent double-transfer for same booking+operator
CREATE UNIQUE INDEX IF NOT EXISTS operator_transfers_booking_operator
  ON operator_transfers (booking_id, operator_id);

ALTER TABLE operator_transfers ENABLE ROW LEVEL SECURITY;

-- Operators can read their own transfer records
CREATE POLICY "operator_own_transfers" ON operator_transfers
  FOR SELECT USING (operator_id = auth.uid());

-- Service role inserts
CREATE POLICY "service_insert_transfers" ON operator_transfers
  FOR INSERT WITH CHECK (true);
