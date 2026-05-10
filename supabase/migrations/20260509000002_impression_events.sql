-- ============================================================
-- Impression events — pushed by Screen Agent every 30s
-- Aggregated, anonymous demographics. No PII, no raw images.
-- ============================================================

CREATE TABLE IF NOT EXISTS impression_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  screen_id           uuid REFERENCES screens(id) ON DELETE CASCADE,
  campaign_id         uuid REFERENCES bookings(id) ON DELETE SET NULL,
  window_start        timestamptz NOT NULL,
  window_end          timestamptz NOT NULL,
  people_count        integer DEFAULT 0,
  avg_dwell_seconds   numeric DEFAULT 0,
  avg_attention_score numeric DEFAULT 0,  -- 0.0–1.0
  age_18_24           integer DEFAULT 0,
  age_25_34           integer DEFAULT 0,
  age_35_44           integer DEFAULT 0,
  age_45_54           integer DEFAULT 0,
  age_55_plus         integer DEFAULT 0,
  gender_male         integer DEFAULT 0,
  gender_female       integer DEFAULT 0,
  gender_unknown      integer DEFAULT 0,
  qr_scans_in_window  integer DEFAULT 0,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE impression_events ENABLE ROW LEVEL SECURITY;

-- Screen Agent pushes via service role key
CREATE POLICY IF NOT EXISTS "service_insert_impressions" ON impression_events
  FOR INSERT WITH CHECK (true);

-- Operators view impressions for their own screens
CREATE POLICY IF NOT EXISTS "operator_view_impressions" ON impression_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM screens
      WHERE screens.id = screen_id
        AND screens.operator_id = auth.uid()
    )
  );

-- Advertisers view impressions for their own campaigns
CREATE POLICY IF NOT EXISTS "advertiser_view_impressions" ON impression_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = campaign_id
        AND bookings.advertiser_id = auth.uid()
    )
  );
