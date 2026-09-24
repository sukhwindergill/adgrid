-- Demo screens (screens.is_demo) are seeded fake inventory, but they are
-- status='live' and so visible through advertiser_screens to anyone who turns
-- on demo mode. Nothing server-side stopped a real (non-demo) booking from
-- targeting one, getting auto-approved and being charged -- production had
-- such a booking. Keep the two worlds apart: a campaign_screens row may only
-- link a demo booking to a demo screen, or a real booking to a real screen.
-- charge-campaign separately refuses to charge anything demo.

create or replace function public.enforce_demo_screen_isolation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_screen_demo  boolean;
  v_booking_demo boolean;
begin
  select is_demo into v_screen_demo from public.screens where id = new.screen_id;
  select is_demo into v_booking_demo from public.bookings where id = new.campaign_id;

  -- Missing rows are left to the existing foreign keys to reject.
  if v_screen_demo is null or v_booking_demo is null then
    return new;
  end if;

  if v_screen_demo and not v_booking_demo then
    raise exception 'Demo screens can''t be booked by real campaigns'
      using errcode = 'check_violation';
  end if;

  if v_booking_demo and not v_screen_demo then
    raise exception 'Demo campaigns can''t target real screens'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_demo_screen_isolation on public.campaign_screens;
create trigger enforce_demo_screen_isolation
  before insert or update of screen_id, campaign_id on public.campaign_screens
  for each row execute function public.enforce_demo_screen_isolation();

-- Demo mode is a sales/demo tool for the platform owner. Anyone else who had
-- flipped it on gets it switched off (App.jsx also now ignores it for
-- non-owners).
update public.profiles set demo_mode = false
where demo_mode = true and coalesce(is_platform_owner, false) = false;
