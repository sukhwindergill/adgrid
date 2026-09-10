-- Product-audit finding, continuing the ongoing sweep: bookings has no
-- platform-owner SELECT policy -- only advertiser-own, grant-based, and
-- operator-screen-scoped reads. DisputeQueue.jsx (routed behind
-- RequirePlatformOwner) fetches the booking behind each dispute to show
-- the advertiser name, screen name, and disputed budget -- context a
-- reviewer needs to actually decide a dispute. Under RLS this booking
-- lookup returns nothing for any dispute whose booking isn't the platform
-- owner's own (i.e. every real dispute), so the queue silently falls back
-- to displaying the raw booking_id UUID instead of anything a human could
-- use to make a resolution call. Same missing-platform-owner-read pattern
-- already fixed this session for impersonation_logs and profiles.
--
-- is_platform_owner() is defined identically in
-- 20260910161547_platform_owner_reads_profiles.sql -- CREATE OR REPLACE
-- here too so this migration is self-contained regardless of which of
-- the two merges first.
create or replace function public.is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(
    (select is_platform_owner from public.profiles where id = auth.uid()),
    false
  );
$function$;

revoke all on function public.is_platform_owner() from public;
grant execute on function public.is_platform_owner() to authenticated;

create policy "platform_owner_reads_all_bookings" on public.bookings
  for select
  using (public.is_platform_owner());
