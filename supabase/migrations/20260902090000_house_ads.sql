-- House ads: operator-owned bookings that play for free, only in airtime
-- not claimed by a paid campaign. is_house_ad marks the booking; the
-- payment_status/status columns stay under the existing service-role-only
-- lock (20260611000002_lock_bookings_update.sql) — this migration adds no
-- new client write path to either.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS is_house_ad boolean NOT NULL DEFAULT false;

-- A house-ad booking must never carry a real charge — enforced at the
-- schema level, not just in application code, since payment_status can
-- only be set server-side anyway but budget is not currently constrained.
ALTER TABLE public.bookings
  ADD CONSTRAINT house_ad_zero_budget
  CHECK (NOT is_house_ad OR budget = 0);

-- Operator-configurable ceiling (0-100) on the % of loop time house ads
-- may occupy on this screen. Enforced by display-feed only when a paid
-- campaign is also live on that poll — see houseAdCap.ts.
ALTER TABLE public.screens
  ADD COLUMN IF NOT EXISTS house_ad_max_pct numeric NOT NULL DEFAULT 20
  CHECK (house_ad_max_pct >= 0 AND house_ad_max_pct <= 100);

-- Operators already have "operators_see_own_screen_bookings" (SELECT,
-- scoped via campaign_screens -> screens.operator_id) from
-- 20260701050831_scope_operator_bookings_rls.sql, which covers house-ad
-- bookings on their own screens with no change needed. No new bookings
-- INSERT/UPDATE policy is added here: create-house-ad (Task 3) writes
-- via the service-role client, which bypasses RLS entirely by design,
-- matching the same pattern charge-campaign already uses for
-- payment_status/status.

-- Operators can update their own screen's cap the same way they already
-- update other screens.* settings columns (DetailsTab's existing update
-- call in ScreenDetail.jsx) -- no new column grant needed since screens
-- already allows the owning operator to UPDATE their own row.
