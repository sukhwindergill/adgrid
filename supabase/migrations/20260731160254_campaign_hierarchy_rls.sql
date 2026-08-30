-- RLS for campaigns, campaign_creatives, campaign_creative_screens.
-- Mirrors the ownership-chain pattern in 20260607000000_campaign_screens_rls.sql.

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "advertiser_read_own_campaigns" ON campaigns
  FOR SELECT USING (advertiser_id = auth.uid());

CREATE POLICY "advertiser_insert_own_campaigns" ON campaigns
  FOR INSERT WITH CHECK (advertiser_id = auth.uid());

CREATE POLICY "advertiser_update_own_campaigns" ON campaigns
  FOR UPDATE USING (advertiser_id = auth.uid());

ALTER TABLE campaign_creatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "advertiser_read_own_campaign_creatives" ON campaign_creatives
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = campaign_creatives.targeting_id
        AND bookings.advertiser_id = auth.uid()
    )
  );

CREATE POLICY "advertiser_insert_own_campaign_creatives" ON campaign_creatives
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = campaign_creatives.targeting_id
        AND bookings.advertiser_id = auth.uid()
    )
  );

CREATE POLICY "advertiser_update_own_campaign_creatives" ON campaign_creatives
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = campaign_creatives.targeting_id
        AND bookings.advertiser_id = auth.uid()
    )
  );

-- Operators need to read creative content (headline/media/etc) for screens
-- they own, so the approval queue can render what's actually assigned.
CREATE POLICY "operator_read_own_screen_creatives" ON campaign_creatives
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM campaign_creative_screens ccs
      JOIN screens ON screens.id = ccs.screen_id
      WHERE ccs.creative_id = campaign_creatives.id
        AND screens.operator_id = auth.uid()
    )
  );

ALTER TABLE campaign_creative_screens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "advertiser_read_own_creative_screens" ON campaign_creative_screens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM campaign_creatives cc
      JOIN bookings ON bookings.id = cc.targeting_id
      WHERE cc.id = campaign_creative_screens.creative_id
        AND bookings.advertiser_id = auth.uid()
    )
  );

CREATE POLICY "advertiser_insert_own_creative_screens" ON campaign_creative_screens
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaign_creatives cc
      JOIN bookings ON bookings.id = cc.targeting_id
      WHERE cc.id = campaign_creative_screens.creative_id
        AND bookings.advertiser_id = auth.uid()
    )
  );

CREATE POLICY "advertiser_delete_own_creative_screens" ON campaign_creative_screens
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM campaign_creatives cc
      JOIN bookings ON bookings.id = cc.targeting_id
      WHERE cc.id = campaign_creative_screens.creative_id
        AND bookings.advertiser_id = auth.uid()
    )
  );

CREATE POLICY "operator_read_own_screen_assignments" ON campaign_creative_screens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM screens
      WHERE screens.id = campaign_creative_screens.screen_id
        AND screens.operator_id = auth.uid()
    )
  );
