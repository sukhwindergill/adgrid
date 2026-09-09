-- Security-audit finding: lookup_profile_by_email(email) is a SECURITY
-- DEFINER function (used by GrantAccessModal.jsx to resolve a grantee by
-- email before creating an account_grants row) callable by any
-- authenticated user for *any* email address, with no rate limiting and
-- no restriction beyond "you must be signed in." That makes it a plain
-- email-enumeration oracle: an attacker with a list of email addresses
-- could hammer it to learn which ones have an AdGrid account (and the
-- account holder's display name), unlike every other client-facing
-- endpoint in this codebase, which rate-limits exactly this kind of
-- lookup (see rateLimited() in supabase/functions/_shared/rateLimit.ts,
-- used by every edge function that takes a caller-supplied identifier).
--
-- Adds the same rate-limit primitive (check_rate_limit, already used by
-- every edge function's rateLimited() helper) directly inside the
-- function, keyed per calling user, and makes the auth requirement
-- explicit rather than relying only on the EXECUTE grant.

CREATE OR REPLACE FUNCTION public.lookup_profile_by_email(lookup_email text)
RETURNS TABLE(id uuid, name text, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  IF NOT public.check_rate_limit('lookup_profile_by_email:' || auth.uid()::text, 20, 3600) THEN
    RAISE EXCEPTION 'Too many requests';
  END IF;

  RETURN QUERY
    SELECT p.id, p.name, p.email
    FROM public.profiles p
    WHERE p.email = lower(lookup_email)
    LIMIT 1;
END;
$function$;
