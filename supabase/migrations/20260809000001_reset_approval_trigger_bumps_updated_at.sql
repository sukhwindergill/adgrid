-- ============================================================
-- FIX: creative-reassignment reset never notified the operator.
--
-- reset_screen_approval_on_creative_change() (20260731000004) flips a
-- campaign_screens row from approved/auto_approved back to pending when an
-- advertiser adds/removes a per-screen creative assignment -- display-feed
-- immediately stops serving that screen (correct: don't air unreviewed
-- content). But the UPDATE never touched updated_at, and no application
-- code sets it on any campaign_screens status transition either (checked
-- ApprovalQueue.jsx's approve/reject calls -- they set approved_at, never
-- updated_at). notification-cron's pending-approval push
-- (supabase/functions/notification-cron/index.ts:225-229) is the only thing
-- that pings an operator about a new pending review, and it filters on
-- updated_at >= now() - 2min. Since the reset never bumped it, a row's
-- updated_at stayed frozen at its original INSERT time (the campaign's
-- initial submission, typically days/weeks earlier) -- the cron's window
-- never matched a reset row. Net effect: a screen goes dark with zero
-- signal to the operator who already approved it, and zero warning to the
-- advertiser making the change. Confirmed by reading every code path that
-- writes to campaign_screens -- no notification path exists for this case
-- at all, DB trigger or application-level.
--
-- Fix: have the trigger's own UPDATE set updated_at = now(), reusing the
-- existing pending-approval push cron instead of adding a new notification
-- pathway -- the cron picks it up on its next run (<=2 min) with no other
-- change needed.
-- ============================================================

CREATE OR REPLACE FUNCTION reset_screen_approval_on_creative_change()
RETURNS trigger AS $$
DECLARE
  affected_screen_id   text;
  affected_campaign_id text;
BEGIN
  affected_screen_id := COALESCE(NEW.screen_id, OLD.screen_id);

  SELECT targeting_id INTO affected_campaign_id
  FROM campaign_creatives
  WHERE id = COALESCE(NEW.creative_id, OLD.creative_id);

  UPDATE campaign_screens
  SET status = 'pending',
      updated_at = now()
  WHERE campaign_id = affected_campaign_id
    AND screen_id = affected_screen_id
    AND status IN ('approved', 'auto_approved');

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
