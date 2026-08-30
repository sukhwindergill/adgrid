-- The three marketplace read policies below were named authenticated_reads_*
-- but never scoped `TO authenticated`, so they applied to PUBLIC (including
-- anon) — an unauthenticated caller with only the public anon key could read
-- active marketplace listings, per-screen census demographic estimates, and
-- the internal platform fee config with no login. Re-create each scoped to
-- `authenticated` only, matching the pattern already used correctly by
-- benchmark_stats/lift_stats/delivery_check_stats.

DROP POLICY IF EXISTS "authenticated_reads_active_listings" ON marketplace_listings;
CREATE POLICY "authenticated_reads_active_listings" ON marketplace_listings
  FOR SELECT TO authenticated USING (status = 'active');

DROP POLICY IF EXISTS "authenticated_reads_demographics" ON screen_demographics;
CREATE POLICY "authenticated_reads_demographics" ON screen_demographics
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_reads_config" ON platform_config;
CREATE POLICY "authenticated_reads_config" ON platform_config
  FOR SELECT TO authenticated USING (true);
