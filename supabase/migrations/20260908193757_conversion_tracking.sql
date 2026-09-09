-- ============================================================
-- Conversion pixel + server postback (Competitive Parity Program, Phase 6,
-- G9 widen -- see docs/superpowers/specs/2026-09-08-conversion-pixel-
-- postback-design.md). AdGrid can already tell an advertiser how many
-- people scanned a screen's QR code, and can push that scan out to the
-- advertiser's own Meta/Google/Shopify pixels (fire-integration). This adds
-- the missing inbound path: an advertiser reporting a conversion back to
-- AdGrid, attributed either to a QR scan (adgrid_cid) or to a promo code /
-- vanity URL for people who never scanned.
-- ============================================================

-- Per-campaign promo codes / vanity paths an advertiser can print on their
-- creative for people who see the ad but don't scan.
CREATE TABLE IF NOT EXISTS public.campaign_promo_codes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   text NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  advertiser_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code          text NOT NULL,
  vanity_path   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS campaign_promo_codes_campaign_idx
  ON public.campaign_promo_codes (campaign_id);
CREATE INDEX IF NOT EXISTS campaign_promo_codes_vanity_path_idx
  ON public.campaign_promo_codes (vanity_path) WHERE vanity_path IS NOT NULL;

ALTER TABLE public.campaign_promo_codes ENABLE ROW LEVEL SECURITY;

-- Advertiser manages their own campaigns' promo codes.
DROP POLICY IF EXISTS "advertiser_own_promo_codes" ON public.campaign_promo_codes;
CREATE POLICY "advertiser_own_promo_codes" ON public.campaign_promo_codes
  FOR ALL
  TO authenticated
  USING (advertiser_id = auth.uid())
  WITH CHECK (advertiser_id = auth.uid());

-- Public read by code/vanity_path only -- the unauthenticated conversion
-- pixel and vanity-redirect edge functions need to resolve a code to a
-- campaign without an advertiser session. Same "anyone can read by token"
-- shape already used for operator_invites/screen_invites.
DROP POLICY IF EXISTS "public_reads_promo_code_by_value" ON public.campaign_promo_codes;
CREATE POLICY "public_reads_promo_code_by_value" ON public.campaign_promo_codes
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- One row per reported conversion, written only by the conversion-pixel /
-- conversion-postback edge functions (service role) -- never directly by a
-- client, so an advertiser can't fabricate their own conversion counts by
-- writing rows straight into the table.
CREATE TABLE IF NOT EXISTS public.conversions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id       text NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  advertiser_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scan_id           uuid REFERENCES public.scans(id) ON DELETE SET NULL,
  promo_code_id     uuid REFERENCES public.campaign_promo_codes(id) ON DELETE SET NULL,
  source            text NOT NULL CHECK (source IN ('scan', 'promo_code', 'vanity_url')),
  order_value       numeric,
  currency          text,
  external_order_id text,
  verified          boolean NOT NULL DEFAULT false,
  received_via      text NOT NULL CHECK (received_via IN ('pixel', 'postback')),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversions_advertiser_idx
  ON public.conversions (advertiser_id, created_at DESC);
CREATE INDEX IF NOT EXISTS conversions_campaign_idx
  ON public.conversions (campaign_id);

ALTER TABLE public.conversions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "advertiser_reads_own_conversions" ON public.conversions;
CREATE POLICY "advertiser_reads_own_conversions" ON public.conversions
  FOR SELECT
  TO authenticated
  USING (advertiser_id = auth.uid());

DROP POLICY IF EXISTS "service_manages_conversions" ON public.conversions;
CREATE POLICY "service_manages_conversions" ON public.conversions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
