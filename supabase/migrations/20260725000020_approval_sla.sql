-- ============================================================
-- Approval SLA: every pending review gets a visible deadline, and operators
-- can opt specific work into auto-approval.
-- ============================================================

-- Per-screen review SLA, set by the operator. NULL means use the default (24h).
ALTER TABLE public.screens
  ADD COLUMN IF NOT EXISTS review_sla_hours integer;

-- ADD CONSTRAINT has no IF NOT EXISTS, so guard it for re-runs.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'screens_review_sla_hours_check'
  ) THEN
    ALTER TABLE public.screens
      ADD CONSTRAINT screens_review_sla_hours_check
      CHECK (review_sla_hours IS NULL OR (review_sla_hours >= 1 AND review_sla_hours <= 168));
  END IF;
END $$;

-- The deadline for this specific pending review.
ALTER TABLE public.campaign_screens
  ADD COLUMN IF NOT EXISTS review_due_at timestamptz;

ALTER TABLE public.campaign_screens
  ADD COLUMN IF NOT EXISTS expired_at timestamptz;

CREATE INDEX IF NOT EXISTS campaign_screens_pending_due_idx
  ON public.campaign_screens (review_due_at)
  WHERE status = 'pending';

-- Operator auto-approve policy. One row per operator.
CREATE TABLE IF NOT EXISTS public.operator_approval_rules (
  operator_id             uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  enabled                 boolean NOT NULL DEFAULT false,
  auto_approve_categories text[] NOT NULL DEFAULT '{}',
  min_completed_campaigns integer NOT NULL DEFAULT 1 CHECK (min_completed_campaigns >= 0),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operator_approval_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.operator_approval_rules FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operator_approval_rules TO authenticated;

DROP POLICY IF EXISTS "operator_select_own_policy" ON public.operator_approval_rules;
CREATE POLICY "operator_select_own_policy" ON public.operator_approval_rules
  FOR SELECT USING (operator_id = auth.uid());

DROP POLICY IF EXISTS "operator_insert_own_policy" ON public.operator_approval_rules;
CREATE POLICY "operator_insert_own_policy" ON public.operator_approval_rules
  FOR INSERT WITH CHECK (operator_id = auth.uid());

-- The USING clause stops a user reassigning someone else's policy to
-- themselves; WITH CHECK stops them handing their own policy to another user.
DROP POLICY IF EXISTS "operator_update_own_policy" ON public.operator_approval_rules;
CREATE POLICY "operator_update_own_policy" ON public.operator_approval_rules
  FOR UPDATE USING (operator_id = auth.uid()) WITH CHECK (operator_id = auth.uid());

-- Stamp the deadline server-side on every new pending row. Doing this in a
-- trigger rather than in CreateCampaign means the client cannot choose its own
-- deadline, and every insertion path gets it for free.
CREATE OR REPLACE FUNCTION public.set_review_due_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sla integer;
BEGIN
  IF NEW.status = 'pending' AND NEW.review_due_at IS NULL THEN
    SELECT review_sla_hours INTO sla FROM public.screens WHERE id = NEW.screen_id;
    NEW.review_due_at := now() + (COALESCE(sla, 24) || ' hours')::interval;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS campaign_screens_set_review_due_at ON public.campaign_screens;
CREATE TRIGGER campaign_screens_set_review_due_at
  BEFORE INSERT ON public.campaign_screens
  FOR EACH ROW EXECUTE FUNCTION public.set_review_due_at();

-- Backfill deadlines for rows already waiting, so nothing sits without one.
UPDATE public.campaign_screens cs
SET review_due_at = COALESCE(cs.created_at, now())
                    + (COALESCE((SELECT review_sla_hours FROM public.screens s WHERE s.id = cs.screen_id), 24) || ' hours')::interval
WHERE cs.status = 'pending' AND cs.review_due_at IS NULL;
