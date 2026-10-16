-- TV-style screen pairing (supabase/functions/screen-pairing).
--
-- A display opens /pair, gets a short code (shown on screen) plus a device
-- secret (kept in the display's browser). The operator types the code into
-- the dashboard, which claims it for one of their screens; the display then
-- polls with its secret and receives that screen's screen_token.
--
-- Codes live 15 minutes. Rows are service-role only: the table holds the
-- link from a guessable 6-char code to a screen, and only the Edge Function
-- may read or write it (it checks the device secret / screen ownership).

CREATE TABLE IF NOT EXISTS public.pairing_codes (
  code              text PRIMARY KEY
                    CHECK (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$'),
  -- SHA-256 hex of the device secret; the secret itself is never stored.
  secret_hash       text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL,
  claimed_screen_id text REFERENCES public.screens(id) ON DELETE CASCADE,
  claimed_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at        timestamptz,
  delivered_at      timestamptz,
  CHECK (expires_at > created_at),
  CHECK ((claimed_screen_id IS NULL) = (claimed_at IS NULL))
);

CREATE INDEX IF NOT EXISTS pairing_codes_expires_at_idx ON public.pairing_codes (expires_at);

ALTER TABLE public.pairing_codes ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: anon/authenticated get nothing even if a grant
-- slips in later. Belt and braces, revoke the grants too.
REVOKE ALL ON public.pairing_codes FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.pairing_codes TO service_role;
