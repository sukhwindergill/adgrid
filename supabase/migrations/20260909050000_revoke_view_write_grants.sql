-- Security-audit finding: advertiser_screens is a simple, single-table,
-- filtered view (`SELECT ... FROM screens WHERE status = 'live'`) with no
-- joins or aggregation, which Postgres treats as automatically updatable --
-- INSERT/UPDATE/DELETE issued against the view rewrite directly onto the
-- underlying `screens` table. The view is owned by `postgres`, and
-- `screens` has row_security enabled but NOT `FORCE ROW LEVEL SECURITY`,
-- so RLS is skipped entirely for the owning role. Supabase's default
-- grants gave `anon` (unauthenticated!) and `authenticated` INSERT,
-- UPDATE, DELETE, and TRUNCATE on this view in addition to SELECT -- so
-- any unauthenticated caller could have sent a raw PATCH/DELETE to
-- /rest/v1/advertiser_screens and modified or deleted *any* screen row in
-- the entire table, completely bypassing screens' own RLS (which scopes
-- writes to the owning operator). Every real caller in this codebase only
-- ever .select()s from this view (marketplace/campaign screen lookups) --
-- the write grants were pure unused excess privilege, not a feature.
--
-- delivery_check_stats similarly had anon/authenticated write grants; it
-- is not actually auto-updatable (it aggregates across CTEs/joins, so
-- Postgres refuses DML against it regardless), but the excess grants are
-- revoked here too as defense in depth -- a future simplification of that
-- view should not silently regain this same hole.
--
-- campaign_delivery_daily and campaign_delivery_health are also not
-- auto-updatable (both aggregate with GROUP BY), so they were never
-- exploitable this way, but they only ever need SELECT either -- trimmed
-- for the same least-privilege reason.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.advertiser_screens FROM anon, authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.delivery_check_stats FROM anon, authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.campaign_delivery_daily FROM authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.campaign_delivery_health FROM authenticated;
