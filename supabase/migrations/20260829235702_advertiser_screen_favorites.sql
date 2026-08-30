-- Advertiser favorite screens ("boards"). Lets an advertiser star a
-- screen from the campaign builder so it's quick to find again on the
-- next campaign, alongside the "recently used" list computed live from
-- campaign_screens (see useAdvertiserRecentScreens / useAdvertiserFavoriteScreens).

CREATE TABLE IF NOT EXISTS advertiser_screen_favorites (
  advertiser_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  screen_id     text NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (advertiser_id, screen_id)
);

CREATE INDEX IF NOT EXISTS advertiser_screen_favorites_advertiser_id_idx
  ON advertiser_screen_favorites(advertiser_id);

ALTER TABLE advertiser_screen_favorites ENABLE ROW LEVEL SECURITY;

-- Advertisers manage only their own favorites.
CREATE POLICY "advertiser_manage_own_screen_favorites" ON advertiser_screen_favorites
  FOR ALL
  USING (advertiser_id = auth.uid())
  WITH CHECK (advertiser_id = auth.uid());
