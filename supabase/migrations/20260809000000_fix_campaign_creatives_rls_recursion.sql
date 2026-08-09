-- ============================================================
-- CRITICAL FIX: infinite recursion between campaign_creatives and
-- campaign_creative_screens RLS.
--
-- 20260731000003 gave campaign_creatives an operator SELECT policy
-- (`operator_read_own_screen_creatives`) that's an EXISTS subquery reading
-- campaign_creative_screens directly. But campaign_creative_screens' own
-- SELECT policy (`advertiser_read_own_creative_screens`, same migration) is
-- itself an EXISTS subquery reading campaign_creatives. Any SELECT on either
-- table now triggers: campaign_creatives RLS -> read campaign_creative_screens
-- -> campaign_creative_screens RLS -> read campaign_creatives -> ... Postgres
-- detects the cycle and raises "infinite recursion detected in policy for
-- relation campaign_creatives" / "...campaign_creative_screens" -- confirmed
-- live via a direct authenticated-role query against production
-- (hkqiuwnppxkkztacwicj), both directions, independent of row count (0 rows
-- in either table today, so this has never surfaced through the app yet --
-- ApprovalQueue.jsx's fetch swallows the Postgres error the same way a
-- real "no rows" result looks, so the per-screen creative-mix feature it
-- powers has been silently non-functional since 20260731000003 shipped).
--
-- This is the exact same structural bug as 20260707000001's bookings /
-- campaign_screens recursion, on a different table pair. Same fix: move the
-- ownership check into a SECURITY DEFINER helper (bypass-RLS pattern already
-- used by operator_owns_booking_screen() / is_operator() /
-- current_advertiser_id()). The helper's internal query runs as the
-- function's owner, bypassing campaign_creative_screens' RLS entirely, so
-- evaluating campaign_creatives' operator policy never re-triggers
-- campaign_creative_screens' policies and the cycle is broken. Fixing this
-- one edge is sufficient (matches 20260707000001's precedent, which also
-- only touched one side) -- the only path back into campaign_creatives was
-- through this policy.
-- ============================================================

CREATE OR REPLACE FUNCTION public.operator_owns_creative(p_creative_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM campaign_creative_screens ccs
    JOIN screens s ON s.id = ccs.screen_id
    WHERE ccs.creative_id = p_creative_id
      AND s.operator_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.operator_owns_creative(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.operator_owns_creative(uuid) TO authenticated;

DROP POLICY IF EXISTS "operator_read_own_screen_creatives" ON public.campaign_creatives;
CREATE POLICY "operator_read_own_screen_creatives" ON public.campaign_creatives
  FOR SELECT USING (
    public.operator_owns_creative(campaign_creatives.id)
  );
