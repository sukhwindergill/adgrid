-- Security-audit finding: operator_invites and screen_invites both had a
-- SELECT RLS policy named "Anyone can read invite by token" / "Anyone can
-- read screen invite by token" with USING (true) -- intended to let an
-- unauthenticated visitor look up the one invite they hold a token for,
-- but RLS can't enforce "the caller actually filtered by token": with
-- anon granted table SELECT and qual=true, a bare
-- GET /rest/v1/operator_invites (no query filter at all) returned every
-- pending invite row in the table -- including the token column itself,
-- for every operator and screen invite in the system, to any
-- unauthenticated caller. Since accept-operator-invite/accept-screen-invite
-- trust the token as sole proof of identity, harvesting it this way lets
-- an attacker hijack any pending invite (claim someone else's operator
-- invite by email, or claim/convert someone else's screen invite) --
-- the exact same "qual=true with no ownership scope" class of bug as
-- advertiser_screens and marketplace_confirm_booking, found earlier
-- today.
--
-- Fix: drop the blanket policies and revoke SELECT from anon/authenticated
-- entirely, replacing the direct table read with a SECURITY DEFINER
-- function that requires the caller to supply the exact token and returns
-- only the same non-sensitive columns the client already displayed
-- (never the token itself). A caller who doesn't already hold the token
-- can no longer enumerate it. Matches the same token-scoped-RPC pattern
-- already used elsewhere in this codebase (e.g.
-- get_screen_invite_advertiser_names).

DROP POLICY IF EXISTS "Anyone can read invite by token" ON public.operator_invites;
REVOKE SELECT ON public.operator_invites FROM anon;

DROP POLICY IF EXISTS "Anyone can read screen invite by token" ON public.screen_invites;
REVOKE SELECT ON public.screen_invites FROM anon;
-- authenticated keeps table-level SELECT (needed for the operator's own
-- "manage own screen invites" / platform-owner policies elsewhere), but
-- with the blanket policy gone, RLS now falls through to those
-- ownership-scoped policies for everyone else.

CREATE OR REPLACE FUNCTION public.lookup_operator_invite_by_token(p_token text)
RETURNS TABLE(email text, status text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_token IS NULL OR length(p_token) = 0 THEN
    RETURN;
  END IF;

  IF NOT public.check_rate_limit('lookup_operator_invite_by_token:' || p_token, 30, 3600) THEN
    RAISE EXCEPTION 'Too many requests';
  END IF;

  RETURN QUERY
    SELECT oi.email, oi.status::text, oi.expires_at
    FROM public.operator_invites oi
    WHERE oi.token = p_token
    LIMIT 1;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.lookup_operator_invite_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_operator_invite_by_token(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.lookup_screen_invite_by_token(p_token text)
RETURNS TABLE(screen_id text, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_token IS NULL OR length(p_token) = 0 THEN
    RETURN;
  END IF;

  IF NOT public.check_rate_limit('lookup_screen_invite_by_token:' || p_token, 30, 3600) THEN
    RAISE EXCEPTION 'Too many requests';
  END IF;

  RETURN QUERY
    SELECT si.screen_id, si.status
    FROM public.screen_invites si
    WHERE si.token = p_token
    LIMIT 1;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.lookup_screen_invite_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_screen_invite_by_token(text) TO anon, authenticated;
