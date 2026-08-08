-- supabase/migrations/20260808000000_creative_qr_color_columns.sql
-- QR foreground (dots) / background color, advertiser-controlled per
-- creative. Nullable so an unset value falls back to
-- getCreativeRenderPlan's default (qrFgColor: the creative's own accent
-- color, qrBgColor: white) -- every existing row keeps rendering exactly
-- as it does today (black-on-white via react-qr-code's own defaults was
-- never actually stored; it only ever came from the library's props being
-- unset), no backfill needed.
--
-- Format-checked as a 6-digit hex string (`#rrggbb`) rather than range-
-- checked like qr_x/qr_y/qr_size_pct, since color has no numeric range --
-- an invalid string here would otherwise reach react-qr-code's fgColor/
-- bgColor props unchecked.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS qr_fg_color text,
  ADD COLUMN IF NOT EXISTS qr_bg_color text;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_qr_fg_color_format;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_qr_fg_color_format CHECK (qr_fg_color IS NULL OR qr_fg_color ~* '^#[0-9a-f]{6}$');

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_qr_bg_color_format;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_qr_bg_color_format CHECK (qr_bg_color IS NULL OR qr_bg_color ~* '^#[0-9a-f]{6}$');

ALTER TABLE public.campaign_creatives
  ADD COLUMN IF NOT EXISTS qr_fg_color text,
  ADD COLUMN IF NOT EXISTS qr_bg_color text;

ALTER TABLE public.campaign_creatives
  DROP CONSTRAINT IF EXISTS campaign_creatives_qr_fg_color_format;
ALTER TABLE public.campaign_creatives
  ADD CONSTRAINT campaign_creatives_qr_fg_color_format CHECK (qr_fg_color IS NULL OR qr_fg_color ~* '^#[0-9a-f]{6}$');

ALTER TABLE public.campaign_creatives
  DROP CONSTRAINT IF EXISTS campaign_creatives_qr_bg_color_format;
ALTER TABLE public.campaign_creatives
  ADD CONSTRAINT campaign_creatives_qr_bg_color_format CHECK (qr_bg_color IS NULL OR qr_bg_color ~* '^#[0-9a-f]{6}$');
