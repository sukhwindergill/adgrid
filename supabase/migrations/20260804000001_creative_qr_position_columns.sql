-- supabase/migrations/20260804000001_creative_qr_position_columns.sql
-- QR code position/size, advertiser-controlled per creative. Nullable so an
-- unset value falls back to getCreativeRenderPlan's hardcoded top-right
-- default (qrX:90, qrY:14, qrSizePct:0.12, see src/lib/creativeQrPosition.js)
-- -- every existing row keeps rendering exactly as it does today, no
-- backfill needed.
--
-- qr_x/qr_y are the QR box's CENTER, as a percent of the creative frame's
-- width/height. qr_size_pct is the box's width as a fraction of the frame's
-- width (the box is square in pixels). Range matches
-- src/lib/creativeQrPosition.js's QR_SIZE_PCT_MIN/MAX so the database can
-- never hold a QR too small to scan or large enough to swallow the ad.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS qr_x numeric,
  ADD COLUMN IF NOT EXISTS qr_y numeric,
  ADD COLUMN IF NOT EXISTS qr_size_pct numeric;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_qr_x_range;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_qr_x_range CHECK (qr_x IS NULL OR (qr_x >= 0 AND qr_x <= 100));

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_qr_y_range;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_qr_y_range CHECK (qr_y IS NULL OR (qr_y >= 0 AND qr_y <= 100));

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_qr_size_pct_range;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_qr_size_pct_range CHECK (qr_size_pct IS NULL OR (qr_size_pct >= 0.08 AND qr_size_pct <= 0.3));

ALTER TABLE public.campaign_creatives
  ADD COLUMN IF NOT EXISTS qr_x numeric,
  ADD COLUMN IF NOT EXISTS qr_y numeric,
  ADD COLUMN IF NOT EXISTS qr_size_pct numeric;

ALTER TABLE public.campaign_creatives
  DROP CONSTRAINT IF EXISTS campaign_creatives_qr_x_range;
ALTER TABLE public.campaign_creatives
  ADD CONSTRAINT campaign_creatives_qr_x_range CHECK (qr_x IS NULL OR (qr_x >= 0 AND qr_x <= 100));

ALTER TABLE public.campaign_creatives
  DROP CONSTRAINT IF EXISTS campaign_creatives_qr_y_range;
ALTER TABLE public.campaign_creatives
  ADD CONSTRAINT campaign_creatives_qr_y_range CHECK (qr_y IS NULL OR (qr_y >= 0 AND qr_y <= 100));

ALTER TABLE public.campaign_creatives
  DROP CONSTRAINT IF EXISTS campaign_creatives_qr_size_pct_range;
ALTER TABLE public.campaign_creatives
  ADD CONSTRAINT campaign_creatives_qr_size_pct_range CHECK (qr_size_pct IS NULL OR (qr_size_pct >= 0.08 AND qr_size_pct <= 0.3));
