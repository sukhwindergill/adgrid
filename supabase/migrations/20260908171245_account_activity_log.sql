-- ============================================================
-- Account access audit log (Story Map, Agency epic): "I want an audit log
-- of what a delegated team member or agency changed on my account, so I
-- can trust granting access without losing visibility into what happens
-- with it." Granting access (GrantAccessModal/AccessSettingsView/
-- AcceptGrantView) already existed with no record of who was granted
-- what, when a grant was accepted, or when access was revoked.
--
-- Implemented as a trigger on account_grants rather than scattered
-- client-side logging calls at each mutation site -- a trigger can't be
-- bypassed by a code path that forgets to log, and every mutation to
-- account_grants already flows through this one table regardless of
-- which view triggered it (GrantAccessModal's insert, AccessSettingsView's
-- revoke, AcceptGrantView's accept/decline).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.account_activity_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id    uuid REFERENCES public.profiles(id),
  action      text NOT NULL CHECK (action IN ('grant_created', 'access_accepted', 'access_revoked', 'role_changed')),
  grantee_id  uuid REFERENCES public.profiles(id),
  role        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_activity_log_account_idx
  ON public.account_activity_log (account_id, created_at DESC);

ALTER TABLE public.account_activity_log ENABLE ROW LEVEL SECURITY;

-- Only the account owner reads their own log -- this is their visibility
-- into what happened on their account, not the grantee's. No INSERT
-- policy at all: rows are written only by the trigger below (SECURITY
-- DEFINER), never directly by a client, so the log can't be edited or
-- backfilled by whoever it's supposed to be watching.
DROP POLICY IF EXISTS "account_owner_reads_own_activity_log" ON public.account_activity_log;
CREATE POLICY "account_owner_reads_own_activity_log" ON public.account_activity_log
  FOR SELECT
  TO authenticated
  USING (account_id = auth.uid());

CREATE OR REPLACE FUNCTION public.log_account_grant_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.account_activity_log (account_id, actor_id, action, grantee_id, role)
    VALUES (NEW.account_id, auth.uid(), 'grant_created', NEW.grantee_id, NEW.role);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'active' AND OLD.status = 'pending' THEN
      INSERT INTO public.account_activity_log (account_id, actor_id, action, grantee_id, role)
      VALUES (NEW.account_id, auth.uid(), 'access_accepted', NEW.grantee_id, NEW.role);
    ELSIF NEW.status = 'revoked' AND OLD.status != 'revoked' THEN
      INSERT INTO public.account_activity_log (account_id, actor_id, action, grantee_id, role)
      VALUES (NEW.account_id, auth.uid(), 'access_revoked', NEW.grantee_id, NEW.role);
    ELSIF NEW.role != OLD.role THEN
      INSERT INTO public.account_activity_log (account_id, actor_id, action, grantee_id, role)
      VALUES (NEW.account_id, auth.uid(), 'role_changed', NEW.grantee_id, NEW.role);
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS account_grants_log_activity ON public.account_grants;
CREATE TRIGGER account_grants_log_activity
  AFTER INSERT OR UPDATE ON public.account_grants
  FOR EACH ROW
  EXECUTE FUNCTION public.log_account_grant_activity();
