-- ============================================================
-- FIX (urgent, couples with 20260809000001 in this same PR):
-- campaign_screens has never had an updated_at column, despite
-- notification-cron/index.ts:229 filtering on it
-- (.gte("updated_at", twoMinutesAgo)) since the pending-approval push
-- feature was written, and despite 20260809000001 (this PR, already
-- applied live before this migration) adding an explicit
-- `updated_at = now()` to the reset trigger's UPDATE.
--
-- Both have been silently broken: PostgREST returns a "column does not
-- exist" error for the notification-cron query, which
-- `const { data } = await supabase...` discards without even capturing the
-- error, so pendingScreens silently becomes [] and no push ever fires --
-- for ANY new pending screen, not just the reset case this PR set out to
-- fix. Confirmed live before this migration:
--
--   UPDATE campaign_screens SET updated_at = now() WHERE id = '...';
--   ERROR: 42703: column "updated_at" of relation "campaign_screens"
--   does not exist
--
-- Worse: 20260809000001's fix, once applied, meant firing the reset
-- trigger (any INSERT/DELETE on campaign_creative_screens) hard-errored
-- and aborted the whole statement, since the column it tries to SET didn't
-- exist -- turning a silent notification gap into an active breakage of
-- campaign_creative_screens writes (i.e. creating any multi-creative
-- campaign). Caught and fixed same-session, before this branch merged.
--
-- Fix: add the column, with a BEFORE UPDATE trigger that bumps it on any
-- change -- not just the reset trigger's -- so this stays correct for
-- every existing and future write path (approve, reject, reset) without
-- each one needing to remember to set it manually.
-- ============================================================

ALTER TABLE campaign_screens ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION campaign_screens_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER campaign_screens_updated_at
  BEFORE UPDATE ON campaign_screens
  FOR EACH ROW
  EXECUTE FUNCTION campaign_screens_set_updated_at();
