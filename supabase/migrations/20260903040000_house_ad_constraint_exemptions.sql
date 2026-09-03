-- Two pre-existing CHECK constraints on bookings were written before house
-- ads (is_house_ad, 20260902090000_house_ads.sql) existed, and never
-- account for them -- both were only discovered by actually attempting a
-- live create-house-ad insert, which every earlier review of that migration
-- checked in isolation without cross-referencing:
--
-- 1. bookings_budget_range (20260815131044_budget_bounds_check.sql) requires
--    budget > 0 for every row. House ads are inserted with budget = 0 by
--    design (house_ad_zero_budget, in the same house_ads migration, requires
--    exactly the opposite for is_house_ad rows) -- the two constraints were
--    mutually unsatisfiable, so no house ad could ever be created.
--
-- 2. bookings_paid_requires_destination
--    (20260726041330_bookings_destination_url_constraints.sql) requires a
--    destination_url whenever payment_status = 'paid'. House ads are always
--    payment_status = 'paid' (set by create-house-ad, never by the client),
--    but the wizard's Creative step explicitly allows a house ad to have no
--    destination_url ("Leave blank to run without one") -- house-ad signage
--    with no link/QR is a legitimate case this constraint blocked entirely.

ALTER TABLE public.bookings
  DROP CONSTRAINT bookings_budget_range;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_budget_range
  CHECK (is_house_ad OR (budget > 0 AND budget <= 1000000));

ALTER TABLE public.bookings
  DROP CONSTRAINT bookings_paid_requires_destination;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_paid_requires_destination
  CHECK (is_house_ad OR payment_status IS DISTINCT FROM 'paid' OR destination_url IS NOT NULL)
  NOT VALID;
