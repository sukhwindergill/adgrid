-- ============================================================
-- Programmatic backfill (Competitive Parity Program, Phase 6, G20 -- see
-- docs/superpowers/specs/2026-09-08-programmatic-backfill-design.md).
-- Unsold loop time (after paid AdGrid campaigns and an operator's own
-- house ads) can be filled by external programmatic demand instead of
-- the idle slide. v1 is an SSP supply-API adapter pattern, not a live
-- per-impression OpenRTB auction -- see the spec's scope decision.
-- ============================================================

-- Platform-admin-managed partner config. Seeded manually per real
-- partner agreement, not self-serve -- no advertiser/operator RLS
-- needed beyond service-role.
CREATE TABLE IF NOT EXISTS public.programmatic_partners (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  adapter_key  text NOT NULL UNIQUE,
  api_base_url text,
  enabled      boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.programmatic_partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_manages_programmatic_partners" ON public.programmatic_partners;
CREATE POLICY "service_manages_programmatic_partners" ON public.programmatic_partners
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Per-screen operator opt-in. Off by default -- unsold time keeps
-- showing the idle slide/house ad until the operator explicitly turns
-- this on, same shape as house_ad_max_pct only mattering once an
-- operator has created a house ad.
ALTER TABLE public.screens ADD COLUMN IF NOT EXISTS programmatic_backfill_enabled boolean NOT NULL DEFAULT false;

-- Short-lived fetched fills. Populated by the fetch-programmatic-fill
-- scheduled function, read by display-feed -- both service-role
-- contexts. No advertiser or operator ever queries this table directly;
-- they see the resulting revenue via Revenue.jsx, not this table.
CREATE TABLE IF NOT EXISTS public.programmatic_fills (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  screen_id           text NOT NULL REFERENCES public.screens(id) ON DELETE CASCADE,
  partner_id          uuid NOT NULL REFERENCES public.programmatic_partners(id),
  external_creative_id text,
  media_url           text NOT NULL,
  media_type          text NOT NULL CHECK (media_type IN ('image', 'video')),
  duration            integer NOT NULL,
  cpm                 numeric NOT NULL,
  fetched_at          timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL,
  played              boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS programmatic_fills_screen_idx
  ON public.programmatic_fills (screen_id, expires_at) WHERE played = false;

ALTER TABLE public.programmatic_fills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_manages_programmatic_fills" ON public.programmatic_fills;
CREATE POLICY "service_manages_programmatic_fills" ON public.programmatic_fills
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
