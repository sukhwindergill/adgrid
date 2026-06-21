-- Prevent grantees from modifying any column other than status
-- via a BEFORE UPDATE trigger that raises an error if role changes

CREATE OR REPLACE FUNCTION lock_account_grant_grantee_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If the caller is the grantee (not the account owner), only allow status changes
  IF auth.uid() = OLD.grantee_id AND auth.uid() != OLD.account_id THEN
    IF NEW.role != OLD.role THEN
      RAISE EXCEPTION 'Grantees may not modify role';
    END IF;
    IF NEW.grantee_id != OLD.grantee_id THEN
      RAISE EXCEPTION 'Grantees may not change grantee_id';
    END IF;
    IF NEW.account_id != OLD.account_id THEN
      RAISE EXCEPTION 'Grantees may not change account_id';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_grantee_update_columns
  BEFORE UPDATE ON account_grants
  FOR EACH ROW
  EXECUTE FUNCTION lock_account_grant_grantee_columns();
