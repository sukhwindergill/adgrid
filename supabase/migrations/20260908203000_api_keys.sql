-- ============================================================
-- REST campaign API keys (Competitive Parity Program, Phase 6, G21 --
-- REST API half; see docs/superpowers/specs/2026-09-08-rest-campaign-
-- api-design.md). Scoped per-advertiser, generated/hashed client-side
-- (same precedent as the G9 conversion-postback key), shown once.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.api_keys (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name          text NOT NULL,
  key_prefix    text NOT NULL,
  key_hash      text NOT NULL,
  scopes        text[] NOT NULL DEFAULT '{campaigns:read,campaigns:write}',
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_keys_advertiser_idx ON public.api_keys (advertiser_id);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Advertiser manages their own keys' metadata (list, name, revoke). The
-- dashboard UI never renders key_hash -- only key_prefix/name/last_used_at/
-- revoked_at -- but the column is technically selectable via a broad
-- `select *` under this policy, same as screen_token and the G9 postback
-- key hash before it; noted here rather than silently repeating the
-- pattern a third time without naming it.
DROP POLICY IF EXISTS "advertiser_own_api_keys" ON public.api_keys;
CREATE POLICY "advertiser_own_api_keys" ON public.api_keys
  FOR ALL
  TO authenticated
  USING (advertiser_id = auth.uid())
  WITH CHECK (advertiser_id = auth.uid());

-- The api-campaigns edge function resolves a presented key to an
-- advertiser_id itself (service role), not via an authenticated session,
-- so it needs to read across all keys by hash -- same trust model
-- conversion-postback already established for a non-session bearer
-- credential.
DROP POLICY IF EXISTS "service_reads_api_keys" ON public.api_keys;
CREATE POLICY "service_reads_api_keys" ON public.api_keys
  FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS "service_updates_api_keys" ON public.api_keys;
CREATE POLICY "service_updates_api_keys" ON public.api_keys
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);
