-- B21: reset_screen_approval_on_creative_change() flips an approved/
-- auto_approved campaign_screens row back to 'pending' when its creative
-- assignment changes, but only ever touched `status` -- never
-- `review_due_at`. review_due_at is stamped once, at initial INSERT, by
-- set_review_due_at() (a BEFORE INSERT trigger, so it never re-fires on
-- this UPDATE either).
--
-- Confirmed live (disposable test data, cleaned up after): approve a
-- screen, backdate its review_due_at into the past (the normal state for
-- any screen approved earlier in a multi-week flight, since the SLA
-- default is 24h), then reassign a creative on it. The row goes back to
-- 'pending' carrying the stale, already-expired deadline. The next
-- sweep-approvals run (every 15 minutes) expires it immediately, credits
-- the advertiser, and drops the screen -- entirely as a side effect of the
-- advertiser's own legitimate creative change, with the operator never
-- getting any real chance to review the new state. Reproduced end-to-end
-- against the real sweep-approvals function: it returned expired:1 within
-- the same run, and a real screen_dropped_sla notification with a real
-- credit amount was issued.
--
-- Fix: give the row a fresh deadline (same SLA computation
-- set_review_due_at uses) whenever it's reset to pending, and clear
-- expired_at defensively. Also stamps updated_at, matching what
-- notification-cron's pending-review push already filters on (see
-- notification-cron/index.ts:229) -- previously the operator wasn't even
-- notified a re-review was needed, on top of the row being at risk of
-- disappearing before they could act on it.

CREATE OR REPLACE FUNCTION reset_screen_approval_on_creative_change()
RETURNS trigger AS $$
DECLARE
  affected_screen_id   text;
  affected_campaign_id text;
  sla                   integer;
BEGIN
  affected_screen_id := COALESCE(NEW.screen_id, OLD.screen_id);
  affected_campaign_id := COALESCE(NEW.targeting_id, OLD.targeting_id);

  SELECT review_sla_hours INTO sla FROM screens WHERE id = affected_screen_id;

  UPDATE campaign_screens
  SET status = 'pending',
      review_due_at = now() + (COALESCE(sla, 24) || ' hours')::interval,
      expired_at = NULL,
      updated_at = now()
  WHERE campaign_id = affected_campaign_id
    AND screen_id = affected_screen_id
    AND status IN ('approved', 'auto_approved');

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
