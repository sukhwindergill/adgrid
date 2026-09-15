-- Platform-audit finding: "advertiser_files_own_disputes" checks that the
-- dispute row's own advertiser_id is the caller (auth.uid()) and that every
-- resolution field is left at its unresolved default (PR #250's own fix),
-- but never checks that booking_id actually belongs to that advertiser. Any
-- authenticated advertiser could INSERT a dispute against ANY booking_id in
-- the system -- not just their own -- by passing an arbitrary id.
--
-- DisputeQueue.jsx (the platform-owner review surface) makes this worse
-- than a nuisance: it displays the disputed BOOKING's own advertiser_name
-- (joined from bookings, not from the dispute row's advertiser_id), so a
-- reviewing admin sees what looks like a legitimate dispute filed by the
-- affected advertiser on their own campaign, with no indication the actual
-- filer is someone else entirely. A malicious advertiser could file
-- fabricated disputes against a competitor's campaigns -- reason_text is
-- free text they fully control -- to get a rival paused/refunded: direct
-- competitive sabotage with real financial/delivery harm to the victim,
-- the same class of cross-advertiser attack already closed for automation
-- rules (lock_automation_rule_scope_ownership).
ALTER POLICY "advertiser_files_own_disputes" ON public.disputes
  WITH CHECK (
    advertiser_id = auth.uid()
    AND status = 'open'
    AND resolution IS NULL
    AND resolution_note IS NULL
    AND resolved_amount IS NULL
    AND resolved_by IS NULL
    AND resolved_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.bookings
      WHERE bookings.id = disputes.booking_id
        AND bookings.advertiser_id = auth.uid()
    )
  );
