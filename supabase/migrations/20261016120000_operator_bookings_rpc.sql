-- ============================================================
-- Server-side operator scope for `bookings`.
--
-- Operator views (Campaigns list, Dashboard) used to resolve "which
-- bookings target one of my screens" on the client: fetch every
-- campaign_screens row for the operator's screens, collect the campaign
-- ids, then `bookings.in('id', [...ids])`. That id list grows without
-- bound (and eventually blows the URL length limit on the GET), and it
-- costs an extra round trip before the first page can load.
--
-- This moves the join to the database. It returns `setof bookings`, so
-- PostgREST lets callers chain the usual select/filter/order/range/count
-- on top of the RPC -- pagination, status filter and search all stay
-- server-side.
--
-- SECURITY INVOKER (the default): RLS on `bookings` still applies, so this
-- can only ever return rows the caller could already read. The
-- operator_id = auth.uid() join is what scopes it to "bookings on MY
-- screens" for a dual-role account (B27) -- the caller's own advertiser
-- bookings on someone else's screens are excluded.
--
-- p_screen_ids optionally narrows to a subset of the operator's screens
-- (the client passes its visible, non-demo screens so demo-mode gating
-- keeps working as before). NULL means all of the caller's screens.
-- ============================================================

CREATE OR REPLACE FUNCTION public.operator_bookings(p_screen_ids text[] DEFAULT NULL)
RETURNS SETOF public.bookings
LANGUAGE sql
STABLE
AS $$
  SELECT b.*
  FROM public.bookings b
  WHERE EXISTS (
    SELECT 1
    FROM public.campaign_screens cs
    JOIN public.screens s ON s.id = cs.screen_id
    WHERE cs.campaign_id = b.id
      AND s.operator_id = auth.uid()
      AND (p_screen_ids IS NULL OR cs.screen_id = ANY (p_screen_ids))
  );
$$;

REVOKE ALL ON FUNCTION public.operator_bookings(text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.operator_bookings(text[]) TO authenticated;

-- The EXISTS above probes campaign_screens by campaign_id (covered by the
-- UNIQUE (campaign_id, screen_id) index); bookings lists are ordered by
-- created_at and commonly filtered by advertiser_id + status.
CREATE INDEX IF NOT EXISTS bookings_advertiser_created_idx
  ON public.bookings (advertiser_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bookings_status_created_idx
  ON public.bookings (status, created_at DESC);
