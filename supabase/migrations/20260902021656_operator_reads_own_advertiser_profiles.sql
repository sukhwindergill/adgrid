-- "No advertisers found" on the operator Advertisers page: 20260701051553
-- dropped the old platform-wide "Operators can read all profiles" policy
-- (rightly -- it exposed every user's email/stripe IDs to every operator)
-- but added no replacement. profiles now has only "Users can read own
-- profile" (id = auth.uid()), so an operator's query for advertiser
-- profiles returns zero rows regardless of real bookings.
--
-- Replacement: an operator may read an advertiser's profile only if that
-- advertiser has a booking targeting one of the operator's own screens --
-- same scoping AdvertisersView.jsx already applies client-side via
-- useOperatorCampaignIds. Uses a SECURITY DEFINER helper (same pattern as
-- operator_owns_booking_screen in 20260707082146) so the check reads
-- bookings/campaign_screens/screens directly, bypassing their RLS, and
-- can't re-trigger a policy that reads profiles back -- no recursion.

CREATE OR REPLACE FUNCTION public.operator_has_advertiser_booking(p_advertiser_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM bookings b
    JOIN campaign_screens cs ON cs.campaign_id = b.id
    JOIN screens s ON s.id = cs.screen_id
    WHERE b.advertiser_id = p_advertiser_id
      AND s.operator_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.operator_has_advertiser_booking(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.operator_has_advertiser_booking(uuid) TO authenticated;

DROP POLICY IF EXISTS "operator_reads_own_advertiser_profiles" ON public.profiles;
CREATE POLICY "operator_reads_own_advertiser_profiles" ON public.profiles
  FOR SELECT TO authenticated USING (
    public.operator_has_advertiser_booking(id)
  );
