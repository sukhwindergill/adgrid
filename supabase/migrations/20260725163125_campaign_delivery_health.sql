-- Per-campaign delivery health, rolled up from reconciliation.
--
-- ACCESS MODEL — same as campaign_delivery_daily. The predicate scopes on the
-- DATABASE role, not the JWT claim: PostgREST always issues
-- `set local role <anon|authenticated|service_role>`, while a direct
-- connection is `postgres`. Scoping on auth.role() would open the view to any
-- caller whose JWT claim happened to be absent — that was a real leak caught
-- in Phase 1. Verified here with four probes (admin / owner / other / no
-- claims) before shipping.
CREATE OR REPLACE VIEW public.campaign_delivery_health AS
SELECT
  r.campaign_id,
  sum(r.expected_plays)::bigint  AS expected_plays,
  sum(r.delivered_plays)::bigint AS delivered_plays,
  CASE WHEN sum(r.expected_plays) > 0
       THEN round(sum(r.delivered_plays)::numeric / sum(r.expected_plays) * 100, 1)
       ELSE NULL END             AS delivery_pct,
  sum(r.credit_amount)           AS total_credited,
  count(*) FILTER (WHERE r.reason = 'screen_offline')  AS offline_days,
  count(*) FILTER (WHERE r.reason = 'underdelivered')  AS underdelivered_days,
  max(r.day)                     AS last_reconciled_day
FROM public.delivery_reconciliation r
WHERE
  current_user IN ('postgres', 'supabase_admin', 'service_role')
  OR EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = r.campaign_id AND b.advertiser_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.screens s
    WHERE s.id = r.screen_id AND s.operator_id = auth.uid()
  )
GROUP BY r.campaign_id;

REVOKE ALL ON public.campaign_delivery_health FROM anon;
GRANT SELECT ON public.campaign_delivery_health TO authenticated, service_role;
