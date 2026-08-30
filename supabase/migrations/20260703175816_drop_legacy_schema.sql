-- S4: drop the unused legacy (owner_id-era) schema.
-- These tables are empty and referenced by NO app code, live RLS policy, live
-- function, or foreign key. They carried broad `is_operator()`/`WITH CHECK(true)`
-- policies that would leak cross-tenant if ever populated. The live model uses
-- bookings / campaign_screens / scans / impression_events instead.
--
-- Verified before drop: all 10 tables have 0 rows; the only dependents are the
-- two unused reporting views below; `current_advertiser_id()` is `SELECT auth.uid()`
-- (does NOT read `advertisers`, which is therefore kept — it still holds 4 rows of
-- old data and is safe to retire separately).

-- CASCADE is needed because these legacy tables cross-reference each other in
-- their own RLS policies (e.g. the `transactions` policy joins `campaign_placements`).
-- No policy on a live or kept table references any of these, so the cascade is
-- bounded to the legacy set being dropped.
DROP VIEW  IF EXISTS public.campaign_stats;
DROP VIEW  IF EXISTS public.presence_current;

DROP TABLE IF EXISTS public.campaign_analytics    CASCADE;
DROP TABLE IF EXISTS public.campaign_placements   CASCADE;
DROP TABLE IF EXISTS public.campaigns             CASCADE;
DROP TABLE IF EXISTS public.scan_events           CASCADE;
DROP TABLE IF EXISTS public.impression_logs       CASCADE;
DROP TABLE IF EXISTS public.pixel_events          CASCADE;
DROP TABLE IF EXISTS public.presence_logs         CASCADE;
DROP TABLE IF EXISTS public.revenue_ledger        CASCADE;
DROP TABLE IF EXISTS public.transactions          CASCADE;
DROP TABLE IF EXISTS public.screen_host_revenue   CASCADE;
