-- Pixel dimensions of the uploaded creative, captured client-side at upload
-- time (see src/lib/mediaDimensions.js) and stored alongside the existing
-- media_url/media_type columns. Without this, checking fit anywhere other
-- than the upload moment (e.g. the operator's approval queue) would require
-- re-fetching and re-decoding the file.

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS media_width  integer;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS media_height integer;

ALTER TABLE public.campaign_screens ADD COLUMN IF NOT EXISTS media_width  integer;
ALTER TABLE public.campaign_screens ADD COLUMN IF NOT EXISTS media_height integer;
