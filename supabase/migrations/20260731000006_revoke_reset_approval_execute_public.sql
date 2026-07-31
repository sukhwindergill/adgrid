-- Postgres grants EXECUTE to PUBLIC by default on function creation, so
-- revoking from anon/authenticated alone (prior migration) was a no-op — both
-- roles still inherited access through PUBLIC. Revoke PUBLIC too.
REVOKE EXECUTE ON FUNCTION reset_screen_approval_on_creative_change() FROM PUBLIC;
