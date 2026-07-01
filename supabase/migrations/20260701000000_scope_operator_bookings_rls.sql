-- CRITICAL FIX: "Operators see all bookings" granted ALL (select/insert/update/
-- delete) on the entire bookings table to any user with role='operator', with
-- zero scoping to screens they actually own. Any operator account (trivial to
-- create — just register one screen) could read every advertiser's budget,
-- headline, destination_url, and city platform-wide, and — combined with the
-- column-level UPDATE grant on headline/cta_text/destination_url/accent_color —
-- rewrite creative/destination on ANY advertiser's campaign, not just ones
-- running on their own screens.
--
-- Replace with a policy scoped to bookings that actually have a
-- campaign_screens row pointing at one of the operator's own screens —
-- the same scoping pattern already used correctly in campaign_screens_rls.sql.
--
-- Operators get SELECT only. They never need to write bookings directly —
-- charge-campaign (service role) owns status/payment_status, and advertisers
-- own the content columns via the existing "Advertisers can update own
-- bookings" policy.

DROP POLICY IF EXISTS "Operators see all bookings" ON public.bookings;

CREATE POLICY "operators_see_own_screen_bookings" ON public.bookings
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM campaign_screens cs
      JOIN screens s ON s.id = cs.screen_id
      WHERE cs.campaign_id = bookings.id
        AND s.operator_id = auth.uid()
    )
  );
