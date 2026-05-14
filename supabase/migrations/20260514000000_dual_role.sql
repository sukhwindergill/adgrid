-- Migration: dual_role
-- Allow operators to access advertiser-side tables.
-- No existing policies check `role = 'advertiser'` explicitly (confirmed by audit),
-- so this migration only creates the shared helper function for future policies.

-- Pre-created helper for future RLS policies.
-- Returns true when caller has role 'advertiser' OR 'operator'.
-- Use in policy USING clauses instead of hardcoding role = 'advertiser'.
CREATE OR REPLACE FUNCTION is_advertiser_or_operator()
RETURNS boolean LANGUAGE sql SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('advertiser', 'operator')
  );
$$;
