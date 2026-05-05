-- ============================================================
-- Phase 3: scans table, profiles additions, team_members table
-- ============================================================

-- Profiles: add new columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credits numeric DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rate_override numeric;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_website text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'UTC';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_prefs jsonb
  DEFAULT '{"campaign_approved": true, "low_budget": true, "weekly_report": true}';

-- Scans table
CREATE TABLE IF NOT EXISTS scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  screen_id uuid REFERENCES screens(id) ON DELETE SET NULL,
  advertiser_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  scanned_at timestamptz DEFAULT now(),
  device_type text,
  city text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  email text,
  consent boolean DEFAULT false
);

ALTER TABLE scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "advertiser_own_scans" ON scans
  FOR SELECT USING (advertiser_id = auth.uid());

CREATE POLICY IF NOT EXISTS "operator_all_scans" ON scans
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'operator')
  );

CREATE POLICY IF NOT EXISTS "service_insert_scans" ON scans
  FOR INSERT WITH CHECK (true);

-- Team members table
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  user_profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  role text DEFAULT 'viewer',
  invited_at timestamptz DEFAULT now(),
  joined_at timestamptz,
  UNIQUE(org_profile_id, user_profile_id)
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "team_member_select" ON team_members
  FOR SELECT USING (
    org_profile_id = auth.uid() OR user_profile_id = auth.uid()
  );

CREATE POLICY IF NOT EXISTS "org_admin_manage_team" ON team_members
  FOR ALL USING (org_profile_id = auth.uid());
