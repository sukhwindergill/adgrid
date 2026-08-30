-- Area-level demographic estimate cache, keyed by screen. Refreshed on a
-- slow cadence by the screen-demographics edge function (census data doesn't
-- change day to day) — never queried live per-request against the source API.
CREATE TABLE IF NOT EXISTS screen_demographics (
  screen_id text PRIMARY KEY REFERENCES screens(id) ON DELETE CASCADE,
  area_geo_id text,
  median_age numeric,
  income_band text,
  source text NOT NULL DEFAULT 'us_census_acs',
  fetched_at timestamptz DEFAULT now()
);

ALTER TABLE screen_demographics ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "authenticated_reads_demographics" ON screen_demographics
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Only the service role (screen-demographics edge function) writes this cache.
