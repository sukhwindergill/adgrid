-- Fixes infinite recursion (42P17) on marketplace_listings/marketplace_bookings.
--
-- advertiser_reads_own_booked_listings (on marketplace_listings) subqueries
-- marketplace_bookings. operator_sees_bookings_on_own_listings (on
-- marketplace_bookings) subqueries marketplace_listings right back. Postgres
-- evaluates the referenced table's RLS policies inside that subquery, so the
-- two policies call each other forever.
--
-- SECURITY DEFINER helper functions run as their owner (the migration role,
-- which owns both tables) and so bypass RLS on the table they read directly,
-- cutting the cycle at each edge.

CREATE OR REPLACE FUNCTION marketplace_booking_belongs_to_advertiser(p_listing_id uuid, p_advertiser_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM marketplace_bookings b
    WHERE b.listing_id = p_listing_id AND b.advertiser_id = p_advertiser_id
  );
$$;
REVOKE ALL ON FUNCTION marketplace_booking_belongs_to_advertiser(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION marketplace_booking_belongs_to_advertiser(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION marketplace_listing_operator_id(p_listing_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT operator_id FROM marketplace_listings WHERE id = p_listing_id;
$$;
REVOKE ALL ON FUNCTION marketplace_listing_operator_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION marketplace_listing_operator_id(uuid) TO authenticated;

DROP POLICY IF EXISTS "advertiser_reads_own_booked_listings" ON marketplace_listings;
CREATE POLICY "advertiser_reads_own_booked_listings" ON marketplace_listings
  FOR SELECT TO authenticated USING (
    marketplace_booking_belongs_to_advertiser(id, auth.uid())
  );

DROP POLICY IF EXISTS "operator_sees_bookings_on_own_listings" ON marketplace_bookings;
CREATE POLICY "operator_sees_bookings_on_own_listings" ON marketplace_bookings
  FOR SELECT USING (
    marketplace_listing_operator_id(listing_id) = auth.uid()
  );
