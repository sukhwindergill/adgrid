-- Bug: reset_screen_approval_on_creative_change looks up targeting_id via
-- `SELECT ... FROM campaign_creatives WHERE id = OLD.creative_id`. Under
-- ON DELETE CASCADE (deleting the parent campaign_creatives row directly,
-- rather than the campaign_creative_screens row), Postgres deletes the parent
-- first, then fires the cascade DELETE on this table -- by which point the
-- lookup finds nothing, affected_campaign_id is NULL, and the status reset
-- silently no-ops (WHERE campaign_id = NULL never matches). Confirmed live:
-- deleting a campaign_creatives row left campaign_screens.status unchanged at
-- 'approved' instead of resetting to 'pending'. Direct
-- DELETE FROM campaign_creative_screens (no cascade) already worked correctly.
--
-- Fix: denormalize targeting_id onto campaign_creative_screens itself, so the
-- DELETE trigger reads OLD.targeting_id directly off the row being deleted --
-- no lookup, no cascade-ordering hazard.

ALTER TABLE campaign_creative_screens ADD COLUMN IF NOT EXISTS targeting_id text REFERENCES bookings(id);

UPDATE campaign_creative_screens ccs
SET targeting_id = cc.targeting_id
FROM campaign_creatives cc
WHERE cc.id = ccs.creative_id
  AND ccs.targeting_id IS NULL;

ALTER TABLE campaign_creative_screens ALTER COLUMN targeting_id SET NOT NULL;

CREATE OR REPLACE FUNCTION set_creative_screen_targeting_id()
RETURNS trigger AS $$
BEGIN
  SELECT targeting_id INTO NEW.targeting_id FROM campaign_creatives WHERE id = NEW.creative_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER campaign_creative_screens_set_targeting_id
  BEFORE INSERT ON campaign_creative_screens
  FOR EACH ROW
  EXECUTE FUNCTION set_creative_screen_targeting_id();

REVOKE EXECUTE ON FUNCTION set_creative_screen_targeting_id() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION reset_screen_approval_on_creative_change()
RETURNS trigger AS $$
DECLARE
  affected_screen_id   text;
  affected_campaign_id text;
BEGIN
  affected_screen_id := COALESCE(NEW.screen_id, OLD.screen_id);
  affected_campaign_id := COALESCE(NEW.targeting_id, OLD.targeting_id);

  UPDATE campaign_screens
  SET status = 'pending'
  WHERE campaign_id = affected_campaign_id
    AND screen_id = affected_screen_id
    AND status IN ('approved', 'auto_approved');

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
