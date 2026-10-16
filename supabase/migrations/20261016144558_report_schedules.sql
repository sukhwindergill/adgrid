-- ============================================================
-- Scheduled report emails.
--
-- A row asks report-schedule-cron to email a KPI summary, a share-report
-- link and a CSV of daily delivery to up to five addresses, weekly (Monday)
-- or monthly (the 1st). Scope is either one campaign or every campaign the
-- owner can see in their role:
--   audience 'advertiser' -> bookings.advertiser_id = owner
--   audience 'operator'   -> campaigns running on the owner's screens
--
-- The cron function reads this table with the service role and re-derives
-- the campaign set from the owner at send time, so a schedule never reaches
-- a campaign its owner has since lost access to.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.report_schedules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  audience      text NOT NULL CHECK (audience IN ('advertiser', 'operator')),
  scope         text NOT NULL CHECK (scope IN ('campaign', 'all')),
  campaign_id   text REFERENCES public.bookings(id) ON DELETE CASCADE,
  frequency     text NOT NULL CHECK (frequency IN ('weekly', 'monthly')),
  recipients    text[] NOT NULL CHECK (
    cardinality(recipients) BETWEEN 1 AND 5
    AND array_position(recipients, NULL) IS NULL
  ),
  next_run_at   timestamptz NOT NULL,
  last_sent_at  timestamptz,
  last_error    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT report_schedules_scope_campaign CHECK (
    (scope = 'campaign') = (campaign_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS report_schedules_due_idx
  ON public.report_schedules (next_run_at);
CREATE INDEX IF NOT EXISTS report_schedules_owner_idx
  ON public.report_schedules (owner_id);
CREATE INDEX IF NOT EXISTS report_schedules_campaign_idx
  ON public.report_schedules (campaign_id) WHERE campaign_id IS NOT NULL;

ALTER TABLE public.report_schedules ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.report_schedules FROM anon;
-- No UPDATE: changing a schedule is delete + create. Keeps clients from
-- rewriting next_run_at / last_sent_at, which only the cron function owns.
GRANT SELECT, INSERT, DELETE ON public.report_schedules TO authenticated;

DROP POLICY IF EXISTS "owner_select_report_schedules" ON public.report_schedules;
CREATE POLICY "owner_select_report_schedules" ON public.report_schedules
  FOR SELECT USING (owner_id = auth.uid());

-- Insert: the owner must actually have the access the schedule claims.
-- Ownership helpers are the existing SECURITY DEFINER ones, so this never
-- re-enters bookings/campaign_screens RLS (see fix_bookings_rls_recursion).
DROP POLICY IF EXISTS "owner_insert_report_schedules" ON public.report_schedules;
CREATE POLICY "owner_insert_report_schedules" ON public.report_schedules
  FOR INSERT WITH CHECK (
    owner_id = auth.uid()
    AND last_sent_at IS NULL
    AND last_error IS NULL
    AND (
      (audience = 'advertiser' AND (
        scope = 'all'
        OR EXISTS (
          SELECT 1 FROM public.bookings b
          WHERE b.id = report_schedules.campaign_id AND b.advertiser_id = auth.uid()
        )
      ))
      OR
      (audience = 'operator' AND public.is_operator() AND (
        scope = 'all'
        OR public.operator_owns_booking_screen(report_schedules.campaign_id)
      ))
    )
  );

DROP POLICY IF EXISTS "owner_delete_report_schedules" ON public.report_schedules;
CREATE POLICY "owner_delete_report_schedules" ON public.report_schedules
  FOR DELETE USING (owner_id = auth.uid());

-- Hourly sweep; the function sends whatever is due, so a missed hour just
-- delays a report rather than dropping it. Same x-cron-secret wiring as the
-- other guarded cron jobs (20260909150503_fix_cron_jobs_never_send_auth_header).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'report-schedule-cron') THEN
    PERFORM cron.unschedule('report-schedule-cron');
  END IF;
  PERFORM cron.schedule(
    'report-schedule-cron',
    '7 * * * *',
    format(
      'SELECT net.http_post(url := %L, body := %L::jsonb, headers := jsonb_build_object(%L, %L, %L, (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = %L)));',
      'https://hkqiuwnppxkkztacwicj.supabase.co/functions/v1/report-schedule-cron',
      '{}',
      'Content-Type', 'application/json',
      'x-cron-secret', 'cron_secret'
    )
  );
END $$;
