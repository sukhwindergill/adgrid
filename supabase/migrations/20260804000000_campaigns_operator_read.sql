-- Operators need to read a campaign's name to label a grouped row in their
-- own campaign list, for any campaign with a booking targeting one of their
-- screens. Mirrors the ownership-chain pattern used throughout this feature.
CREATE POLICY "operator_read_relevant_campaigns" ON campaigns
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bookings
      JOIN campaign_screens ON campaign_screens.campaign_id = bookings.id
      JOIN screens ON screens.id = campaign_screens.screen_id
      WHERE bookings.campaign_id = campaigns.id
        AND screens.operator_id = auth.uid()
    )
  );
