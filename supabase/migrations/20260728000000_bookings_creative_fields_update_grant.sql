-- The three Creative Studio columns weren't added to the advertiser
-- UPDATE allow-list (20260611000003_lock_bookings_update_columns.sql).
-- Not currently reachable -- no client code updates bookings after
-- submit yet, since INSERT is a separate privilege from UPDATE, which is
-- why the wizard's submit flow works fine without this -- but screens hit
-- this identical oversight class 2 days before this branch
-- (20260727000003_screens_creative_spec_column_grant.sql), so closing it
-- now pre-empts a confusing "permission denied for table bookings" the
-- first time a post-submit creative-edit flow is added.

GRANT UPDATE (creative_template, secondary_color, creative_font)
  ON public.bookings TO authenticated;
