-- Platform-audit finding: assign-holdout-control (edge function) guards
-- against re-randomizing an already-assigned holdout group with a
-- check-then-act read (SELECT count(*) WHERE is_control = true, then call
-- this RPC only if that count is 0). Two near-simultaneous requests for the
-- same campaign_id (a double-click, or a client retry racing the original)
-- both read count = 0 before either has committed, both fall through, and
-- assign_holdout_control() itself does no locking or idempotency check of
-- its own -- it just re-randomizes ceil(total * 0.2) rows and sets them to
-- is_control = true. The second call's UPDATE mostly re-sets already-true
-- rows to true (harmless), but can also flip additional rows on campaigns
-- where the random 20% selections don't fully overlap, silently inflating
-- the control group past the intended ~20% and quietly invalidating the
-- lift number this holdout test exists to produce.
--
-- Fix: make the function itself the idempotency boundary, not just the
-- edge function's pre-check. A transaction-scoped advisory lock serializes
-- concurrent calls for the same campaign_id, and an in-transaction re-check
-- (after acquiring the lock) makes a second racing call a safe no-op
-- instead of a second randomization -- the same "claim atomically before
-- acting" pattern used for the payout race (trigger-payout) and the
-- screen-invite signup race (accept-screen-invite).
CREATE OR REPLACE FUNCTION public.assign_holdout_control(p_campaign_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
  v_control_count integer;
  v_existing_control integer;
BEGIN
  -- Serialize concurrent calls for the same campaign for the rest of this
  -- transaction. hashtext() keeps this to the single-bigint form of the
  -- advisory lock, scoped by campaign_id so unrelated campaigns never
  -- contend with each other.
  PERFORM pg_advisory_xact_lock(hashtext('assign_holdout_control:' || p_campaign_id));

  -- Re-check inside the lock: if a racing call already assigned a control
  -- group before we acquired it, this is a safe no-op, not a second
  -- randomization.
  SELECT count(*) INTO v_existing_control
  FROM public.campaign_screens
  WHERE campaign_id = p_campaign_id AND is_control = true;

  IF v_existing_control > 0 THEN
    RETURN v_existing_control;
  END IF;

  SELECT count(*) INTO v_total
  FROM public.campaign_screens
  WHERE campaign_id = p_campaign_id;

  IF v_total < 10 THEN
    RETURN 0;
  END IF;

  v_control_count := ceil(v_total * 0.2)::integer;

  UPDATE public.campaign_screens
  SET is_control = true
  WHERE id IN (
    SELECT id FROM public.campaign_screens
    WHERE campaign_id = p_campaign_id
    ORDER BY random()
    LIMIT v_control_count
  );

  RETURN v_control_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assign_holdout_control(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_holdout_control(text) FROM authenticated;
