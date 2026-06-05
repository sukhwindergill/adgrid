CREATE TABLE IF NOT EXISTS campaign_screens (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id     text NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  screen_id       text NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'pending',
  headline        text,
  cta_text        text,
  accent_color    text,
  destination_url text,
  reject_reason   text,
  approved_at     timestamptz,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(campaign_id, screen_id)
);

CREATE TABLE IF NOT EXISTS approval_tokens (
  token       text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  campaign_id text NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  screen_id   text NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
  action      text NOT NULL,
  used        boolean DEFAULT false,
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '7 days',
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS budget_mode text DEFAULT 'total',
  ADD COLUMN IF NOT EXISTS start_when  text DEFAULT 'partial',
  ADD COLUMN IF NOT EXISTS peak_hours_preferred boolean DEFAULT false;

ALTER TABLE screens
  ADD COLUMN IF NOT EXISTS auto_approve boolean DEFAULT false;
