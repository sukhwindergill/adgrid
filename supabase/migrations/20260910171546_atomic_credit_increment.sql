-- Platform-audit finding: reconcile-delivery and sweep-approvals both credit
-- an advertiser's account balance (profiles.credits) with a non-atomic
-- read-then-write: SELECT credits, add the delta in JS, then UPDATE with the
-- computed total. These are two independently-scheduled crons (not the same
-- job re-entering itself), and both can plausibly credit the same advertiser
-- around the same time -- reconcile-delivery for an under-delivery makegood,
-- sweep-approvals for a screen dropped past its SLA. Two concurrent
-- read-modify-write cycles on the same row is a textbook lost update: both
-- read the same starting balance, both compute their own "starting + delta"
-- total, and whichever UPDATE commits last silently overwrites the other's
-- credit instead of both landing. The advertiser is quietly short-credited
-- with no error anywhere -- delivery_reconciliation/campaign_screens still
-- record the credit as issued (credited_at is set, the row says the right
-- amount), so nothing about it ever looks wrong.
--
-- Fix: move the increment into the database as a single atomic UPDATE
-- (`credits = credits + delta`), so two concurrent callers can never observe
-- and overwrite the same pre-increment value. SECURITY DEFINER + no grants
-- to authenticated/anon: only the two service-role callers may invoke this,
-- the same trust boundary as assign_holdout_control and
-- reset_campaign_creative_approval.
CREATE OR REPLACE FUNCTION public.increment_profile_credits(p_profile_id uuid, p_delta numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance numeric;
BEGIN
  UPDATE public.profiles
  SET credits = coalesce(credits, 0) + p_delta
  WHERE id = p_profile_id
  RETURNING credits INTO v_new_balance;

  RETURN v_new_balance;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_profile_credits(uuid, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_profile_credits(uuid, numeric) FROM authenticated;
