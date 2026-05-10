-- ============================================================
-- Screen tokens + payment tracking
-- ============================================================

-- Unique token for each screen (used by Display Player + Screen Agent)
ALTER TABLE screens ADD COLUMN IF NOT EXISTS screen_token uuid DEFAULT gen_random_uuid() UNIQUE;

-- Payment tracking on bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_intent_id text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid';

-- Operator screen configuration
ALTER TABLE screens ADD COLUMN IF NOT EXISTS cpm_floor numeric DEFAULT 3.00;
ALTER TABLE screens ADD COLUMN IF NOT EXISTS display_size text;
ALTER TABLE screens ADD COLUMN IF NOT EXISTS monthly_traffic_estimate integer;
ALTER TABLE screens ADD COLUMN IF NOT EXISTS content_categories_blocked text[] DEFAULT '{}';
ALTER TABLE screens ADD COLUMN IF NOT EXISTS operating_hours_start time DEFAULT '07:00';
ALTER TABLE screens ADD COLUMN IF NOT EXISTS operating_hours_end time DEFAULT '22:00';
