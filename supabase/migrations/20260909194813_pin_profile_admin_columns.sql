-- Security-audit finding: "Users can update own profile" only pins `role`
-- (a caller's new row must carry the same role as their current row). No
-- other column is protected -- Postgres RLS with_check/qual gate row
-- *visibility*, not per-column writability, and this table's column grants
-- to `authenticated` cover every column (the default for GRANT UPDATE ON
-- TABLE). That means any authenticated user could, via a direct
-- supabase-js `.update()` on their own row -- no edge function needed --
-- set on themselves:
--   is_platform_owner = true   -- full admin access (manual-review-operator,
--                                 invite-operator both gate on this flag alone)
--   credits = <anything>       -- free advertiser balance
--   status = 'active'          -- silently undo an operator's own suspension
--   verification_status = 'verified', verified_at = now()
--                               -- fake the verified-operator badge, bypassing
--                                 Stripe Identity review entirely
--   connect_status = 'active', owner_revenue_share = 1.0,
--   stripe_connect_account_id, stripe_customer_id, stripe_identity_session_id
--                               -- forge Stripe account linkage / revenue share
--   plan = <anything>
--
-- Fixed with a BEFORE UPDATE trigger rather than widening the RLS
-- with_check clause: a trigger fires for every writer including
-- service_role, so it must explicitly exempt service_role (every edge
-- function's real writes to these columns go through the service key and
-- must keep working unchanged); RLS itself already exempts service_role
-- automatically, which is what let the gap above go unnoticed as long as
-- nothing tested a *direct* authenticated-role write to these columns.
create or replace function public.pin_profile_admin_columns()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  -- service_role (every edge function's service-key client) is the only
  -- writer allowed to actually change these columns -- exempt it entirely.
  if auth.role() = 'service_role' then
    return new;
  end if;

  new.is_platform_owner := old.is_platform_owner;
  new.credits := old.credits;
  new.rate_override := old.rate_override;
  new.status := old.status;
  new.plan := old.plan;
  new.verification_status := old.verification_status;
  new.verified_at := old.verified_at;
  new.verification_rejection_reason := old.verification_rejection_reason;
  new.connect_status := old.connect_status;
  new.owner_revenue_share := old.owner_revenue_share;
  new.stripe_connect_account_id := old.stripe_connect_account_id;
  new.stripe_customer_id := old.stripe_customer_id;
  new.stripe_identity_session_id := old.stripe_identity_session_id;
  -- role was already pinned by the RLS with_check clause on "Users can
  -- update own profile"; pinned again here too so it's enforced the same
  -- way as every other admin column, and stays pinned even if that policy
  -- is ever changed independently of this trigger.
  new.role := old.role;

  return new;
end;
$function$;

drop trigger if exists trg_pin_profile_admin_columns on public.profiles;
create trigger trg_pin_profile_admin_columns
  before update on public.profiles
  for each row
  execute function public.pin_profile_admin_columns();
