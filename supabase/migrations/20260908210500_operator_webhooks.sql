-- ============================================================
-- Operator webhook integration (product-audit follow-up spec --
-- docs/superpowers/specs/2026-09-08-operator-webhook-integration-
-- design.md). One webhook URL + optional HMAC secret per operator,
-- fired alongside the existing in-app notification/email for a fixed
-- set of operator-relevant events already dispatched through
-- send-notification.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.operator_webhooks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id  uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  webhook_url  text NOT NULL,
  secret       text,
  enabled      boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operator_webhooks ENABLE ROW LEVEL SECURITY;

-- Operator manages their own webhook config directly (same shape
-- advertiser_integrations already uses for the advertiser side).
DROP POLICY IF EXISTS "operator_own_webhook" ON public.operator_webhooks;
CREATE POLICY "operator_own_webhook" ON public.operator_webhooks
  FOR ALL
  TO authenticated
  USING (operator_id = auth.uid())
  WITH CHECK (operator_id = auth.uid());

-- send-notification runs service-role and looks up a webhook by
-- operator_id to decide whether to fire -- same trust model already
-- established for every other service-role-only credential lookup in
-- this codebase (api_keys, advertiser_integrations postback config).
DROP POLICY IF EXISTS "service_reads_operator_webhooks" ON public.operator_webhooks;
CREATE POLICY "service_reads_operator_webhooks" ON public.operator_webhooks
  FOR SELECT
  TO service_role
  USING (true);
