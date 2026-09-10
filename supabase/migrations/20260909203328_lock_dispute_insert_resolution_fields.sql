-- Security-audit finding: disputes' "advertiser_files_own_disputes" INSERT
-- policy only checks advertiser_id = auth.uid() -- it never restricts the
-- resolution-only columns (status, resolution, resolved_amount,
-- resolved_by, resolved_at). FileDisputeModal.jsx's own INSERT payload
-- only ever sends booking_id/advertiser_id/reason_code/reason_text, but
-- that's a client-side convention, not an enforced boundary: nothing in
-- the policy stops a direct API call (a raw REST/supabase-js insert with
-- the advertiser's own JWT, bypassing the modal entirely) from including
-- status: 'resolved', resolution: 'refund_full', resolved_amount: <any
-- amount>, resolved_by: <anyone>, resolved_at: now() in the same insert.
--
-- disputes has no UPDATE policy at all (service_role only), so a
-- self-forged "already resolved" row can never be corrected back --
-- resolve-dispute's own status==='resolved' check would then permanently
-- refuse to let a platform owner ever actually process it. No real money
-- moves from the forged columns alone (only resolve-dispute's own Stripe
-- call does that), but it fabricates a resolution record with no genuine
-- review behind it and can permanently block the real one.
--
-- Require every resolution-only column to be at its untouched default on
-- insert -- an advertiser may only ever create a fresh, open dispute.
drop policy if exists "advertiser_files_own_disputes" on public.disputes;

create policy "advertiser_files_own_disputes" on public.disputes
  for insert
  with check (
    advertiser_id = auth.uid()
    and status = 'open'
    and resolution is null
    and resolution_note is null
    and resolved_amount is null
    and resolved_by is null
    and resolved_at is null
  );
