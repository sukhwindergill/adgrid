-- lookup_profile_by_email is SECURITY DEFINER with no auth check of its own
-- (it's meant to be called by an already-logged-in user inviting a teammate
-- via GrantAccessModal.jsx) -- but the default grant left it callable by
-- anon too, turning it into an unauthenticated email-enumeration/PII-leak
-- endpoint (id, name, email for any registered address, no rate limit).
-- authenticated keeps EXECUTE; that's the real use case.
REVOKE EXECUTE ON FUNCTION public.lookup_profile_by_email(text) FROM anon;
