-- The creative-spec columns added in 20260727000000 (resolution_w,
-- resolution_h, accepted_formats, max_file_mb) were never added to the
-- advertiser_screens view's explicit column list, so the wizard's fit-check
-- (src/lib/creativeFit.js, wired in via CreateCampaign.jsx) would have seen
-- every screen as spec-'unknown' forever, regardless of what an operator
-- configured — even though the columns exist and are populated on `screens`.

CREATE OR REPLACE VIEW public.advertiser_screens AS
SELECT
  id, name, owner_id, owner_name, owner_type, city_id, city, location, status,
  lat, lon, impressions, own_slots, blocked_categories,
  max_ad_duration, min_dwell_time, allow_competitors, created_at, updated_at,
  operator_id, cpm_floor, display_size, monthly_traffic_estimate,
  content_categories_blocked, operating_hours_start, operating_hours_end, lng,
  last_seen, health_status, venue_category, venue_subtype, environment,
  screen_position, state, country, screen_photos, auto_approve, timezone,
  resolution_w, resolution_h, accepted_formats, max_file_mb
FROM public.screens
WHERE status = 'live';

GRANT SELECT ON public.advertiser_screens TO authenticated;
