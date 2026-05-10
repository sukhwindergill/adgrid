-- ============================================================
-- Display heartbeats — logged by Display Player every 10s
-- ============================================================

CREATE TABLE IF NOT EXISTS display_heartbeats (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  screen_id  uuid REFERENCES screens(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  status     text DEFAULT 'playing', -- 'playing' | 'idle' | 'offline'
  created_at timestamptz DEFAULT now()
);

ALTER TABLE display_heartbeats ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "service_insert_heartbeats" ON display_heartbeats
  FOR INSERT WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "operator_view_heartbeats" ON display_heartbeats
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM screens
      WHERE screens.id = screen_id
        AND screens.operator_id = auth.uid()
    )
  );
