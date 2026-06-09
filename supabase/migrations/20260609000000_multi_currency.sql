-- Add preferred_currency to profiles (advertiser account-level preference)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferred_currency text DEFAULT 'cad';

-- Add currency to bookings (locked at charge time, never changes)
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'cad';

-- Fix payouts default — operator is Canadian, payouts settle in CAD
ALTER TABLE payouts
  ALTER COLUMN currency SET DEFAULT 'cad';
