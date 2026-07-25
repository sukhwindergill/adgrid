-- ============================================================
-- Audience index: measured people-per-minute by screen, day-of-week and hour,
-- aggregated from the CV agent's impression_events.
--
-- This is the multiplier that converts a proof-of-play into an
-- audience-weighted impression, per the IAB DOOH definition.
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.screen_audience_index AS
SELECT
  screen_id,
  EXTRACT(dow  FROM window_start)::int AS dow,
  EXTRACT(hour FROM window_start)::int AS hour,
  avg(people_count / GREATEST(EXTRACT(EPOCH FROM (window_end - window_start)) / 60.0, 1)) AS people_per_min,
  avg(avg_dwell_seconds)   AS avg_dwell_s,
  avg(avg_attention_score) AS avg_attention,
  count(*)                 AS sample_windows
FROM public.impression_events
WHERE window_end > window_start
GROUP BY 1, 2, 3;

-- REFRESH ... CONCURRENTLY requires a unique index on the view.
CREATE UNIQUE INDEX IF NOT EXISTS screen_audience_index_key
  ON public.screen_audience_index (screen_id, dow, hour);

-- A (screen, dow, hour) cell with fewer than this many sampled windows is not
-- trusted as measured; callers fall back to the modelled curve and label the
-- result accordingly.
CREATE OR REPLACE FUNCTION public.audience_min_samples() RETURNS int
  LANGUAGE sql IMMUTABLE AS $$ SELECT 20 $$;

GRANT SELECT ON public.screen_audience_index TO authenticated;

-- Refresh hourly, alongside the existing crons.
SELECT cron.unschedule('refresh-screen-audience-index')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-screen-audience-index');

SELECT cron.schedule(
  'refresh-screen-audience-index',
  '7 * * * *',
  $$ REFRESH MATERIALIZED VIEW CONCURRENTLY public.screen_audience_index $$
);
