-- Product-audit finding, continuing the ongoing sweep: impersonation_logs
-- is documented (see 20260909195848_lock_impersonation_logs_audit_trail.sql)
-- as "the only accountability record of an operator using the
-- 'impersonate advertiser' UI feature" -- but it had no platform-owner
-- SELECT policy at all. Its only policies are all scoped to
-- operator_id = auth.uid(), meaning the *only* person who could ever read
-- this "accountability" log through RLS was the very operator being
-- audited. The established convention elsewhere for exactly this shape of
-- table -- disputes (platform_owner_reads_all_disputes) and
-- identity_verifications (Platform owners can read all verifications) --
-- already grants a platform-owner SELECT policy; impersonation_logs was
-- simply missed.
--
-- Purely additive: does not change any existing operator-facing behavior,
-- only adds a read path for is_platform_owner = true.
create policy "platform_owner_reads_all_impersonation_logs" on public.impersonation_logs
  for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_platform_owner = true
    )
  );
