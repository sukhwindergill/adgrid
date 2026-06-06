-- Add active_mode to profiles for unified operator/advertiser account switching.
-- NULL means apply smart default in app: active_mode in DB > has screens > advertiser.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS active_mode text DEFAULT NULL;
