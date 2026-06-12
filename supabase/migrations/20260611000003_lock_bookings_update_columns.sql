-- Column-level REVOKE in the previous migration was a no-op because
-- `authenticated` held a table-level UPDATE grant (Postgres keeps the broad
-- grant). Revoke table-level UPDATE and grant back only the non-financial
-- columns advertisers may edit. Edge functions use service_role (untouched).
REVOKE UPDATE ON public.bookings FROM authenticated;

GRANT UPDATE (
  advertiser_name,
  campaign_name,
  category,
  screen_id,
  screen_name,
  city,
  start_date,
  end_date,
  slots,
  duration,
  impressions,
  schedule_days,
  time_start,
  time_end,
  headline,
  subline,
  cta_text,
  accent_color,
  media_url,
  media_type,
  destination_url,
  qr_code_id,
  updated_at,
  asset_url,
  asset_type,
  budget_mode,
  start_when,
  peak_hours_preferred
) ON public.bookings TO authenticated;
