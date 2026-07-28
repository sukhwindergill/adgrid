-- Brand kit for Creative Studio: seeds a new campaign draft's accent/
-- secondary colors and headline font. All nullable/defaulted so existing
-- profiles need no backfill -- an advertiser who never visits the Brand Kit
-- settings tab just keeps today's hardcoded '#7c3aed' / Georgia-serif
-- behavior (see CreateCampaign.jsx's brand-kit-seeding effect and
-- bookings.creative_font's own 'serif' default in the next migration).

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS brand_color_1 text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS brand_color_2 text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS brand_font text DEFAULT 'sans';

ALTER TABLE public.profiles ADD CONSTRAINT profiles_brand_font_check
  CHECK (brand_font IN ('sans', 'serif', 'mono'));
