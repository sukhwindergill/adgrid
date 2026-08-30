-- Per-screen creative media overrides for the display feed.
-- bookings already carries campaign-level media_url/media_type; these let an
-- advertiser (or agency) swap the asset on a specific screen. display-feed
-- prefers the campaign_screens value over the booking value.
ALTER TABLE public.campaign_screens ADD COLUMN IF NOT EXISTS media_url  text;
ALTER TABLE public.campaign_screens ADD COLUMN IF NOT EXISTS media_type text;
