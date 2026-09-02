DROP VIEW IF EXISTS public.lift_stats;

CREATE OR REPLACE VIEW public.delivery_check_stats
WITH (security_invoker = true) AS
WITH day_map(day_name, dow) AS (
  VALUES ('Sun',0),('Mon',1),('Tue',2),('Wed',3),('Thu',4),('Fri',5),('Sat',6)
),
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
    dm.dow,
    extract(hour FROM b.time_start::time)::int AS start_hour,
    extract(hour FROM b.time_end::time)::int   AS end_hour
  FROM public.bookings b
  CROSS JOIN LATERAL unnest(b.schedule_days) AS sd(day_name)
  JOIN day_map dm ON dm.day_name = sd.day_name
  WHERE b.holdout_enabled = true
),
control AS (
  SELECT
    cw.campaign_id,
    avg(ai.people_per_min) AS control_people_per_min
  FROM control_windows cw
  JOIN public.campaign_screens cs
    ON cs.campaign_id = cw.campaign_id AND cs.is_control = true
  JOIN public.screen_audience_index ai
    ON ai.screen_id = cs.screen_id
   AND ai.dow = cw.dow
   AND ai.hour BETWEEN cw.start_hour AND cw.end_hour
  WHERE ai.sample_windows >= public.audience_min_samples()
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
