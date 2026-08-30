-- ============================================================
-- Network benchmarks by (venue_category, environment, campaign_category).
--
-- PUBLISHED ONLY above a k-anonymity floor: at least 5 distinct campaigns AND
-- 3 distinct advertisers per group. Below that, the group is omitted entirely
-- rather than published with a small-sample caveat — a percentile over two
-- campaigns is a description of those two advertisers, not a benchmark.
--
-- A materialized view does not enforce RLS, so this view must never carry an
-- identifying column. Do not add campaign_id, advertiser_id or screen_id.
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.benchmark_stats AS
WITH per_campaign AS (
  SELECT
    s.venue_category,
    s.environment,
    b.category                       AS campaign_category,
    d.campaign_id,
    b.advertiser_id,
    sum(d.impressions)               AS impressions,
    sum(d.billable_scans)            AS billable_scans,
    sum(d.plays)                     AS plays
  FROM public.campaign_delivery_daily d
  JOIN public.bookings b ON b.id = d.campaign_id
  JOIN public.screens  s ON s.id = d.screen_id
  GROUP BY 1, 2, 3, 4, 5
),
rated AS (
  SELECT
    venue_category,
    environment,
    campaign_category,
    campaign_id,
    advertiser_id,
    CASE WHEN impressions > 0
         THEN billable_scans::numeric / impressions * 100
         ELSE NULL END AS scan_rate_pct
  FROM per_campaign
)
SELECT
  venue_category,
  environment,
  campaign_category,
  count(DISTINCT campaign_id)                                              AS campaign_count,
  count(DISTINCT advertiser_id)                                            AS advertiser_count,
  percentile_cont(0.25) WITHIN GROUP (ORDER BY scan_rate_pct)              AS scan_rate_p25,
  percentile_cont(0.50) WITHIN GROUP (ORDER BY scan_rate_pct)              AS scan_rate_p50,
  percentile_cont(0.75) WITHIN GROUP (ORDER BY scan_rate_pct)              AS scan_rate_p75
FROM rated
WHERE scan_rate_pct IS NOT NULL
GROUP BY 1, 2, 3
HAVING count(DISTINCT campaign_id) >= 5
   AND count(DISTINCT advertiser_id) >= 3;

-- Required for REFRESH ... CONCURRENTLY.
CREATE UNIQUE INDEX IF NOT EXISTS benchmark_stats_key
  ON public.benchmark_stats (venue_category, environment, campaign_category);

GRANT SELECT ON public.benchmark_stats TO authenticated;

SELECT cron.unschedule('refresh-benchmark-stats')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-benchmark-stats');

SELECT cron.schedule(
  'refresh-benchmark-stats',
  '23 5 * * *',
  $$ REFRESH MATERIALIZED VIEW CONCURRENTLY public.benchmark_stats $$
);
