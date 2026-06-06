-- Backfill campaign_screens for bookings created before the campaign_targeting migration.
-- Legacy bookings stored only screen_name; join to screens to resolve screen_id.
-- Skips bookings already having a campaign_screens row and rejected/cancelled bookings.
INSERT INTO campaign_screens (campaign_id, screen_id, status, created_at)
SELECT
  b.id                                                    AS campaign_id,
  s.id                                                    AS screen_id,
  CASE WHEN b.status IN ('scheduled', 'active') THEN 'approved' ELSE 'pending' END AS status,
  b.created_at
FROM bookings b
JOIN screens s ON s.name = b.screen_name
WHERE b.screen_name IS NOT NULL
  AND b.screen_name <> ''
  AND b.status NOT IN ('rejected', 'cancelled')
  AND NOT EXISTS (
    SELECT 1 FROM campaign_screens cs
    WHERE cs.campaign_id = b.id
      AND cs.screen_id   = s.id
  );
