-- Migration: dual_role
-- Allow operators to access advertiser-side tables.
-- No existing policies check `role = 'advertiser'` explicitly (confirmed by audit),
-- so this migration only creates the shared helper function for future policies.

-- Helper: returns true when the caller is an advertiser OR an operator acting as advertiser
CREATE OR REPLACE FUNCTION is_advertiser_or_operator()
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('advertiser', 'operator')
  );
$$;
