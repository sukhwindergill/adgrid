-- ============================================================
-- Per-screen creative spec, so an advertiser's upload can be checked against
-- what a screen actually expects. All nullable, no default: a screen with
-- ANY of these unset is treated as "spec unknown" everywhere this is read —
-- see src/lib/creativeFit.js — never as a validation failure. All 12
-- production screens start with every field null.
--
-- Orientation is derived from resolution_w/resolution_h, not stored
-- separately. Video max duration reuses the existing max_ad_duration column.
-- ============================================================

ALTER TABLE public.screens ADD COLUMN IF NOT EXISTS resolution_w integer;
ALTER TABLE public.screens ADD COLUMN IF NOT EXISTS resolution_h integer;
ALTER TABLE public.screens ADD COLUMN IF NOT EXISTS accepted_formats text[];
ALTER TABLE public.screens ADD COLUMN IF NOT EXISTS max_file_mb integer;
