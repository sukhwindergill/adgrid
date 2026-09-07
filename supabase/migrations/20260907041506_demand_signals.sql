-- ============================================================
-- Cold-start demand signal.
--
-- Supply-side liquidity is the binding constraint on growth right now
-- (see .agents/product-marketing.md). A prospective operator currently has
-- no way to know whether anyone is even looking for a screen like theirs —
-- listing is a leap of faith. This table logs the targeting an advertiser
-- actually searches (city + venue category) from StepTargeting.jsx, so
-- ScreenOnboard.jsx can show a real, honest count back to a new operator
-- instead of nothing.
--
-- Deliberately narrow and anonymous: no advertiser_id, no free text, just
-- the area/category shape of a search and when it happened. It is demand
-- *signal*, not a lead list, and is read only through the aggregate RPC
-- below — never as raw rows — so no operator ever sees who searched.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.demand_signals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city            text,
  venue_category  text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS demand_signals_city_category_idx
  ON public.demand_signals (city, venue_category, created_at DESC);

ALTER TABLE public.demand_signals ENABLE ROW LEVEL SECURITY;

-- Any signed-in advertiser can log a search. No SELECT policy is granted —
-- reads only happen through demand_signal_count() below, which returns a
-- number, never rows.
DROP POLICY IF EXISTS "authenticated_logs_demand_signal" ON public.demand_signals;
CREATE POLICY "authenticated_logs_demand_signal" ON public.demand_signals
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.demand_signal_count(p_city text, p_venue_category text, p_days integer DEFAULT 30)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT count(*)::integer
  FROM public.demand_signals
  WHERE created_at >= now() - (p_days || ' days')::interval
    AND (p_city IS NULL OR city ILIKE p_city)
    AND (p_venue_category IS NULL OR venue_category = p_venue_category);
$$;

GRANT EXECUTE ON FUNCTION public.demand_signal_count(text, text, integer) TO authenticated;
