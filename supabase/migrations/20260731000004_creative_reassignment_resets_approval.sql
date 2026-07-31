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
  SET status = 'pending'
  WHERE campaign_id = affected_campaign_id
    AND screen_id = affected_screen_id
    AND status IN ('approved', 'auto_approved');

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER campaign_creative_screens_reset_approval
  AFTER INSERT OR DELETE ON campaign_creative_screens
  FOR EACH ROW
  EXECUTE FUNCTION reset_screen_approval_on_creative_change();
