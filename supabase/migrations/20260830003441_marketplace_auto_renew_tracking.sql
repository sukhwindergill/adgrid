ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;
ALTER TABLE marketplace_bookings ADD COLUMN IF NOT EXISTS advertiser_auto_renew boolean NOT NULL DEFAULT false;
