-- ============================================================
-- One immutable row per (campaign, screen, closed day): what was expected,
-- what actually played, and what was credited back.
--
-- `credited_at` makes credit issuance idempotent — the reconciliation row may
-- be recomputed, but a credit is applied exactly once.
--
-- NOTE: campaign_id and screen_id are text, matching bookings.id / screens.id.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.delivery_reconciliation (
  id                bigserial PRIMARY KEY,
  campaign_id       text NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  screen_id         text NOT NULL REFERENCES public.screens(id) ON DELETE CASCADE,
  day               date NOT NULL,
  expected_plays    integer NOT NULL DEFAULT 0,
  delivered_plays   integer NOT NULL DEFAULT 0,
  shortfall_pct     numeric NOT NULL DEFAULT 0 CHECK (shortfall_pct >= 0 AND shortfall_pct <= 1),
  screen_day_budget numeric NOT NULL DEFAULT 0,
  credit_amount     numeric NOT NULL DEFAULT 0 CHECK (credit_amount >= 0),
  currency          text,
  reason            text,          -- 'screen_offline' | 'underdelivered' | 'met'
  credited_to       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  credited_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delivery_reconciliation_unique UNIQUE (campaign_id, screen_id, day)
);

CREATE INDEX IF NOT EXISTS delivery_reconciliation_campaign_idx
  ON public.delivery_reconciliation (campaign_id, day DESC);
CREATE INDEX IF NOT EXISTS delivery_reconciliation_screen_idx
  ON public.delivery_reconciliation (screen_id, day DESC);

ALTER TABLE public.delivery_reconciliation ENABLE ROW LEVEL SECURITY;

-- Only the service role writes reconciliation rows.
REVOKE INSERT, UPDATE, DELETE ON public.delivery_reconciliation FROM anon, authenticated;
REVOKE ALL ON public.delivery_reconciliation FROM anon;
GRANT SELECT ON public.delivery_reconciliation TO authenticated;

DROP POLICY IF EXISTS "advertiser_view_own_reconciliation" ON public.delivery_reconciliation;
CREATE POLICY "advertiser_view_own_reconciliation" ON public.delivery_reconciliation
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = delivery_reconciliation.campaign_id
        AND b.advertiser_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "operator_view_own_screen_reconciliation" ON public.delivery_reconciliation;
CREATE POLICY "operator_view_own_screen_reconciliation" ON public.delivery_reconciliation
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.screens s
      WHERE s.id = delivery_reconciliation.screen_id
        AND s.operator_id = auth.uid()
    )
  );
