-- Critical operational + security finding: every pg_cron job that calls a
-- CRON_SECRET-guarded edge function (screen-health-cron, notification-cron
-- x2, sweep-approvals, data-retention-cron) has been sending net.http_post
-- with NO headers at all -- confirmed via net._http_response: these jobs
-- have been returning 401 "Unauthorized" on effectively every single
-- scheduled run since requireCronSecret() was added. Screen health checks,
-- scheduled/pending-push notifications, SLA approval sweeps, and data
-- retention have all been silently no-ops. This is the same failure shape
-- as the pg_net content-type bug already fixed once in
-- 20260726034956_fix_cron_http_post_signature.sql ("no cron job that calls
-- an edge function had EVER succeeded") -- happening again, one layer up,
-- because the guard that fixed the earlier security gap was never wired
-- into the cron schedule that's supposed to satisfy it.
--
-- Separately: run-automation-rules and reconcile-delivery call NO guard at
-- all -- reconcile-delivery issues real account credits and
-- run-automation-rules can pause a live campaign, both fully public with
-- zero auth (anyone who finds the URL can trigger either on demand,
-- repeatedly). That is fixed in the same commit as this migration (see
-- run-automation-rules/index.ts and reconcile-delivery/index.ts).
--
-- Fix: generate a random secret *inside Postgres* (never appears in this
-- committed file, so it can't leak via git) and store it in Vault, then
-- rewrite every affected cron.schedule call to send it as the
-- `x-cron-secret` header net.http_post already supports.
--
-- IMPORTANT -- manual step still required: this migration cannot set the
-- edge functions' own CRON_SECRET environment variable (no tool/CLI access
-- to Supabase Edge Function secrets from this session). Until a human sets
-- CRON_SECRET on the project to match the value now stored in Vault
-- (`select decrypted_secret from vault.decrypted_secrets where name =
-- 'cron_secret'`), every one of these six cron jobs will continue to
-- 401 -- exactly as 4 of them already were. That is a strictly safer
-- failure mode than public exposure, and once the secret is set correctly
-- all six will start actually running for the first time.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'cron_secret') THEN
    PERFORM vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'cron_secret',
      'Shared secret sent as the x-cron-secret header by pg_cron to CRON_SECRET-guarded edge functions. Must match the CRON_SECRET env var configured on each guarded edge function.'
    );
  END IF;
END $$;

DO $$
DECLARE
  base text := 'https://hkqiuwnppxkkztacwicj.supabase.co/functions/v1/';
  j record;
BEGIN
  FOR j IN
    SELECT * FROM (VALUES
      ('screen-health-check',             'screen-health-cron'),
      ('notification-cron-pending-push',  'notification-cron'),
      ('daily-notifications',             'notification-cron'),
      ('data-retention-cron',             'data-retention-cron'),
      ('reconcile-delivery',              'reconcile-delivery'),
      ('run-automation-rules',            'run-automation-rules'),
      ('sweep-approvals',                 'sweep-approvals')
    ) AS t(jobname, fn)
  LOOP
    PERFORM cron.alter_job(
      (SELECT jobid FROM cron.job WHERE jobname = j.jobname),
      command := format(
        'SELECT net.http_post(url := %L, body := %L::jsonb, headers := jsonb_build_object(%L, %L, %L, (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = %L)));',
        base || j.fn,
        '{}',
        'Content-Type', 'application/json',
        'x-cron-secret', 'cron_secret'
      )
    );
  END LOOP;
END $$;
