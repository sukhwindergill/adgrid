-- ============================================================
-- Read-only campaign share links.
--
-- A row here grants anonymous read access to ONE campaign's aggregate report
-- via the campaign-report edge function. Tokens expire, are revocable, and are
-- never exposed to anon through the table itself — only the function reads it,
-- using the service role.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.campaign_share_tokens (
  token       text PRIMARY KEY,
  campaign_id text NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  created_by  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at  timestamptz,
  revoked_at  timestamptz,
  last_viewed_at timestamptz,
  view_count  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS campaign_share_tokens_campaign_idx
  ON public.campaign_share_tokens (campaign_id);

ALTER TABLE public.campaign_share_tokens ENABLE ROW LEVEL SECURITY;

-- anon must never read this table directly — that would leak every live token.
-- Verified against the live database: anon SELECT returns "permission denied".
REVOKE ALL ON public.campaign_share_tokens FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.campaign_share_tokens TO authenticated;

-- An advertiser manages links for their own campaigns only.
DROP POLICY IF EXISTS "advertiser_select_own_share_tokens" ON public.campaign_share_tokens;
CREATE POLICY "advertiser_select_own_share_tokens" ON public.campaign_share_tokens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = campaign_share_tokens.campaign_id AND b.advertiser_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "advertiser_insert_own_share_tokens" ON public.campaign_share_tokens;
CREATE POLICY "advertiser_insert_own_share_tokens" ON public.campaign_share_tokens
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = campaign_share_tokens.campaign_id AND b.advertiser_id = auth.uid()
    )
  );

-- Update exists so an owner can revoke. The USING clause keeps that scoped.
DROP POLICY IF EXISTS "advertiser_update_own_share_tokens" ON public.campaign_share_tokens;
CREATE POLICY "advertiser_update_own_share_tokens" ON public.campaign_share_tokens
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = campaign_share_tokens.campaign_id AND b.advertiser_id = auth.uid()
    )
  );
