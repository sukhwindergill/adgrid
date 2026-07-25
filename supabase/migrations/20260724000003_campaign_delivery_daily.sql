-- ============================================================
-- The single delivery source of truth: one row per campaign, screen and day.
--
-- plays        — proof of play, counted from ad_plays
-- impressions  — plays weighted by measured audience where available,
--                otherwise by a conservative modelled spread; `basis` says which
-- attention    — audience-weighted CV attention, only ever measured
--
-- Depends on 20260724000002_scan_quality.sql for scans.is_bot / is_duplicate.
--
-- ACCESS MODEL — read this before changing the view.
-- `security_invoker = true` cannot be used: the view must read public.screens
-- for timezone and footfall, and `screens` is deliberately NOT selectable by
-- `authenticated` (it carries monthly_revenue and operator_id — the cross-tenant
-- leak fixed by the advertiser_screens view). So this view runs as its owner and
-- carries its OWN access predicate.
--
-- That predicate scopes on the DATABASE role, not the JWT claim. PostgREST
-- always issues `set local role <anon|authenticated|service_role>`, while a
-- direct connection is `postgres`. Scoping on auth.role() instead would open
-- the view to any caller whose JWT claim happened to be absent — verified
-- against the live database, where an unclaimed session saw every row.
-- ============================================================

CREATE OR REPLACE VIEW public.campaign_delivery_daily AS
WITH play_days AS (
  SELECT
    p.campaign_id,
    p.screen_id,
    (p.played_at AT TIME ZONE COALESCE(s.timezone, 'UTC'))::date AS day,
    EXTRACT(dow  FROM p.played_at AT TIME ZONE COALESCE(s.timezone, 'UTC'))::int AS dow,
    EXTRACT(hour FROM p.played_at AT TIME ZONE COALESCE(s.timezone, 'UTC'))::int AS hour,
    p.duration_s,
    p.completed,
    s.monthly_traffic_estimate
  FROM public.ad_plays p
  JOIN public.screens s ON s.id = p.screen_id
  WHERE
    current_user IN ('postgres', 'supabase_admin', 'service_role')
    OR EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = p.campaign_id AND b.advertiser_id = auth.uid())
    OR s.operator_id = auth.uid()
),
weighted AS (
  SELECT
    pd.campaign_id,
    pd.screen_id,
    pd.day,
    pd.completed,
    CASE
      WHEN ai.sample_windows >= public.audience_min_samples()
        THEN ai.people_per_min * (pd.duration_s / 60.0)
      ELSE
        -- Modelled fallback: monthly estimate spread evenly across an 18-hour
        -- operating day. The venue-shaped curve lives in
        -- src/lib/footfallCurves.js and is applied client-side for forecasts;
        -- this SQL fallback stays deliberately flat and conservative.
        (COALESCE(pd.monthly_traffic_estimate, 0) / 30.0 / 18.0 / 60.0) * pd.duration_s
    END AS impressions,
    CASE
      WHEN ai.sample_windows >= public.audience_min_samples() THEN 'measured'
      ELSE 'modelled'
    END AS basis,
    CASE
      WHEN ai.sample_windows >= public.audience_min_samples()
        THEN ai.people_per_min * (pd.duration_s / 60.0) * COALESCE(ai.avg_attention, 0)
      ELSE NULL
    END AS attention_weighted
  FROM play_days pd
  LEFT JOIN public.screen_audience_index ai
    ON ai.screen_id = pd.screen_id AND ai.dow = pd.dow AND ai.hour = pd.hour
),
scan_days AS (
  SELECT
    campaign_id,
    screen_id,
    (scanned_at AT TIME ZONE 'UTC')::date AS day,
    count(*) AS scans,
    count(*) FILTER (WHERE NOT is_bot AND NOT is_duplicate) AS billable_scans
  FROM public.scans
  GROUP BY 1, 2, 3
)
SELECT
  w.campaign_id,
  w.screen_id,
  w.day,
  count(*)                                   AS plays,
  count(*) FILTER (WHERE w.completed)        AS completed_plays,
  round(sum(w.impressions))::bigint          AS impressions,
  round(sum(w.attention_weighted))::bigint   AS attention_weighted_impressions,
  CASE WHEN bool_and(w.basis = 'measured') THEN 'measured'
       WHEN bool_or(w.basis = 'measured')  THEN 'mixed'
       ELSE 'modelled' END                   AS basis,
  COALESCE(sd.scans, 0)                      AS scans,
  COALESCE(sd.billable_scans, 0)             AS billable_scans
FROM weighted w
LEFT JOIN scan_days sd
  ON sd.campaign_id = w.campaign_id AND sd.screen_id = w.screen_id AND sd.day = w.day
GROUP BY w.campaign_id, w.screen_id, w.day, sd.scans, sd.billable_scans;

REVOKE ALL ON public.campaign_delivery_daily FROM anon;
GRANT SELECT ON public.campaign_delivery_daily TO authenticated, service_role;
