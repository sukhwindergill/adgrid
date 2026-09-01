-- ============================================================
-- Lifetime spend/scans totals for an advertiser, computed server-side.
--
-- AdvDashboard's "Spent to Date" KPI genuinely means all-time spend, not
-- just active campaigns -- unlike the operator Dashboard's "Total Booked"
-- tile (deliberately rescoped to active+scheduled only, see the
-- "decouple from the app-wide unbounded bookings fetch" series), scoping
-- this one down would silently understate real historical spend, which
-- reads as data loss rather than a simplification.
--
-- Rather than pull every booking row to sum client-side (the exact
-- unbounded-fetch problem this whole series exists to close) or rely on
-- PostgREST's optional aggregate-select feature (uncertain whether it's
-- enabled on this project), this is a plain SQL aggregate exposed as an
-- RPC -- the DB does the sum, one row comes back regardless of history size.
--
-- SECURITY INVOKER (the default) so RLS on `bookings` still applies --
-- this can only ever sum rows the caller is already allowed to see, same
-- as any other query. The explicit advertiser_id filter is belt-and-
-- suspenders on top of that, not a replacement for it.
-- ============================================================

CREATE OR REPLACE FUNCTION public.advertiser_lifetime_totals(p_advertiser_id uuid)
RETURNS TABLE (total_spend numeric, total_scans bigint, total_budget numeric)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COALESCE(SUM(spent), 0)  AS total_spend,
    COALESCE(SUM(scans), 0)  AS total_scans,
    COALESCE(SUM(budget), 0) AS total_budget
  FROM public.bookings
  WHERE advertiser_id = p_advertiser_id;
$$;

REVOKE ALL ON FUNCTION public.advertiser_lifetime_totals(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.advertiser_lifetime_totals(uuid) TO authenticated;
