-- Screen invite landing pages (src/views/invite/ScreenInvitePage.jsx) query
-- `screens` directly, unauthenticated, before the visitor has an account.
-- Neither existing policy on `screens` permits an anonymous read at all
-- (both require a non-null auth.uid()), so the landing page could never
-- reach its "valid" state -- found live during Task 8's implementation.
--
-- Scope the new policy to only screens that actually have an invite --
-- this doesn't expose anything beyond what's already accepted as exposed:
-- screen_invites' own "Anyone can read screen invite by token" policy
-- (20260811000001_screen_invites_schema.sql) already accepts that anyone
-- can bulk-read every screen_id that has an invite, by the same
-- accepted-tradeoff reasoning documented there. This policy just lets the
-- same already-visible screen_ids resolve to their (already anon-column-
-- granted) name/city/venue_category/photos, not the whole `screens` table.
--
-- A direct `exists (select 1 from screen_invites where screen_id =
-- screens.id)` subquery in the USING clause causes infinite recursion
-- (42P17): evaluating it triggers screen_invites' own RLS, whose
-- "Operators manage own screen invites" policy (fixed in
-- 20260811000001_screen_invites_schema.sql after Task 1's review) queries
-- screens right back -- the exact circular-RLS bug class this codebase
-- already hit once before (B7, operator dashboard outage, session 5).
-- Confirmed live before shipping this: the direct-subquery version
-- recursion-errors under both anon and authenticated roles; wrapping the
-- check in a SECURITY DEFINER function (owned by the same role that owns
-- every table here, so its inner query bypasses screen_invites' RLS
-- instead of re-triggering it) does not recurse, verified against real
-- data under both roles before this file was written.
-- Despite the name (kept for symmetry with the policy label below), this
-- does not filter by status -- it returns true for a 'booked' invite too,
-- same as screen_invites' own unfiltered public-read policy. Harmless
-- today (the frontend already short-circuits on 'booked' before ever
-- querying screens), but don't assume "active" means "not yet booked".
create or replace function public.screen_has_active_invite(p_screen_id text)
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $$
  select exists (select 1 from screen_invites where screen_id = p_screen_id);
$$;

-- Explicit, self-documenting grant: anon access is intentional (it's the
-- entire reason this function exists), not an unstated Postgres default --
-- matches this codebase's own convention of never leaving a SECURITY
-- DEFINER function's EXECUTE grant implicit (see get_screen_token,
-- revoke_anon_lookup_profile_by_email, etc.).
grant execute on function public.screen_has_active_invite(text) to anon, authenticated;

create policy "Public read screens with an active invite"
  on screens for select
  using (public.screen_has_active_invite(screens.id));
