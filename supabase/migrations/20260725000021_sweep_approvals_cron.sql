SELECT cron.unschedule('sweep-approvals')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sweep-approvals');

SELECT cron.schedule(
  'sweep-approvals',
  '*/15 * * * *',
  $$SELECT net.http_post('https://hkqiuwnppxkkztacwicj.supabase.co/functions/v1/sweep-approvals', '{}', 'application/json');$$
);
