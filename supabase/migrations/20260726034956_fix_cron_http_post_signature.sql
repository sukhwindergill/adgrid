-- ============================================================
-- Make cron jobs actually run. Two independent faults, both silent.
--
-- 1. pg_net was never installed, so `net.http_post` did not exist. Every job
--    that calls an edge function failed with:
--        ERROR: schema "net" does not exist
--
-- 2. Every job called it as:
--        net.http_post(url, '{}', 'application/json')
--    but pg_net's third positional parameter is `params jsonb`, not a
--    content-type string. 'application/json' is not valid JSON, so the jobs
--    would have failed even with the extension present:
--        ERROR: invalid input syntax for type json
--
-- Combined effect: no cron job that calls an edge function had EVER succeeded.
-- Measured over 24h before this fix: screen-health-check 288/288 failed,
-- notification-cron-pending-push 1440/1440 failed, plus every other job.
-- Only refresh-screen-audience-index worked, because it is pure SQL.
--
-- Correct form uses named arguments; the `headers` default already sets
-- Content-Type: application/json.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE
  base text := 'https://hkqiuwnppxkkztacwicj.supabase.co/functions/v1/';
  j record;
BEGIN
  FOR j IN
    SELECT * FROM (VALUES
      ('screen-health-check',             'screen-health-cron',    '*/5 * * * *'),
      ('notification-cron-pending-push',  'notification-cron',     '* * * * *'),
      ('daily-notifications',             'notification-cron',     '0 8 * * *'),
      ('data-retention-cron',             'data-retention-cron',   '0 3 * * *'),
      ('reconcile-delivery',              'reconcile-delivery',    '0 4 * * *'),
      ('run-automation-rules',            'run-automation-rules',  '*/15 * * * *'),
      ('sweep-approvals',                 'sweep-approvals',       '*/15 * * * *')
    ) AS t(jobname, fn, schedule)
  LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = j.jobname) THEN
      PERFORM cron.unschedule(j.jobname);
    END IF;

    PERFORM cron.schedule(
      j.jobname,
      j.schedule,
      format(
        'SELECT net.http_post(url := %L, body := %L::jsonb);',
        base || j.fn,
        '{}'
      )
    );
  END LOOP;
END $$;
