-- ============================================================
-- Schedule data-retention-cron to enforce the retention windows promised
-- in the Privacy Policy (screen telemetry/heartbeats: 12 months, QR scans:
-- 24 months). Daily at 03:00 UTC, matching the existing pg_cron jobs for
-- notification-cron / screen-health-cron (those were scheduled ad hoc via
-- the dashboard and never tracked in a migration; this one is, going forward).
-- ============================================================

SELECT cron.schedule(
  'data-retention-cron',
  '0 3 * * *',
  $$SELECT net.http_post('https://hkqiuwnppxkkztacwicj.supabase.co/functions/v1/data-retention-cron', '{}', 'application/json');$$
);
