-- ============================================================
-- Screen Owner Onboarding: payouts table, profiles additions,
-- screens.operator_id
-- ============================================================

-- Profiles: Stripe Connect fields + owner revenue share
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_connect_account_id text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS connect_status text; -- null | 'pending' | 'active'
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS owner_revenue_share numeric DEFAULT 0.40;

-- Screens: link to operator profile
ALTER TABLE screens ADD COLUMN IF NOT EXISTS operator_id uuid REFERENCES profiles(id);

-- RLS: operators see only their own screens
CREATE POLICY IF NOT EXISTS "operator_own_screens" ON screens
  FOR ALL USING (operator_id = auth.uid());

-- Payouts table
CREATE TABLE IF NOT EXISTS payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid REFERENCES profiles(id),
  amount numeric NOT NULL,
  currency text DEFAULT 'usd',
  stripe_transfer_id text,
  status text DEFAULT 'pending', -- 'pending' | 'transferred' | 'failed'
  period_start date,
  period_end date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "operator_own_payouts" ON payouts
  FOR SELECT USING (operator_id = auth.uid());

CREATE POLICY IF NOT EXISTS "service_insert_payouts" ON payouts
  FOR INSERT WITH CHECK (true);
