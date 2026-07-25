-- Runs at 04:00 UTC, after the 03:00 data-retention job and safely past
-- midnight in every Canadian timezone, so "yesterday" is closed everywhere.
SELECT cron.unschedule('reconcile-delivery')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconcile-delivery');

SELECT cron.schedule(
  'reconcile-delivery',
  '0 4 * * *',
  $$SELECT net.http_post('https://hkqiuwnppxkkztacwicj.supabase.co/functions/v1/reconcile-delivery', '{}', 'application/json');$$
);
