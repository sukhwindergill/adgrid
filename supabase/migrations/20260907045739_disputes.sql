-- ============================================================
-- Dispute & refund workflow (spec #2).
--
-- Before this, "my ad didn't run" meant someone digging through raw Stripe
-- charges and issuing a manual refund by hand -- the actual reversal
-- mechanics (transferReversal.ts, wired to the charge.refunded webhook)
-- were already solid, but nothing in the product let an advertiser raise
-- the issue, or gave ops a queue to work it from. This table is the
-- missing surface between the two: a filed claim with a reason, and an
-- auditable resolution -- never a raw Stripe-dashboard action with no
-- record of why.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.disputes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id       text NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  advertiser_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason_code      text NOT NULL,
  reason_text      text,
  status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolution       text CHECK (resolution IN ('refund_full', 'refund_partial', 'denied')),
  resolution_note  text,
  resolved_amount  numeric,
  resolved_by      uuid REFERENCES public.profiles(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  resolved_at      timestamptz,
  CONSTRAINT reason_text_length CHECK (reason_text IS NULL OR char_length(reason_text) <= 2000),
  CONSTRAINT resolution_note_length CHECK (resolution_note IS NULL OR char_length(resolution_note) <= 2000)
);

CREATE INDEX IF NOT EXISTS disputes_status_created_idx ON public.disputes (status, created_at DESC);
CREATE INDEX IF NOT EXISTS disputes_booking_idx ON public.disputes (booking_id);
CREATE INDEX IF NOT EXISTS disputes_advertiser_idx ON public.disputes (advertiser_id, created_at DESC);

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

-- Advertisers file and read their own disputes only. They cannot resolve
-- one themselves (no UPDATE policy) -- resolution is service-role only,
-- via the resolve-dispute edge function, so there's always an auditable
-- resolved_by/resolved_at pair rather than a self-served refund.
DROP POLICY IF EXISTS "advertiser_files_own_disputes" ON public.disputes;
CREATE POLICY "advertiser_files_own_disputes" ON public.disputes
  FOR INSERT
  TO authenticated
  WITH CHECK (advertiser_id = auth.uid());

DROP POLICY IF EXISTS "advertiser_reads_own_disputes" ON public.disputes;
CREATE POLICY "advertiser_reads_own_disputes" ON public.disputes
  FOR SELECT
  TO authenticated
  USING (advertiser_id = auth.uid());

-- Platform owner (same role gate as AdminInvites/invite-operator) can read
-- every dispute to work the queue. Resolution writes still go through the
-- edge function (service role), not a direct client UPDATE, so every
-- resolution is tied to a verified admin action, not just RLS-permitted.
DROP POLICY IF EXISTS "platform_owner_reads_all_disputes" ON public.disputes;
CREATE POLICY "platform_owner_reads_all_disputes" ON public.disputes
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_platform_owner = true));
