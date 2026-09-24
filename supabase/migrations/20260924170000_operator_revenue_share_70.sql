-- Operator revenue split moves to a flat 70% of gross advertiser spend
-- (platform keeps 30%). Previously: 12% platform fee off the top, then the
-- operator got owner_revenue_share (default 0.40) of the remaining net, and
-- the leftover "network pool" was never paid to anyone -- operators ended up
-- with ~35% of spend. owner_revenue_share is now a share of GROSS spend; the
-- payout math lives in supabase/functions/_shared/payoutSharing.ts and
-- src/lib/revenueSplit.js.

alter table public.profiles
  alter column owner_revenue_share set default 0.70;

-- Move operators still on the old default to the new one. Custom rates
-- (anything other than 0.40) are left untouched for manual review.
-- trg_pin_profile_admin_columns only exempts service_role and would silently
-- revert this update when run as the migration role, so disable it for the
-- duration of the statement.
alter table public.profiles disable trigger trg_pin_profile_admin_columns;

update public.profiles
set owner_revenue_share = 0.70
where owner_revenue_share is null or owner_revenue_share = 0.40;

alter table public.profiles enable trigger trg_pin_profile_admin_columns;
