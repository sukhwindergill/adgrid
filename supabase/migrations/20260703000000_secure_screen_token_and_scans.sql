-- Go-live security hardening (2026-07-03)
--
-- BLOCKER: `screens.screen_token` is the bearer secret used by the
-- unauthenticated display-feed and ingest-impressions endpoints. The table
-- previously had a table-wide SELECT grant to `anon`/`authenticated`, and the
-- "Advertisers see live screens" RLS policy lets ANY advertiser SELECT every
-- live screen row — so any signed-up user could harvest every live screen's
-- token and then forge impression stats or read arbitrary display feeds.
-- Row-level writes were already blocked (no advertiser UPDATE policy), so the
-- leak is read-only, but token theft alone enables impression fraud.
--
-- Fix: strip the token column out of the table-level SELECT grant (re-grant
-- SELECT on every other column) and expose it to its owning operator only via
-- a SECURITY DEFINER RPC.

-- 1a. Replace the table-wide SELECT grant with a column-scoped grant that omits screen_token.
REVOKE SELECT ON public.screens FROM anon, authenticated;
GRANT SELECT (
  id, name, owner_id, owner_name, owner_type, city_id, city, location, status,
  lat, lon, monthly_revenue, impressions, own_slots, blocked_categories,
  max_ad_duration, min_dwell_time, allow_competitors, created_at, updated_at,
  operator_id, cpm_floor, display_size, monthly_traffic_estimate,
  content_categories_blocked, operating_hours_start, operating_hours_end, lng,
  last_seen, health_status, venue_category, venue_subtype, environment,
  screen_position, state, country, screen_photos, auto_approve, timezone
) ON public.screens TO anon, authenticated;

-- 1b. Owner-scoped accessor for the token (used by the operator setup guide).
-- screens.id is a text column, so the parameter is text (not uuid).
CREATE OR REPLACE FUNCTION public.get_screen_token(p_screen_id text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.screen_token::text
  FROM public.screens s
  WHERE s.id = p_screen_id
    AND s.operator_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_screen_token(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_screen_token(text) TO authenticated;

-- 2. Scope operator scan visibility to their OWN screens.
-- "operator_all_scans" let any operator read every advertiser's and every other
-- operator's scan rows (device type, coarse geo). Cross-tenant data leak.
DROP POLICY IF EXISTS "operator_all_scans" ON public.scans;
CREATE POLICY "operator_own_screen_scans" ON public.scans
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.screens s
      WHERE s.id = scans.screen_id
        AND s.operator_id = auth.uid()
    )
  );

-- 3. Remove SECURITY DEFINER from unused legacy reporting views (advisor ERROR).
-- Neither view is referenced by the app; invoker semantics enforce the caller's RLS.
ALTER VIEW IF EXISTS public.campaign_stats   SET (security_invoker = on);
ALTER VIEW IF EXISTS public.presence_current SET (security_invoker = on);

-- 4. Stop public storage buckets from being enumerable. Objects stay reachable
-- by public URL (buckets are public); dropping the broad SELECT policy only
-- removes the ability to LIST every file. The app uploads + getPublicUrl only.
DROP POLICY IF EXISTS "Public read creatives"     ON storage.objects;
DROP POLICY IF EXISTS "Public read screen photos" ON storage.objects;
