-- Screen Detail's operator-facing invite list (Task 13,
-- src/views/operator/ScreenDetail.jsx) needs to show which advertiser an
-- invite converted to. A direct embed (`converted_advertiser:converted_advertiser_id(name)`)
-- can't work: `profiles` RLS only allows `id = auth.uid()` reads
-- (20260701000002_scope_profiles_lookup.sql, a deliberate fix closing a
-- broad cross-profile exposure -- email, stripe_customer_id, etc.).
-- Reopening that broadly would undo that fix. Instead, scope exactly what's
-- needed: an operator may see the *name* of an advertiser who converted via
-- one of their own screens' invites, nothing else about that profile.
create or replace function public.get_screen_invite_advertiser_names(p_screen_id text)
returns table(invite_id uuid, advertiser_name text)
language sql
stable
security definer
set search_path = 'public'
as $$
  select si.id, p.name
  from screen_invites si
  join screens s on s.id = si.screen_id
  join profiles p on p.id = si.converted_advertiser_id
  where si.screen_id = p_screen_id
    and s.operator_id = auth.uid()
    and si.converted_advertiser_id is not null;
$$;

grant execute on function public.get_screen_invite_advertiser_names(text) to authenticated;
