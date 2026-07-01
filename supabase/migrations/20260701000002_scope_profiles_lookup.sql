-- "Operators can read all profiles" granted SELECT on every column of every
-- user's profile (email, company, stripe_customer_id, stripe_connect_account_id,
-- verification_status, etc.) to any user with role='operator', platform-wide.
--
-- The only real dependency was GrantAccessModal.jsx's "invite by email" lookup
-- for the multi-account grant feature — and that feature is available to ALL
-- account types (advertiser and operator), not just operators, so the broad
-- policy was actually the wrong shape even for its intended purpose:
-- advertiser-initiated grants were silently failing (RLS filtered out the
-- lookup row, so it always looked like "No AdGrid account found").
--
-- Replace with a SECURITY DEFINER function that exposes only id/name/email
-- for an exact-match email lookup — the minimum needed to invite a known
-- collaborator by email, callable by any authenticated user.

DROP POLICY IF EXISTS "Operators can read all profiles" ON public.profiles;

CREATE OR REPLACE FUNCTION public.lookup_profile_by_email(lookup_email text)
RETURNS TABLE(id uuid, name text, email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, email
  FROM profiles
  WHERE email = lower(lookup_email)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_profile_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_profile_by_email(text) TO authenticated;
