-- CRITICAL FIX: "Operators see all screens" granted ALL (select/insert/update/
-- delete) on the entire screens table to any user with role='operator', with
-- zero scoping to screens they own. Worse than the equivalent bookings bug
-- (fixed in 20260701000000): the screens table has no column-level GRANT
-- restrictions for `authenticated` at all, so this exposed every screen's
-- `screen_token` — the bearer secret used by the unauthenticated
-- display-feed and ingest-impressions endpoints — to any operator account.
-- With it, an operator could impersonate any screen, forge impression
-- stats, or read another operator's full screen row. Because the policy
-- was `ALL` (not just SELECT), an operator could also directly UPDATE
-- `operator_id` on someone else's screen (ownership theft) or DELETE it.
--
-- A correctly-scoped policy already exists: "operator_own_screens"
-- (operator_id = auth.uid()), which is ALL and covers every legitimate
-- operator use case (own dashboard, own approval queue, own screen CRUD).
-- No feature in the app browses cross-operator screens, so the broad
-- policy is dropped outright rather than re-scoped.

DROP POLICY IF EXISTS "Operators see all screens" ON public.screens;
