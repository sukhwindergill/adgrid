-- ============================================================
-- FIX: delivery_check_stats has always errored with "permission denied for
-- materialized view screen_audience_index" for every real advertiser.
--
-- 20260816000000 created this view with `security_invoker = true`, so it
-- runs as the CALLING role. But 20260809000002 (a week earlier, a real
-- cross-operator data-leak fix) revoked SELECT on screen_audience_index
-- from anon/authenticated entirely -- only service_role can read it
-- directly. Postgres checks table-level privilege on every relation named
-- in a query at plan time, unconditionally, not per-row, so ANY
-- authenticated client hitting this view -- including CampaignDetail.jsx's
-- in-app Delivery Check tab, the primary UI for this feature -- gets a
-- hard permission error, always. CampaignDetail.jsx catches the error and
-- leaves the row null, so DeliveryCheckPanel silently renders "Still
-- collecting data" forever instead of surfacing the actual failure.
-- (campaign-report's edge function queries the same view with the service
-- role key, so that path was never broken -- which is why this shipped
-- unnoticed.)
--
-- Fix: same pattern campaign_delivery_daily's own header comment already
-- documents for exactly this situation -- drop security_invoker (the view
-- runs as its owner, same as campaign_delivery_daily) and carry its own
-- access predicate instead of relying on the caller's own table grants.
-- ============================================================

DROP VIEW IF EXISTS public.delivery_check_stats;

CREATE VIEW public.delivery_check_stats AS
WITH day_map(day_name, dow) AS (
  VALUES ('Sun',0),('Mon',1),('Tue',2),('Wed',3),('Thu',4),('Fri',5),('Sat',6)
),
-- exposed already goes through campaign_delivery_daily, which carries its
-- own auth.uid()-based access predicate (advertiser OR operator-of-screen)
-- baked into that view's own query text -- auth.uid() reads the caller's
-- JWT claim regardless of which role the outer view executes as, so that
-- scoping still applies correctly here without repeating it.
exposed AS (
  SELECT
    d.campaign_id,
    sum(d.impressions)                                    AS exposed_impressions,
    sum(d.completed_plays * b.duration) / 60.0             AS exposed_play_minutes
  FROM public.campaign_delivery_daily d
  JOIN public.campaign_screens cs
    ON cs.campaign_id = d.campaign_id AND cs.screen_id = d.screen_id AND cs.is_control = false
  JOIN public.bookings b ON b.id = d.campaign_id
  GROUP BY d.campaign_id
),
control_windows AS (
  SELECT
    b.id AS campaign_id,
    b.advertiser_id,
    dm.dow,
    extract(hour FROM b.time_start::time)::int AS start_hour,
    extract(hour FROM b.time_end::time)::int   AS end_hour
  FROM public.bookings b
  CROSS JOIN LATERAL unnest(b.schedule_days) AS sd(day_name)
  JOIN day_map dm ON dm.day_name = sd.day_name
  WHERE b.holdout_enabled = true
),
-- screen_audience_index has no underlying view to inherit scoping from
-- (SELECT is revoked from anon/authenticated entirely, see
-- 20260809000002) -- this view now runs as its owner, so it must carry
-- its own predicate here, matching campaign_delivery_daily's own pattern:
-- the caller must be the campaign's advertiser OR operate the specific
-- control screen being aggregated.
control AS (
  SELECT
    cw.campaign_id,
    avg(ai.people_per_min) AS control_people_per_min
  FROM control_windows cw
  JOIN public.campaign_screens cs
    ON cs.campaign_id = cw.campaign_id AND cs.is_control = true
  JOIN public.screens s ON s.id = cs.screen_id
  JOIN public.screen_audience_index ai
    ON ai.screen_id = cs.screen_id
   AND ai.dow = cw.dow
   AND ai.hour BETWEEN cw.start_hour AND cw.end_hour
  WHERE
    -- Same reliability gate screen_audience_index's own migration
    -- establishes: a thinly-sampled (screen, dow, hour) cell is noise, not
    -- a measurement, and shouldn't be able to swing the control-side rate.
    ai.sample_windows >= public.audience_min_samples()
    AND (
      current_user IN ('postgres', 'supabase_admin', 'service_role')
      OR cw.advertiser_id = auth.uid()
      OR s.operator_id = auth.uid()
    )
  GROUP BY cw.campaign_id
)
SELECT
  coalesce(exposed.campaign_id, control.campaign_id)        AS campaign_id,
  exposed.exposed_impressions,
  exposed.exposed_play_minutes,
  CASE WHEN exposed.exposed_play_minutes > 0
       THEN exposed.exposed_impressions / exposed.exposed_play_minutes
       ELSE NULL END                                        AS exposed_rate,
  control.control_people_per_min                             AS control_rate
FROM exposed
FULL OUTER JOIN control ON control.campaign_id = exposed.campaign_id;

GRANT SELECT ON public.delivery_check_stats TO authenticated, service_role;
