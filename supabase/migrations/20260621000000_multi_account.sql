-- supabase/migrations/20260621000000_multi_account.sql

-- ── account_grants ─────────────────────────────────────────────────────────────
CREATE TABLE account_grants (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  grantee_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invite_email text,
  role         text NOT NULL DEFAULT 'viewer'
               CHECK (role IN ('admin', 'manager', 'viewer')),
  granted_by   uuid REFERENCES profiles(id),
  status       text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'active', 'revoked')),
  created_at   timestamptz DEFAULT now(),
  UNIQUE(account_id, grantee_id)
);

ALTER TABLE account_grants ENABLE ROW LEVEL SECURITY;

-- Account owner sees all grants on their account
CREATE POLICY "ag_owner_select" ON account_grants
  FOR SELECT USING (account_id = auth.uid());

-- Grantee sees grants addressed to them
CREATE POLICY "ag_grantee_select" ON account_grants
  FOR SELECT USING (grantee_id = auth.uid());

-- Account owner creates grants
CREATE POLICY "ag_owner_insert" ON account_grants
  FOR INSERT WITH CHECK (account_id = auth.uid());

-- Account owner can update (change role, revoke)
CREATE POLICY "ag_owner_update" ON account_grants
  FOR UPDATE USING (account_id = auth.uid());

-- Grantee can flip status to 'active' or 'revoked' (accept/decline)
CREATE POLICY "ag_grantee_update" ON account_grants
  FOR UPDATE USING (grantee_id = auth.uid());

CREATE INDEX account_grants_account_id_idx ON account_grants(account_id);
CREATE INDEX account_grants_grantee_id_idx ON account_grants(grantee_id);
CREATE INDEX account_grants_status_idx     ON account_grants(status);

-- ── team_member_client_roles ───────────────────────────────────────────────────
CREATE TABLE team_member_client_roles (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id    uuid NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  client_account_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role              text NOT NULL DEFAULT 'viewer'
                    CHECK (role IN ('admin', 'manager', 'viewer')),
  UNIQUE(team_member_id, client_account_id)
);

ALTER TABLE team_member_client_roles ENABLE ROW LEVEL SECURITY;

-- Org admin (org_profile_id = auth.uid()) manages all client role assignments for their team
CREATE POLICY "tmcr_org_admin_all" ON team_member_client_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.id = team_member_id
        AND tm.org_profile_id = auth.uid()
    )
  );

-- Team member reads their own client role assignments
CREATE POLICY "tmcr_member_select" ON team_member_client_roles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.id = team_member_id
        AND tm.user_profile_id = auth.uid()
    )
  );

CREATE INDEX tmcr_member_idx ON team_member_client_roles(team_member_id);
CREATE INDEX tmcr_client_idx ON team_member_client_roles(client_account_id);

-- ── Helper: resolve effective grant role for current user on a target account ──
-- Returns true if auth.uid() has at least min_role on target_account_id.
-- Checks two paths: direct grant OR org-member grant.
-- NOTE: Tables created above; function defined after so SQL body can reference them.
CREATE OR REPLACE FUNCTION has_account_grant(
  target_account_id uuid,
  min_role text DEFAULT 'viewer'
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
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

-- ── bookings: billed_to_profile_id ────────────────────────────────────────────
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS
  billed_to_profile_id uuid REFERENCES profiles(id);

-- ── RLS additions: allow grant-based access to existing tables ─────────────────

-- bookings: delegate read
CREATE POLICY "bookings_grant_select" ON bookings
  FOR SELECT USING (
    advertiser_id IS NOT NULL
    AND has_account_grant(advertiser_id, 'viewer')
  );

-- bookings: delegate write (manager+)
CREATE POLICY "bookings_grant_insert" ON bookings
  FOR INSERT WITH CHECK (
    advertiser_id IS NOT NULL
    AND has_account_grant(advertiser_id, 'manager')
  );

-- screens: delegate read (operator accounts)
CREATE POLICY "screens_grant_select" ON screens
  FOR SELECT USING (
    operator_id IS NOT NULL
    AND has_account_grant(operator_id, 'viewer')
  );

-- scans: delegate read
CREATE POLICY "scans_grant_select" ON scans
  FOR SELECT USING (
    advertiser_id IS NOT NULL
    AND has_account_grant(advertiser_id, 'viewer')
  );
