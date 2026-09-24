-- Security fix: clients could create an already-paid, already-approved
-- campaign directly through PostgREST.
--
-- The bookings INSERT policy only checks advertiser_id ownership, and the
-- authenticated role's INSERT grant covers status, payment_status, spent,
-- payment intent ids, is_house_ad etc. The campaign_screens INSERT policy
-- only checks that the advertiser owns the booking, with status freely
-- writable. So a signed-in advertiser could insert
--   bookings(status='active', payment_status='paid', ...)
--   campaign_screens(screen_id=<any live screen>, status='approved')
-- and display-feed would serve it: no payment, no operator review.
-- Confirmed against production in a rolled-back transaction.
--
-- Updates were already safe (the UPDATE column grant on bookings excludes
-- status/payment_status; campaign_screens UPDATE is operator-only via RLS).
-- This closes INSERT: for end-user roles (authenticated/anon), the
-- server-owned columns are forced to their initial values. Edge functions
-- (service_role) and SECURITY DEFINER functions (run as their owner) are
-- trusted and untouched -- they are the legitimate paths that set paid /
-- approved state (charge-campaign, stripe-webhook, api-campaigns,
-- create-house-ad, sweep-approvals, ...).

create or replace function public.enforce_client_booking_insert_state()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  new.status                  := 'pending_review';
  new.payment_status          := 'unpaid';
  new.spent                   := 0;
  new.impressions             := 0;
  new.scans                   := 0;
  new.payment_intent_id       := null;
  new.stripe_payment_intent   := null;
  new.stripe_checkout_session := null;
  -- House ads are operator-owned free inventory, created only through the
  -- create-house-ad edge function.
  new.is_house_ad             := false;
  return new;
end;
$$;

drop trigger if exists bookings_enforce_client_insert_state on public.bookings;
create trigger bookings_enforce_client_insert_state
  before insert on public.bookings
  for each row execute function public.enforce_client_booking_insert_state();

-- Reads screens.auto_approve for the trigger below. SECURITY DEFINER because
-- advertisers can't necessarily read other operators' screens rows directly.
-- Kept separate from the trigger function on purpose: inside a SECURITY
-- DEFINER function current_user is the owner, which would defeat the
-- caller-role check the trigger relies on.
create or replace function public.screen_auto_approves(p_screen_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select auto_approve from public.screens where id::text = p_screen_id), false);
$$;

-- The trigger runs as the calling role, so that role needs EXECUTE. It only
-- exposes screens.auto_approve, already public via advertiser_screens.
revoke all on function public.screen_auto_approves(text) from public;
grant execute on function public.screen_auto_approves(text) to authenticated, anon, service_role;

create or replace function public.enforce_client_campaign_screen_insert_state()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_auto boolean;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  v_auto := public.screen_auto_approves(new.screen_id::text);

  -- The only approval a client may claim is the one the screen's operator
  -- already granted up front via screens.auto_approve.
  new.status        := case when v_auto then 'auto_approved' else 'pending' end;
  new.approved_at   := case when v_auto then now() else null end;
  new.is_control    := false;   -- holdout control is assigned server-side only
  new.expired_at    := null;
  new.reject_reason := null;
  new.review_due_at := null;    -- recomputed by campaign_screens_set_review_due_at
  return new;
end;
$$;

-- Name sorts before campaign_screens_set_review_due_at so that trigger sees
-- the corrected status (BEFORE triggers fire in name order).
drop trigger if exists campaign_screens_a_enforce_client_insert_state on public.campaign_screens;
create trigger campaign_screens_a_enforce_client_insert_state
  before insert on public.campaign_screens
  for each row execute function public.enforce_client_campaign_screen_insert_state();
