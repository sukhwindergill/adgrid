-- Marketplace: an operator should not be able to directly cancel/edit a
-- listing that already has a paid booking against it (status = 'booked'),
-- since marketplace_bookings has ON DELETE RESTRICT on listing_id but no
-- protection against the listing row itself being mutated out from under
-- the booking. The original operator_manages_own_listings policy was
-- FOR ALL, letting an operator UPDATE a booked listing's status directly.
-- Replace it with separate policies: full owner access stays for
-- SELECT/INSERT, but UPDATE is scoped to listings that are still
-- 'draft'/'active' (not yet booked). DELETE also loses direct owner access
-- here since a 'booked' listing shouldn't be removable this way either —
-- op-initiated cancellation is done via the status column, not a delete.

DROP POLICY IF EXISTS "operator_manages_own_listings" ON marketplace_listings;

DO $$ BEGIN
  CREATE POLICY "operator_selects_own_listings" ON marketplace_listings
    FOR SELECT USING (operator_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "operator_inserts_own_listings" ON marketplace_listings
    FOR INSERT WITH CHECK (operator_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "operator_updates_unbooked_own_listings" ON marketplace_listings
    FOR UPDATE
    USING (operator_id = auth.uid() AND status IN ('draft', 'active'))
    WITH CHECK (operator_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
