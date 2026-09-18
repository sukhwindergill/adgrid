-- Advertiser identity verification: two-tier (instant domain-match,
-- manual doc review) trust signal for operators, plus an opt-in
-- auto-approve policy extension. Mirrors the operator identity
-- verification pattern (pin_profile_admin_columns, OperatorVerificationQueue)
-- and plugs into the existing operator_approval_rules / sweep-approvals
-- auto-approve pipeline rather than a new one.

CREATE TABLE IF NOT EXISTS public.advertiser_verifications (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name       text NOT NULL,
  business_number    text,
  business_domain    text NOT NULL,
  doc_storage_path   text,
  tier               text NOT NULL CHECK (tier IN ('domain_match', 'document_review')),
  status             text NOT NULL DEFAULT 'pending_auto'
                       CHECK (status IN ('pending_auto', 'pending_manual', 'verified', 'rejected')),
  rejection_reason   text,
  reviewed_by        uuid REFERENCES public.profiles(id),
  reviewed_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS advertiser_verifications_profile_idx
  ON public.advertiser_verifications (profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS advertiser_verifications_pending_idx
  ON public.advertiser_verifications (status) WHERE status = 'pending_manual';

ALTER TABLE public.advertiser_verifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.advertiser_verifications FROM anon;
GRANT SELECT, INSERT ON public.advertiser_verifications TO authenticated;

DROP POLICY IF EXISTS "advertiser_select_own_verifications" ON public.advertiser_verifications;
CREATE POLICY "advertiser_select_own_verifications" ON public.advertiser_verifications
  FOR SELECT USING (profile_id = auth.uid());

-- Advertisers may INSERT their own submission row (the initial
-- pending_auto/pending_manual state); only service_role may ever UPDATE
-- status/reviewed_* afterwards -- see the trigger below. No client UPDATE
-- policy is granted at all, matching "no direct edit, only new submissions."
DROP POLICY IF EXISTS "advertiser_insert_own_verification" ON public.advertiser_verifications;
CREATE POLICY "advertiser_insert_own_verification" ON public.advertiser_verifications
  FOR INSERT WITH CHECK (profile_id = auth.uid());

-- Same shape as pin_profile_admin_columns: a BEFORE UPDATE trigger, not an
-- RLS with_check, because it must also cover service_role's own writes
-- symmetrically (service_role is explicitly exempted here, exactly as
-- that trigger exempts it) and because there is deliberately no client
-- UPDATE policy above for this to interact with -- this trigger is the
-- backstop if one is ever added later.
CREATE OR REPLACE FUNCTION public.pin_advertiser_verification_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  NEW.status := OLD.status;
  NEW.rejection_reason := OLD.rejection_reason;
  NEW.reviewed_by := OLD.reviewed_by;
  NEW.reviewed_at := OLD.reviewed_at;
  NEW.profile_id := OLD.profile_id;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_pin_advertiser_verification_columns ON public.advertiser_verifications;
CREATE TRIGGER trg_pin_advertiser_verification_columns
  BEFORE UPDATE ON public.advertiser_verifications
  FOR EACH ROW
  EXECUTE FUNCTION public.pin_advertiser_verification_columns();

-- Denormalized badge flag on profiles, kept in sync by the edge functions
-- that own advertiser_verifications.status transitions.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_verified_advertiser boolean NOT NULL DEFAULT false;

-- Extend pin_profile_admin_columns (20260909194813) so this new column gets
-- the same client-write protection as verification_status/verified_at do
-- for operators -- otherwise an advertiser could self-approve via a direct
-- .update() on their own profiles row, the exact gap that migration fixed
-- for operators.
CREATE OR REPLACE FUNCTION public.pin_profile_admin_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  NEW.is_platform_owner := OLD.is_platform_owner;
  NEW.credits := OLD.credits;
  NEW.rate_override := OLD.rate_override;
  NEW.status := OLD.status;
  NEW.plan := OLD.plan;
  NEW.verification_status := OLD.verification_status;
  NEW.verified_at := OLD.verified_at;
  NEW.verification_rejection_reason := OLD.verification_rejection_reason;
  NEW.connect_status := OLD.connect_status;
  NEW.owner_revenue_share := OLD.owner_revenue_share;
  NEW.stripe_connect_account_id := OLD.stripe_connect_account_id;
  NEW.stripe_customer_id := OLD.stripe_customer_id;
  NEW.stripe_identity_session_id := OLD.stripe_identity_session_id;
  NEW.is_verified_advertiser := OLD.is_verified_advertiser;
  NEW.role := OLD.role;

  RETURN NEW;
END;
$function$;
-- Trigger itself (trg_pin_profile_admin_columns) already exists and points
-- at this function name, so no DROP/CREATE TRIGGER needed here.

-- Operator-side auto-approve extension: independent of the existing
-- category policy (enabled/auto_approve_categories) -- "trust verified
-- advertisers" is a separate opt-in, not folded into the category list.
ALTER TABLE public.operator_approval_rules
  ADD COLUMN IF NOT EXISTS auto_approve_verified_advertisers boolean NOT NULL DEFAULT false;

ALTER TABLE public.operator_approval_rules
  ADD COLUMN IF NOT EXISTS auto_approve_prompt_snoozed_until timestamptz;
