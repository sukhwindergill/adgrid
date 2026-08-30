-- A campaign's destination_url is encoded into the QR printed on a public
-- screen. Two invariants, enforced at the database so they hold regardless of
-- which client writes the row — the app-level check in
-- src/lib/destinationUrl.js closes the wizard path, this closes every other.
--
-- 1. A PAID campaign must have a destination. Without one, scan-redirect
--    returns 400 to every scanner: the advertiser pays for plays and receives
--    nothing. Added NOT VALID because three seed rows (bkg-001/002/004) are
--    paid with a null destination. They are completed demo campaigns, so they
--    are grandfathered rather than back-filled with invented URLs — guessing
--    where someone's ad should send people is the advertiser's call.
--    NOT VALID skips only the existing-row scan; every INSERT and UPDATE is
--    still checked.
--
-- 2. Any stored destination must be http(s) with a dotted host. Blocks
--    javascript: and data: from ever being persisted, even by a direct API
--    call that bypasses the wizard. No existing row violates this, so it is
--    validated immediately.
--
-- Both verified against the live database: setting payment_status='paid' on a
-- null-destination row and writing 'javascript:alert(1)' were each rejected,
-- while a valid https URL followed by 'paid' succeeded.

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_paid_requires_destination;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_paid_requires_destination
  CHECK (payment_status IS DISTINCT FROM 'paid' OR destination_url IS NOT NULL)
  NOT VALID;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_destination_url_scheme;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_destination_url_scheme
  CHECK (destination_url IS NULL OR destination_url ~* '^https?://[^/\s]+\.[^/\s]+');
