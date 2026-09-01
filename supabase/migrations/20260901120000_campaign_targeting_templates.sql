-- ============================================================
-- Saved, reusable targeting configurations for the campaign wizard.
--
-- A media buyer running recurring campaigns previously had to rebuild
-- targeting (area + screen type) from scratch every time — the closest
-- thing that existed was per-browser localStorage drafts of an entire
-- in-progress wizard (campaignDrafts.js), not a named, cross-device,
-- reusable audience definition. This table is deliberately narrow: just
-- the "where and what kind of screen" fields from StepTargeting.jsx, not
-- budget, dayparting, or creative — those are flight-specific and don't
-- generalize the way an audience does.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.campaign_targeting_templates (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name               text NOT NULL,
  area_type          text NOT NULL,
  country            text,
  state              text,
  city               text,
  radius_center_lat  double precision,
  radius_center_lon  double precision,
  radius_km          integer,
  env_filter         text,
  venue_filter       text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS campaign_targeting_templates_advertiser_idx
  ON public.campaign_targeting_templates (advertiser_id, created_at DESC);

ALTER TABLE public.campaign_targeting_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "advertiser_manage_own_targeting_templates" ON public.campaign_targeting_templates;
CREATE POLICY "advertiser_manage_own_targeting_templates" ON public.campaign_targeting_templates
  FOR ALL
  USING (advertiser_id = auth.uid())
  WITH CHECK (advertiser_id = auth.uid());
