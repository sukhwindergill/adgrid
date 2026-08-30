-- Pixel dimensions of each multi-creative's uploaded media, captured
-- client-side at upload time (see src/lib/mediaDimensions.js) and stored
-- alongside media_url/media_type -- mirrors the columns already added to
-- bookings/campaign_screens in 20260727000001_creative_media_dimensions.sql.
-- Without this, the operator approval queue's per-creative fit check
-- (ApprovalQueue.jsx) can never know a specific assigned creative's real
-- dimensions.

ALTER TABLE public.campaign_creatives ADD COLUMN IF NOT EXISTS media_width  integer;
ALTER TABLE public.campaign_creatives ADD COLUMN IF NOT EXISTS media_height integer;
