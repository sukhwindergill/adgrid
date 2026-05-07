-- Per-advertiser platform credentials
CREATE TABLE advertiser_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  platform text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}',
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(advertiser_id, platform)
);

ALTER TABLE advertiser_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "advertiser_own_integrations" ON advertiser_integrations
  FOR ALL USING (advertiser_id = auth.uid());

CREATE POLICY "service_manage_integrations" ON advertiser_integrations
  FOR ALL USING (auth.role() = 'service_role');

-- Event log: one row per scan→platform fire attempt
CREATE TABLE integration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  platform text NOT NULL,
  event_type text NOT NULL,
  scan_id uuid REFERENCES scans(id) ON DELETE SET NULL,
  status text NOT NULL,
  error text,
  fired_at timestamptz DEFAULT now()
);

ALTER TABLE integration_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "advertiser_own_events" ON integration_events
  FOR ALL USING (advertiser_id = auth.uid());

CREATE POLICY "service_insert_events" ON integration_events
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
