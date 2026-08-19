-- get_screen_invite_advertiser_names (20260812003632) granted EXECUTE to
-- authenticated but never revoked the implicit PUBLIC grant Postgres
-- attaches at CREATE FUNCTION time, leaving anon with EXECUTE too. Low
-- blast radius today (anon's auth.uid() is null, so the function's WHERE
-- clause returns zero rows) but still a real policy violation for a
-- SECURITY DEFINER function. Same footgun/fix pattern as
-- 20260731000006_revoke_reset_approval_execute_public.sql and
-- get_screen_token (20260703000000_secure_screen_token_and_scans.sql).
revoke execute on function public.get_screen_invite_advertiser_names(text) from public, anon;
