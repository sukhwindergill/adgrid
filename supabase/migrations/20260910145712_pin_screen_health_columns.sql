-- Security-audit finding, continuing the ongoing sweep: screens' only
-- write policy ("operator_own_screens", FOR ALL) is scoped to
-- operator_id = auth.uid() with no column restriction -- an operator can
-- directly UPDATE any column on their own screen via a raw client call,
-- including health_status, last_seen, and cv_last_seen.
--
-- Those three columns have no legitimate client write path anywhere in
-- the app: health_status and last_seen are written only by
-- screen-health-cron and ingest-impressions/ingest-plays (both
-- service-role); cv_last_seen only by ingest-impressions' heartbeat_only
-- branch. Every client-side reference to them (screenHealth.js,
-- ScreenDetail.jsx, App.jsx's advertiser_screens select) only ever reads.
--
-- Unlike monthly_traffic_estimate/impressions (intentionally
-- operator-self-reported via EditScreenModal.jsx's own "Monthly
-- Footfall" field -- not a gap), a screen's health/last-seen status is
-- meant to reflect real device telemetry, not operator say-so. An
-- operator could otherwise fake their own screen as online/healthy in
-- the advertiser-facing marketplace/screen-picker regardless of whether
-- it's actually delivering anything -- misleading advertisers into
-- paying for impressions a dark screen never serves.
create or replace function public.pin_screen_health_columns()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  new.health_status := old.health_status;
  new.last_seen := old.last_seen;
  new.cv_last_seen := old.cv_last_seen;
  return new;
end;
$function$;

drop trigger if exists trg_pin_screen_health_columns on public.screens;
create trigger trg_pin_screen_health_columns
  before update on public.screens
  for each row
  execute function public.pin_screen_health_columns();
