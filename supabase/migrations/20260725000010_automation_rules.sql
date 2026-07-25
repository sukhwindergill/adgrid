-- ============================================================
-- Automated rules. One row per rule per owner.
--
-- `scope_campaign_id IS NULL` means the rule applies to every campaign the
-- owner has in flight. `last_fired_at` powers debouncing in ruleEvaluator.ts.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.automation_rules (
  id                bigserial PRIMARY KEY,
  owner_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_side        text NOT NULL CHECK (owner_side IN ('advertiser', 'operator')),
  name              text NOT NULL,
  metric            text NOT NULL CHECK (metric IN (
                      'cost_per_scan','pacing_ratio','offline_screen_minutes',
                      'billable_scans','plays','delivery_pct')),
  comparator        text NOT NULL CHECK (comparator IN ('gt','gte','lt','lte')),
  threshold         numeric NOT NULL,
  action            text NOT NULL DEFAULT 'notify' CHECK (action IN ('notify','pause_campaign')),
  scope_campaign_id text REFERENCES public.bookings(id) ON DELETE CASCADE,
  enabled           boolean NOT NULL DEFAULT true,
  last_fired_at     timestamptz,
  last_fired_value  numeric,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automation_rules_owner_idx ON public.automation_rules (owner_id, enabled);

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.automation_rules FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_rules TO authenticated;

DROP POLICY IF EXISTS "owner_select_rules" ON public.automation_rules;
CREATE POLICY "owner_select_rules" ON public.automation_rules
  FOR SELECT USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "owner_insert_rules" ON public.automation_rules;
CREATE POLICY "owner_insert_rules" ON public.automation_rules
  FOR INSERT WITH CHECK (owner_id = auth.uid());

-- The USING clause stops a user reassigning someone else's rule to themselves;
-- the WITH CHECK clause stops them handing their own rule to another user.
DROP POLICY IF EXISTS "owner_update_rules" ON public.automation_rules;
CREATE POLICY "owner_update_rules" ON public.automation_rules
  FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "owner_delete_rules" ON public.automation_rules;
CREATE POLICY "owner_delete_rules" ON public.automation_rules
  FOR DELETE USING (owner_id = auth.uid());
