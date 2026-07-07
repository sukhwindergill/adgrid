-- ============================================================
-- CRITICAL FIX: infinite recursion between bookings and campaign_screens RLS.
--
-- 20260701000000 replaced an overbroad "operators see all bookings" policy
-- with `operators_see_own_screen_bookings`, an EXISTS subquery reading
-- campaign_screens directly. But campaign_screens' own SELECT policy
-- (`advertiser_read_own_campaign_screens`, from 20260607000000) is itself an
-- EXISTS subquery reading bookings. Any SELECT on bookings by an operator now
-- triggers: bookings RLS -> read campaign_screens -> campaign_screens RLS ->
-- read bookings -> bookings RLS -> ... Postgres detects the cycle and raises
-- "infinite recursion detected in policy for relation bookings" — confirmed
-- live via the operator dashboard's "Failed to load data" error and browser
-- console: "Failed to load campaigns: infinite recursion detected in policy
-- for relation bookings". This has been broken since 20260701000000 shipped;
-- only surfaced by actually loading the dashboard as an operator.
--
-- Fix: move the campaign_screens/screens ownership check into a SECURITY
-- DEFINER helper (same bypass-RLS pattern already used by is_operator() /
-- current_advertiser_id()). The helper's internal query runs as the
-- function's owner, which bypasses campaign_screens RLS entirely, so it
-- never re-triggers campaign_screens' policies and the cycle is broken.
-- ============================================================

CREATE OR REPLACE FUNCTION public.operator_owns_booking_screen(p_campaign_id text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM campaign_screens cs
    JOIN screens s ON s.id = cs.screen_id
    WHERE cs.campaign_id = p_campaign_id
      AND s.operator_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.operator_owns_booking_screen(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.operator_owns_booking_screen(text) TO authenticated;

DROP POLICY IF EXISTS "operators_see_own_screen_bookings" ON public.bookings;
CREATE POLICY "operators_see_own_screen_bookings" ON public.bookings
  FOR SELECT USING (
    public.operator_owns_booking_screen(bookings.id)
  );
