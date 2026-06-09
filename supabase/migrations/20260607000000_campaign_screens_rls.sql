-- ============================================================
-- Fix: campaign_screens and approval_tokens had no RLS at all,
-- letting any authenticated user approve/reject/forge campaign-
-- screen links directly via the anon-key client.
-- ============================================================

ALTER TABLE campaign_screens ENABLE ROW LEVEL SECURITY;

-- Advertisers: read-only access to links for their own campaigns
CREATE POLICY "advertiser_read_own_campaign_screens" ON campaign_screens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = campaign_screens.campaign_id
        AND bookings.advertiser_id = auth.uid()
    )
  );

-- Advertisers: insert links only for campaigns they own
CREATE POLICY "advertiser_insert_own_campaign_screens" ON campaign_screens
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = campaign_screens.campaign_id
        AND bookings.advertiser_id = auth.uid()
    )
  );

-- Operators: read links targeting their own screens (approval queue)
CREATE POLICY "operator_read_own_screen_links" ON campaign_screens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM screens
      WHERE screens.id = campaign_screens.screen_id
        AND screens.operator_id = auth.uid()
    )
  );

-- Operators: approve/reject only links targeting their own screens
CREATE POLICY "operator_update_own_screen_links" ON campaign_screens
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM screens
      WHERE screens.id = campaign_screens.screen_id
        AND screens.operator_id = auth.uid()
    )
  );

-- approval_tokens: grants approve/reject power over a campaign via a
-- bare token. Only the service role (edge functions) should ever touch
-- this table — no client policies, so RLS denies all anon/authenticated
-- access by default while service-role calls (which bypass RLS) keep working.
ALTER TABLE approval_tokens ENABLE ROW LEVEL SECURITY;
