
alter table public.screens
  add column if not exists is_demo boolean not null default false;

create or replace view public.advertiser_screens as
 select id, name, owner_id, owner_name, owner_type, city_id, city, location, status, lat, lon,
    impressions, own_slots, blocked_categories, max_ad_duration, min_dwell_time, allow_competitors,
    created_at, updated_at, operator_id, cpm_floor, display_size, monthly_traffic_estimate,
    content_categories_blocked, operating_hours_start, operating_hours_end, lng, last_seen,
    health_status, venue_category, venue_subtype, environment, screen_position, state, country,
    screen_photos, auto_approve, timezone, resolution_w, resolution_h, accepted_formats, max_file_mb,
    screen_photo_frames, is_demo
   from public.screens
  where status = 'live'::text;
