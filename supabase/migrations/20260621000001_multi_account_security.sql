-- supabase/migrations/20260621000001_multi_account_security.sql
-- Security hardening for account_grants table and has_account_grant function.
-- Applies fixes to already-running DB (20260621000000_multi_account.sql already applied).

-- Fix 1: has_account_grant — add SET search_path to SECURITY DEFINER function
CREATE OR REPLACE FUNCTION has_account_grant(
  target_account_id uuid,
  min_role text DEFAULT 'viewer'
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    -- Path A: direct grant to this user
    SELECT 1
    FROM account_grants ag
    WHERE ag.account_id = target_account_id
      AND ag.grantee_id = auth.uid()
      AND ag.status = 'active'
      AND CASE min_role
            WHEN 'admin'   THEN ag.role = 'admin'
            WHEN 'manager' THEN ag.role IN ('admin', 'manager')
            ELSE true
          END

    UNION ALL

    -- Path B: user is member of an org that has a grant
    SELECT 1
    FROM account_grants ag
    JOIN team_members tm ON tm.org_profile_id = ag.grantee_id
    LEFT JOIN team_member_client_roles tmcr
      ON tmcr.team_member_id = tm.id
      AND tmcr.client_account_id = ag.account_id
    WHERE ag.account_id = target_account_id
      AND ag.status = 'active'
      AND tm.user_profile_id = auth.uid()
      AND (tm.role = 'admin' OR tmcr.id IS NOT NULL)
      AND CASE min_role
            WHEN 'admin'   THEN COALESCE(tmcr.role, ag.role) = 'admin'
            WHEN 'manager' THEN COALESCE(tmcr.role, ag.role) IN ('admin', 'manager')
            ELSE true
          END
  )
$$;

-- Fix 2: ag_owner_update — add WITH CHECK to prevent moving grants to other accounts
DROP POLICY IF EXISTS "ag_owner_update" ON account_grants;
CREATE POLICY "ag_owner_update" ON account_grants
  FOR UPDATE
  USING (account_id = auth.uid())
  WITH CHECK (account_id = auth.uid());

-- Fix 3: ag_grantee_update — add WITH CHECK to prevent role self-escalation
DROP POLICY IF EXISTS "ag_grantee_update" ON account_grants;
CREATE POLICY "ag_grantee_update" ON account_grants
  FOR UPDATE
  USING (grantee_id = auth.uid())
  WITH CHECK (grantee_id = auth.uid());

-- Fix 4: Replace low-cardinality standalone status index with composite partial index
DROP INDEX IF EXISTS account_grants_status_idx;
CREATE INDEX IF NOT EXISTS account_grants_account_status_idx
  ON account_grants(account_id, status)
  WHERE status = 'active';
