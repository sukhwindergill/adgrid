-- Security-audit finding: impersonation_logs is the only accountability
-- record of an operator using the "impersonate advertiser" UI feature
-- (App.jsx's startImpersonation) to view another user's account -- but the
-- redundant "operators can manage their own logs" ALL policy (alongside
-- the narrower, presumably-intended INSERT/SELECT/UPDATE policies) let the
-- very operator being audited DELETE their own log rows outright, and the
-- "Operators can close own sessions" UPDATE policy had no WITH CHECK at
-- all, letting them rewrite advertiser_id/started_at/operator_id freely
-- too -- not just set ended_at as intended. An audit log the audited party
-- can edit or delete at will provides no real accountability.
--
-- Drop the ALL policy (removing DELETE and the unrestricted-columns UPDATE
-- path it granted), and pin every column except ended_at on UPDATE via a
-- trigger -- same pattern as pin_profile_admin_columns, exempting
-- service_role so admin tooling can still correct a row if ever needed.
drop policy if exists "operators can manage their own logs" on public.impersonation_logs;

create or replace function public.pin_impersonation_log_columns()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  new.operator_id := old.operator_id;
  new.advertiser_id := old.advertiser_id;
  new.started_at := old.started_at;

  return new;
end;
$function$;

drop trigger if exists trg_pin_impersonation_log_columns on public.impersonation_logs;
create trigger trg_pin_impersonation_log_columns
  before update on public.impersonation_logs
  for each row
  execute function public.pin_impersonation_log_columns();
