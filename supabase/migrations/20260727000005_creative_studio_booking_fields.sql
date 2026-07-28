-- Creative Studio: per-campaign template choice and secondary color, plus a
-- font snapshot taken from the advertiser's brand kit at submit time (not a
-- live join -- same reasoning as accent_color already being its own column
-- instead of read from profiles). Defaults 'bottom_bar'/'serif' preserve
-- every existing row's current rendering exactly -- see
-- docs/superpowers/specs/2026-07-27-creative-studio-templates-design.md.

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS creative_template text DEFAULT 'bottom_bar';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS secondary_color text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS creative_font text DEFAULT 'serif';

-- ADD CONSTRAINT has no IF NOT EXISTS, so guard it for re-runs.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_creative_template_check'
  ) THEN
    ALTER TABLE public.bookings ADD CONSTRAINT bookings_creative_template_check
      CHECK (creative_template IN ('bottom_bar', 'full_bleed', 'split_panel'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_creative_font_check'
  ) THEN
    ALTER TABLE public.bookings ADD CONSTRAINT bookings_creative_font_check
      CHECK (creative_font IN ('sans', 'serif', 'mono'));
  END IF;
END $$;
