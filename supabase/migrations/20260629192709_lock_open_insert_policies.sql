-- Revoke open INSERT policies on telemetry tables.
-- These tables are written exclusively by edge functions via the service role,
-- which bypasses RLS. Leaving WITH CHECK (true) on authenticated/anon lets any
-- logged-in user forge scan counts, impression metrics, and heartbeats.

-- scans: service role only (via scan-redirect edge function)
DROP POLICY IF EXISTS "service_insert_scans" ON scans;

-- impression_events: service role only (via ingest-impressions edge function)
DROP POLICY IF EXISTS "service_insert_impressions" ON impression_events;

-- display_heartbeats: service role only (via display-feed edge function)
DROP POLICY IF EXISTS "service_insert_heartbeats" ON display_heartbeats;

-- Explicitly deny authenticated and anon roles so no future policy accidentally
-- reopens the tables.
REVOKE INSERT ON scans FROM authenticated, anon;
REVOKE INSERT ON impression_events FROM authenticated, anon;
REVOKE INSERT ON display_heartbeats FROM authenticated, anon;
