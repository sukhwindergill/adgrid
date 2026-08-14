-- ============================================================
-- Screen-level holdout / lift testing.
--
-- An advertiser with >=10 matched screens can opt a campaign into a holdout
-- test: ~20% of its campaign_screens rows are randomly flagged is_control.
-- Control screens still get a normal campaign_screens row (they go through
-- approval like any other targeted screen) but never serve the campaign's
-- creative (display-feed excludes them) and are never billed to an operator
-- (charge-campaign's payout step excludes them). This is what makes the
-- unbilled/unserved holdout possible without touching the advertiser's flat
-- `bookings.budget` figure at all.
--
-- Random assignment happens server-side, in assign_holdout_control() below,
-- called only via the assign-holdout-control edge function -- never
-- client-set. campaign_screens' own RLS lets an advertiser's INSERT set any
-- column on their own campaign's rows (see 20260605000001_campaign_targeting.sql),
-- so a client-chosen is_control would let an advertiser cherry-pick which
-- screens "lose," fabricating the lift number that later appears on their
-- own public report.
-- ============================================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS holdout_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.campaign_screens
  ADD COLUMN IF NOT EXISTS is_control boolean NOT NULL DEFAULT false;

-- SECURITY DEFINER: runs as the function owner (postgres), not the caller,
-- so it can UPDATE campaign_screens rows regardless of the caller's RLS
-- grants. Only ever invoked by the assign-holdout-control edge function,
-- which authenticates the caller and verifies campaign ownership BEFORE
-- calling this -- this function itself does not re-check ownership, by
-- design, the same trust boundary the edge function / SQL function split
-- uses elsewhere in this codebase (e.g. charge-campaign's internal-secret
-- pattern). Do not grant EXECUTE on this to `authenticated` -- only the
-- edge function's service-role client may call it.
CREATE OR REPLACE FUNCTION public.assign_holdout_control(p_campaign_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
  v_control_count integer;
BEGIN
  SELECT count(*) INTO v_total
  FROM public.campaign_screens
  WHERE campaign_id = p_campaign_id;

  IF v_total < 10 THEN
    RETURN 0;
  END IF;

  v_control_count := ceil(v_total * 0.2)::integer;

  UPDATE public.campaign_screens
  SET is_control = true
  WHERE id IN (
    SELECT id FROM public.campaign_screens
    WHERE campaign_id = p_campaign_id
    ORDER BY random()
    LIMIT v_control_count
  );

  RETURN v_control_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assign_holdout_control(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_holdout_control(text) FROM authenticated;

-- Per-campaign scan-rate comparison between exposed and control screens.
-- Computed live (not materialized) -- this is a single-campaign filter over
-- campaign_delivery_daily, not a network-wide aggregate, so precomputation
-- isn't warranted at expected request volumes. Revisit if this becomes a
-- hot path.
--
-- Unlike benchmark_stats, this view IS per-campaign and DOES carry
-- campaign_id -- that's the point here (a campaign checking its own lift,
-- not a cross-advertiser aggregate), and RLS on the underlying
-- campaign_delivery_daily / campaign_screens tables already scopes what a
-- given caller can join against. security_invoker=true is safe and correct
-- here (unlike benchmark_stats, which deliberately could not use it --
-- see 20260726000010_benchmark_stats.sql).
CREATE OR REPLACE VIEW public.lift_stats
WITH (security_invoker = true) AS
SELECT
  d.campaign_id,
  cs.is_control,
  sum(d.impressions)      AS impressions,
  sum(d.billable_scans)   AS billable_scans
FROM public.campaign_delivery_daily d
JOIN public.campaign_screens cs
  ON cs.campaign_id = d.campaign_id AND cs.screen_id = d.screen_id
GROUP BY d.campaign_id, cs.is_control;

GRANT SELECT ON public.lift_stats TO authenticated, service_role;
