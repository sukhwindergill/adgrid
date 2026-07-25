-- ============================================================
-- Proof of play. One row per creative play on one screen.
--
-- This is NOT audience data. It records that a creative was displayed,
-- for how long, and whether it completed. Audience is derived separately
-- from impression_events (camera) or modelled — never inferred from a play.
-- ============================================================

-- NOTE: bookings.id and screens.id are `text` in this database, not uuid.
-- The foreign key column types must match exactly.
CREATE TABLE IF NOT EXISTS public.ad_plays (
  id             bigserial PRIMARY KEY,
  campaign_id    text NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  screen_id      text NOT NULL REFERENCES public.screens(id) ON DELETE CASCADE,
  played_at      timestamptz NOT NULL,
  duration_s     numeric NOT NULL CHECK (duration_s > 0 AND duration_s <= 300),
  completed      boolean NOT NULL DEFAULT true,
  client_play_id text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ad_plays_client_unique UNIQUE (screen_id, client_play_id)
);

CREATE INDEX IF NOT EXISTS ad_plays_campaign_played_idx ON public.ad_plays (campaign_id, played_at DESC);
CREATE INDEX IF NOT EXISTS ad_plays_screen_played_idx   ON public.ad_plays (screen_id, played_at DESC);

ALTER TABLE public.ad_plays ENABLE ROW LEVEL SECURITY;

-- Only the service role writes plays (via the ingest-plays edge function,
-- which authenticates the caller by screen_token). No anon/authenticated insert.
REVOKE INSERT, UPDATE, DELETE ON public.ad_plays FROM anon, authenticated;

DROP POLICY IF EXISTS "operator_view_own_screen_plays" ON public.ad_plays;
CREATE POLICY "operator_view_own_screen_plays" ON public.ad_plays
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.screens s
      WHERE s.id = ad_plays.screen_id AND s.operator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "advertiser_view_own_campaign_plays" ON public.ad_plays;
CREATE POLICY "advertiser_view_own_campaign_plays" ON public.ad_plays
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = ad_plays.campaign_id AND b.advertiser_id = auth.uid()
    )
  );
