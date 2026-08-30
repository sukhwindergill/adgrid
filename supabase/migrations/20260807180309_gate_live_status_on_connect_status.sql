-- B14 follow-up (2026-08-07 go-live re-verification): the 07-14 fix added a
-- Stripe Connect onboarding step and a dashboard warning, but never actually
-- stopped a screen from going 'live' without one. Live check against
-- production confirmed the gap is real, not theoretical: 0 of 2 operators
-- have connect_status = 'active', 0 rows have ever existed in `payouts`, and
-- 8 screens are `status = 'live'` today under the unconnected operator.
-- `charge-campaign.distributeOperatorCuts()` silently skips any operator
-- whose connect_status isn't 'active' (supabase/functions/charge-campaign/
-- index.ts) — so those 8 screens can be booked and paid for right now with
-- the payout guaranteed to go nowhere.
--
-- This is the authoritative gate: a DB trigger, not just a UI check, because
-- `status` is client-writable (ScreenOnboard's heartbeat-test step and
-- ScreenDetail's Reactivate button both UPDATE it directly) and any future
-- code path should be covered automatically, not by remembering to call a
-- helper.
--
-- Only the *transition into* 'live' is gated (INSERT with status='live', or
-- UPDATE where the old status wasn't already 'live'). Screens that were
-- already live before this migration are untouched — matches the existing
-- "screens already live shouldn't get bricked" decision from the 07-14
-- Connect-onboarding fix (see ScreenOnboard.jsx's StepPayouts comment).

CREATE OR REPLACE FUNCTION public.require_connect_active_for_live_screen()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  op_connect_status text;
BEGIN
  IF NEW.status = 'live' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'live') THEN
    SELECT connect_status INTO op_connect_status
    FROM public.profiles
    WHERE id = NEW.operator_id;

    IF op_connect_status IS DISTINCT FROM 'active' THEN
      RAISE EXCEPTION
        'Screen cannot go live until the operator has completed Stripe Connect payout setup (connect_status = active).'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_require_connect_active_for_live_screen ON public.screens;

CREATE TRIGGER trg_require_connect_active_for_live_screen
  BEFORE INSERT OR UPDATE ON public.screens
  FOR EACH ROW
  EXECUTE FUNCTION public.require_connect_active_for_live_screen();
