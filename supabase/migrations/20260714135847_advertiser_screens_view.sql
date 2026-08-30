-- B13 fix (2026-07-14 ICP sweep): advertiser-facing screen browsing leaked
-- every operator's monthly_revenue to every advertiser. The row-level
-- "Advertisers see live screens" policy on `screens` grants the whole row
-- (subject only to a column grant that still included monthly_revenue), and
-- the frontend's single global screens query then rendered that revenue
-- figure straight into the operator dashboard for users who own zero
-- screens (N8) and was readable to any advertiser via a raw REST query.
--
-- Fix: advertisers no longer read the `screens` table directly. They read a
-- view scoped to live screens with monthly_revenue removed. Views run with
-- the privileges of their owner (not the querying role) unless marked
-- security_invoker, so this view intentionally bypasses per-row RLS on the
-- base table and instead IS the access boundary — the base table's
-- advertiser policy is dropped.

DROP POLICY IF EXISTS "Advertisers see live screens" ON public.screens;

CREATE OR REPLACE VIEW public.advertiser_screens AS
SELECT
  id, name, owner_id, owner_name, owner_type, city_id, city, location, status,
  lat, lon, impressions, own_slots, blocked_categories,
  max_ad_duration, min_dwell_time, allow_competitors, created_at, updated_at,
  operator_id, cpm_floor, display_size, monthly_traffic_estimate,
  content_categories_blocked, operating_hours_start, operating_hours_end, lng,
  last_seen, health_status, venue_category, venue_subtype, environment,
  screen_position, state, country, screen_photos, auto_approve, timezone
FROM public.screens
WHERE status = 'live';

GRANT SELECT ON public.advertiser_screens TO authenticated;
