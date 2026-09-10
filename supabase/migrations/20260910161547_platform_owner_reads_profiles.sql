-- Product-audit finding, continuing the ongoing sweep: profiles has no
-- platform-owner SELECT policy at all -- only "Users can read own
-- profile" (id = auth.uid()) and operator_reads_own_advertiser_profiles
-- (a booking-relationship scoped read). OperatorVerificationQueue.jsx
-- (routed behind RequirePlatformOwner specifically for this) queries
-- profiles directly for verification_status = 'pending_manual' and for
-- recently verified/rejected operators -- under RLS this always returns
-- an empty array for the platform owner, since their own row won't match
-- either filter. The entire Identity Verification Queue admin page is
-- silently unreachable: it always renders "Nothing awaiting manual
-- review," regardless of how many operators actually are. This is the
-- same class of bug as the operator-manage-advertiser silent-no-op fix
-- (PR #246) -- manual-review-operator (the edge function that actually
-- processes a decision) works fine once called, but the admin has no way
-- to ever see who needs reviewing in the first place.
--
-- Fix: same established convention as disputes/identity_verifications/
-- impersonation_logs -- a platform-owner SELECT policy. Uses a
-- SECURITY DEFINER helper (matching is_operator()/current_advertiser_id()'s
-- existing pattern in this codebase) rather than an inline EXISTS
-- subquery on profiles from within a profiles policy -- this repo has
-- hit real RLS self/cross-recursion bugs before (see
-- fix_bookings_rls_recursion, fix_marketplace_rls_recursion,
-- fix_campaign_creatives_rls_recursion), and a SECURITY DEFINER function
-- bypasses RLS entirely for its internal query, so it can never
-- re-trigger profiles' own policies no matter how this policy is
-- evaluated.
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

create policy "platform_owner_reads_all_profiles" on public.profiles
  for select
  using (public.is_platform_owner());
