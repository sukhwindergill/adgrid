-- Ad render preview (2026-08-07 design spec): lets an advertiser see their
-- creative warped onto a photo of the actual screen before booking. Each
-- entry pairs a screen_photos URL with the 4 corners (normalized 0-1,
-- [TL, TR, BR, BL]) the operator marked around the physical screen in that
-- photo. A photo with no entry here simply isn't preview-eligible --
-- marking corners is optional per photo (see ScreenPhotoManager).

ALTER TABLE screens
  ADD COLUMN IF NOT EXISTS screen_photo_frames jsonb NOT NULL DEFAULT '[]';

CREATE OR REPLACE VIEW public.advertiser_screens AS
SELECT
  id, name, owner_id, owner_name, owner_type, city_id, city, location, status,
  lat, lon, impressions, own_slots, blocked_categories,
  max_ad_duration, min_dwell_time, allow_competitors, created_at, updated_at,
  operator_id, cpm_floor, display_size, monthly_traffic_estimate,
  content_categories_blocked, operating_hours_start, operating_hours_end, lng,
  last_seen, health_status, venue_category, venue_subtype, environment,
  screen_position, state, country, screen_photos, auto_approve, timezone,
  resolution_w, resolution_h, accepted_formats, max_file_mb, screen_photo_frames
FROM public.screens
WHERE status = 'live';

GRANT SELECT ON public.advertiser_screens TO authenticated;

GRANT SELECT (screen_photo_frames)
  ON public.screens TO anon, authenticated;
