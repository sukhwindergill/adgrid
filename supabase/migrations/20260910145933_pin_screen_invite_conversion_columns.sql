-- Security-audit finding, continuing the ongoing sweep: screen_invites'
-- only write policy ("Operators manage own screen invites", FOR ALL) is
-- scoped only to "the invite's screen_id belongs to the caller" -- with no
-- column restriction, and no re-check of any of the business rules the
-- real conversion-tracking functions (record-screen-invite-view,
-- accept-screen-invite, mark-screen-invite-booked -- all service_role)
-- enforce. An operator could directly UPDATE their own screen's invite
-- rows to forge status/view_count/converted_advertiser_id/
-- converted_campaign_id, bypassing every one of those checks.
--
-- Two real consequences:
--   1. An operator can pad their own "bring your own advertiser" funnel
--      stats (ScreenDetail.jsx, Dashboard.jsx, inviteFunnel.js) with fake
--      views/signups/bookings that never happened.
--   2. Worse: get_screen_invite_advertiser_names (a SECURITY DEFINER RPC,
--      scoped to "invites on screens this operator owns") resolves
--      converted_advertiser_id to a real profiles.name with no check that
--      the id was ever legitimately set by accept-screen-invite. Setting
--      converted_advertiser_id to any known profile id and calling that
--      RPC discloses that person's name -- a real, if narrow, bypass of
--      profiles RLS (normally id = auth.uid() only) via a confused-deputy
--      path, for anyone whose uuid the operator happens to know.
--
-- Fix: pin the columns every legitimate write to this table only ever
-- sets server-side (status, view_count, viewed_at, signed_up_at,
-- booked_at, converted_advertiser_id, converted_campaign_id) against
-- direct client writes, exempting service_role. No client code writes any
-- of these directly (verified: ScreenDetail.jsx and Dashboard.jsx only
-- ever SELECT from screen_invites; every INSERT/UPDATE to it in the
-- codebase is inside create-screen-invite, record-screen-invite-view,
-- accept-screen-invite, and mark-screen-invite-booked, all service_role).
create or replace function public.pin_screen_invite_conversion_columns()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  new.status := old.status;
  new.view_count := old.view_count;
  new.viewed_at := old.viewed_at;
  new.signed_up_at := old.signed_up_at;
  new.booked_at := old.booked_at;
  new.converted_advertiser_id := old.converted_advertiser_id;
  new.converted_campaign_id := old.converted_campaign_id;
  return new;
end;
$function$;

drop trigger if exists trg_pin_screen_invite_conversion_columns on public.screen_invites;
create trigger trg_pin_screen_invite_conversion_columns
  before update on public.screen_invites
  for each row
  execute function public.pin_screen_invite_conversion_columns();
