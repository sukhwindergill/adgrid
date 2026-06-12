-- Snapshot billing currency on the booking at creation time so a later
-- change to profiles.preferred_currency cannot reprice an existing booking.
-- charge-campaign reads booking.currency instead of the advertiser's current
-- preference. Existing rows default to 'cad' (platform default).
ALTER TABLE public.bookings
  ADD COLUMN currency text NOT NULL DEFAULT 'cad';

-- Advertisers set currency at INSERT (table-level INSERT grant covers it) but
-- must not change it afterwards: do NOT add it to the authenticated UPDATE
-- column grants from 20260611000003_lock_bookings_update_columns.sql.
