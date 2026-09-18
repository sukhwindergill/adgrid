-- CRITICAL security-audit finding: run-automation-rules' cron only
-- filtered scope_campaign_id-scoped rules by `c.id === rule.scope_campaign_id`
-- -- it never re-checked that the campaign actually belongs to the rule's
-- owner. The UI never exposes scope_campaign_id (AutomationRulesView.jsx's
-- addRule only ever sends name/metric/comparator/threshold/action), but
-- nothing enforced that server-side: a direct insert with the caller's own
-- JWT (owner_id = auth.uid() is the only INSERT check) could set
-- scope_campaign_id to ANY campaign in the system and action:
-- 'pause_campaign' with a trivially-true condition (e.g. metric:'plays',
-- comparator:'gte', threshold:0) -- letting any advertiser pause any OTHER
-- advertiser's live campaign on every cron run, indefinitely. Direct
-- competitive sabotage with real financial/delivery harm to the victim.
--
-- Fixed in two layers:
--   1. (this migration) RLS on automation_rules now validates, on both
--      INSERT and UPDATE, that a non-null scope_campaign_id actually
--      belongs to the owner -- the advertiser on that booking, or an
--      operator with a screen the booking targets.
--   2. (companion edge function change) run-automation-rules itself now
--      re-validates the same relationship before ever scoping a rule to a
--      campaign, so a row that predates this fix (or one written directly
--      by service_role, which bypasses RLS) can't be used to pause an
--      unrelated campaign either.
create or replace function public.automation_rule_scope_owned(
  p_owner_id uuid,
  p_owner_side text,
  p_campaign_id text
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select case
    when p_campaign_id is null then true
    when p_owner_side = 'operator' then exists (
      select 1
      from campaign_screens cs
      join screens s on s.id = cs.screen_id
      where cs.campaign_id = p_campaign_id
        and s.operator_id = p_owner_id
    )
    else exists (
      select 1 from bookings b
      where b.id = p_campaign_id
        and b.advertiser_id = p_owner_id
    )
  end;
$function$;

drop policy if exists "owner_insert_rules" on public.automation_rules;
create policy "owner_insert_rules" on public.automation_rules
  for insert
  with check (
    owner_id = auth.uid()
    and automation_rule_scope_owned(owner_id, owner_side, scope_campaign_id)
  );

drop policy if exists "owner_update_rules" on public.automation_rules;
create policy "owner_update_rules" on public.automation_rules
  for update
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and automation_rule_scope_owned(owner_id, owner_side, scope_campaign_id)
  );
