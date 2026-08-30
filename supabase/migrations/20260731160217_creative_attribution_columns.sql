-- Attribution only — lets per-creative reporting (Phase 3+) group actual
-- plays/scans by which creative was shown, without any change to how plays
-- or scans are recorded today. Null = a campaign with no explicit creative
-- assignment (every campaign today).

ALTER TABLE ad_plays ADD COLUMN IF NOT EXISTS creative_id uuid REFERENCES campaign_creatives(id);
ALTER TABLE scans     ADD COLUMN IF NOT EXISTS creative_id uuid REFERENCES campaign_creatives(id);

CREATE INDEX IF NOT EXISTS ad_plays_creative_idx ON ad_plays (creative_id);
CREATE INDEX IF NOT EXISTS scans_creative_idx ON scans (creative_id);
