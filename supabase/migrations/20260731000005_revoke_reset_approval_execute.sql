-- reset_screen_approval_on_creative_change is SECURITY DEFINER and only meant
-- to run as a trigger. Without this revoke it's callable directly via
-- PostgREST RPC by anon/authenticated, bypassing RLS to force-reset arbitrary
-- campaign_screens.status rows.
REVOKE EXECUTE ON FUNCTION reset_screen_approval_on_creative_change() FROM anon, authenticated;
