-- Drop legacy owner_id-based screen policies that predate operator_id.
-- The authoritative policies are operator_own_screens (ALL, operator_id = auth.uid())
-- and screens_grant_select (SELECT, has_account_grant). The owner_id column still
-- exists for historical reference but should not gate access.

DROP POLICY IF EXISTS "Screen owners can update own screens" ON screens;
DROP POLICY IF EXISTS "Screen owners see own screens" ON screens;
