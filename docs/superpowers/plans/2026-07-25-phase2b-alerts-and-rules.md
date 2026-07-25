# Phase 2B: Alerts & Automated Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tell an advertiser their money is being wasted *while it is happening* — a screen dark mid-flight, spend pacing to underdeliver, cost-per-scan drifting — and let them set rules that act automatically. Meta and TikTok both ship this free; AdGrid has only milestone notifications today.

**Architecture:** A pure evaluator takes a rule plus a metrics snapshot and returns whether the rule fires. A 15-minute cron builds the snapshot per campaign from `campaign_delivery_daily` (Phase 1) and screen health, runs every enabled rule through the evaluator, and executes the action — notify, pause, or adjust daily budget. Firing is debounced per rule so one bad afternoon does not send twelve emails.

**Tech Stack:** Supabase Postgres + Deno edge functions (TS), pg_cron + pg_net, React 19 (JS), vitest.

**Depends on:** Phase 1 (`campaign_delivery_daily`). Phase 2A is **not** required — the offline-screen alert reads `screens.health_status` directly, not reconciliation.

> **If Phase 2A is not built yet:** the snapshot builder queries `campaign_delivery_health`, which 2A creates. That query returning an error is harmless — `delivery_pct` becomes `null`, and `evaluateRule` never fires on a null metric — so the `delivery_pct` metric is simply inert until 2A lands. Do not add the metric to a rule before then, and do not "fix" the missing view by creating a stub.

---

## Context an engineer needs before starting

**Verified against the production database on 2026-07-25.**

- **IDs are `text`:** `bookings.id`, `screens.id`, `campaign_screens.campaign_id/screen_id`. `profiles.id`, `bookings.advertiser_id`, `screens.operator_id` are `uuid`.
- **`bookings`** carries `budget integer`, `spent integer`, `budget_mode text` (`total` | `daily`), `start_date date`, `end_date date`, `status text`, `payment_status text`, `currency text`, `advertiser_id uuid`, `campaign_name text`, `advertiser_name text`.
- **Campaign statuses in use:** `pending_review`, `scheduled`, `active`, `completed`. Only `scheduled` and `active` are in flight.
- **`screens`** carries `health_status text` (`online` | `idle` | `offline`), `last_seen timestamptz`, `operator_id uuid`, `name text`. `screen-health-cron` maintains `health_status` every 5 minutes (offline after 60 min of silence, idle after 5).
- **`campaign_delivery_daily`** (Phase 1) gives `campaign_id, screen_id, day, plays, impressions, basis, scans, billable_scans`. Use `billable_scans` for anything cost-related — raw `scans` includes bots and duplicates.
- **`send-notification` 400s on an unknown type.** Every new alert type must be added to `TEMPLATES` in `supabase/functions/send-notification/index.ts` first. There are 17 today (see the Phase 2A plan for the list).
- **Crons call functions over HTTP** via `net.http_post`, see `supabase/migrations/20260707000000_data_retention_cron_schedule.sql`. Functions invoked this way **must be deployed with `--no-verify-jwt`** or the gateway 401s first.
- **Views that read `public.screens` cannot use `security_invoker = true`** — `authenticated` has no SELECT on `screens`. Scope owner-executed views on `current_user IN ('postgres','supabase_admin','service_role') OR …auth.uid()…`, never on `auth.role()` (an absent JWT claim would widen access — this was a real leak in Phase 1).
- Run `pnpm test`. `pnpm lint` is not a usable gate (~1001 pre-existing problems); lint only files you touched.

---

## File Structure

**Created:**
| Path | Responsibility |
|---|---|
| `supabase/functions/_shared/ruleEvaluator.ts` | Pure: does this rule fire against this snapshot? |
| `supabase/functions/_shared/ruleEvaluator.test.js` | Tests for the above |
| `supabase/functions/_shared/pacing.ts` | Pure: flight progress and expected-spend pacing |
| `supabase/functions/_shared/pacing.test.js` | Tests for the above |
| `supabase/migrations/20260725000010_automation_rules.sql` | Rules table + RLS + defaults trigger |
| `supabase/migrations/20260725000011_run_rules_cron.sql` | 15-minute cron |
| `supabase/functions/run-automation-rules/index.ts` | Snapshot builder + rule runner + actions |
| `src/views/shared/AutomationRulesView.jsx` | Rule list / toggle / create UI |

**Modified:**
| Path | Change |
|---|---|
| `supabase/functions/send-notification/index.ts` | Add 4 alert templates |
| `src/components/layout/Sidebar.jsx` | Add "Alerts & Rules" nav item to both modes |
| `src/App.jsx` | Route the new view |

---

## Task 1: Pacing math (pure)

**Files:**
- Create: `supabase/functions/_shared/pacing.ts`, `supabase/functions/_shared/pacing.test.js`

- [ ] **Step 1: Write the failing test at `supabase/functions/_shared/pacing.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { flightProgress, pacingRatio, projectedFinalSpend } from './pacing.ts';

const on = (d) => new Date(`${d}T12:00:00Z`);

describe('flightProgress', () => {
  it('is 0 before the flight starts', () => {
    expect(flightProgress('2026-07-10', '2026-07-20', on('2026-07-01'))).toBe(0);
  });

  it('is 1 after the flight ends', () => {
    expect(flightProgress('2026-07-10', '2026-07-20', on('2026-07-25'))).toBe(1);
  });

  it('is the elapsed fraction mid-flight', () => {
    // Continuous time, not whole days: an 11-day flight at noon on day 6 is
    // 5.5 of 11 days elapsed.
    expect(flightProgress('2026-07-10', '2026-07-20', on('2026-07-15'))).toBeCloseTo(0.5, 2);
  });

  it('progresses through a single-day flight rather than jumping to 1', () => {
    expect(flightProgress('2026-07-15', '2026-07-15', on('2026-07-15'))).toBeCloseTo(0.5, 1);
  });

  it('returns 0 for unparseable dates', () => {
    expect(flightProgress(null, '2026-07-20', on('2026-07-15'))).toBe(0);
    expect(flightProgress('2026-07-10', 'nonsense', on('2026-07-15'))).toBe(0);
  });
});

describe('pacingRatio', () => {
  it('is 1 when spend tracks the flight exactly', () => {
    expect(pacingRatio(50, 100, 0.5)).toBeCloseTo(1, 6);
  });

  it('is below 1 when underspending', () => {
    expect(pacingRatio(25, 100, 0.5)).toBeCloseTo(0.5, 6);
  });

  it('is above 1 when overspending', () => {
    expect(pacingRatio(75, 100, 0.5)).toBeCloseTo(1.5, 6);
  });

  it('is null when the flight has not started, so nothing is "behind" yet', () => {
    expect(pacingRatio(0, 100, 0)).toBeNull();
  });

  it('is null when there is no budget to pace against', () => {
    expect(pacingRatio(0, 0, 0.5)).toBeNull();
  });
});

describe('projectedFinalSpend', () => {
  it('extrapolates current spend across the full flight', () => {
    expect(projectedFinalSpend(25, 0.5)).toBeCloseTo(50, 6);
  });

  it('returns null before the flight starts', () => {
    expect(projectedFinalSpend(0, 0)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test supabase/functions/_shared/pacing.test.js`
Expected: FAIL — cannot resolve `./pacing.ts`.

- [ ] **Step 3: Write `supabase/functions/_shared/pacing.ts`**

```ts
// Flight pacing. Pure — no Deno APIs — so vitest runs it directly.
//
// Returns null rather than a number whenever a comparison is meaningless
// (flight not started, no budget). Callers must not fire an alert on null:
// "0% paced" on day zero is not a problem, it is arithmetic.

export function flightProgress(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  now: Date = new Date(),
): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T23:59:59Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    // A single-day flight is either not started or fully elapsed.
    if (Number.isFinite(start) && now.getTime() >= start) return 1;
    return 0;
  }
  const t = now.getTime();
  if (t <= start) return 0;
  if (t >= end) return 1;
  return (t - start) / (end - start);
}

export function pacingRatio(
  spent: number,
  budget: number,
  progress: number,
): number | null {
  const s = Number(spent);
  const b = Number(budget);
  const p = Number(progress);
  if (!Number.isFinite(s) || !Number.isFinite(b) || !Number.isFinite(p)) return null;
  if (b <= 0 || p <= 0) return null;
  const expectedSpend = b * p;
  if (expectedSpend <= 0) return null;
  return s / expectedSpend;
}

export function projectedFinalSpend(spent: number, progress: number): number | null {
  const s = Number(spent);
  const p = Number(progress);
  if (!Number.isFinite(s) || !Number.isFinite(p) || p <= 0) return null;
  return s / p;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test supabase/functions/_shared/pacing.test.js`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/pacing.ts supabase/functions/_shared/pacing.test.js
git commit -m "feat: add flight pacing math"
```

---

## Task 2: Rule evaluator (pure)

**Files:**
- Create: `supabase/functions/_shared/ruleEvaluator.ts`, `supabase/functions/_shared/ruleEvaluator.test.js`

A rule is `{ metric, comparator, threshold }` evaluated against a snapshot of named metrics. Unknown metrics and null values never fire — an alert on missing data is worse than no alert.

- [ ] **Step 1: Write the failing test at `supabase/functions/_shared/ruleEvaluator.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { METRICS, COMPARATORS, evaluateRule, shouldNotify, DEBOUNCE_MS } from './ruleEvaluator.ts';

const rule = (over = {}) => ({
  id: 'r1', metric: 'cost_per_scan', comparator: 'gt', threshold: 5,
  enabled: true, last_fired_at: null, ...over,
});

describe('evaluateRule', () => {
  it('fires when the metric exceeds the threshold', () => {
    expect(evaluateRule(rule(), { cost_per_scan: 6 }).fired).toBe(true);
  });

  it('does not fire when the metric is under the threshold', () => {
    expect(evaluateRule(rule(), { cost_per_scan: 4 }).fired).toBe(false);
  });

  it('gt is strict at the boundary', () => {
    expect(evaluateRule(rule(), { cost_per_scan: 5 }).fired).toBe(false);
  });

  it('supports lt', () => {
    expect(evaluateRule(rule({ metric: 'pacing_ratio', comparator: 'lt', threshold: 0.6 }), { pacing_ratio: 0.4 }).fired).toBe(true);
    expect(evaluateRule(rule({ metric: 'pacing_ratio', comparator: 'lt', threshold: 0.6 }), { pacing_ratio: 0.8 }).fired).toBe(false);
  });

  it('supports gte and lte', () => {
    expect(evaluateRule(rule({ comparator: 'gte', threshold: 5 }), { cost_per_scan: 5 }).fired).toBe(true);
    expect(evaluateRule(rule({ metric: 'pacing_ratio', comparator: 'lte', threshold: 0.5 }), { pacing_ratio: 0.5 }).fired).toBe(true);
  });

  it('never fires on a null metric value', () => {
    const r = evaluateRule(rule(), { cost_per_scan: null });
    expect(r.fired).toBe(false);
    expect(r.reason).toBe('metric_unavailable');
  });

  it('never fires on a missing metric key', () => {
    expect(evaluateRule(rule(), {}).reason).toBe('metric_unavailable');
  });

  it('never fires on a NaN metric value', () => {
    expect(evaluateRule(rule(), { cost_per_scan: NaN }).reason).toBe('metric_unavailable');
  });

  it('rejects an unknown metric', () => {
    expect(evaluateRule(rule({ metric: 'vibes' }), { vibes: 99 }).reason).toBe('unknown_metric');
  });

  it('rejects an unknown comparator', () => {
    expect(evaluateRule(rule({ comparator: 'approximately' }), { cost_per_scan: 6 }).reason).toBe('unknown_comparator');
  });

  it('does not fire when the rule is disabled', () => {
    expect(evaluateRule(rule({ enabled: false }), { cost_per_scan: 99 }).reason).toBe('disabled');
  });

  it('exposes the metric and comparator catalogues', () => {
    expect(METRICS).toContain('cost_per_scan');
    expect(METRICS).toContain('pacing_ratio');
    expect(METRICS).toContain('offline_screen_minutes');
    expect(METRICS).toContain('billable_scans');
    expect(COMPARATORS).toEqual(['gt', 'gte', 'lt', 'lte']);
  });
});

describe('shouldNotify', () => {
  const now = new Date('2026-07-25T12:00:00Z');

  it('notifies when the rule has never fired', () => {
    expect(shouldNotify(rule({ last_fired_at: null }), now)).toBe(true);
  });

  it('suppresses a repeat inside the debounce window', () => {
    const recent = new Date(now.getTime() - DEBOUNCE_MS / 2).toISOString();
    expect(shouldNotify(rule({ last_fired_at: recent }), now)).toBe(false);
  });

  it('notifies again once the debounce window has passed', () => {
    const old = new Date(now.getTime() - DEBOUNCE_MS - 1000).toISOString();
    expect(shouldNotify(rule({ last_fired_at: old }), now)).toBe(true);
  });

  it('debounces for 6 hours', () => {
    expect(DEBOUNCE_MS).toBe(6 * 60 * 60 * 1000);
  });

  it('notifies when last_fired_at is unparseable rather than staying silent forever', () => {
    expect(shouldNotify(rule({ last_fired_at: 'garbage' }), now)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test supabase/functions/_shared/ruleEvaluator.test.js`
Expected: FAIL — cannot resolve `./ruleEvaluator.ts`.

- [ ] **Step 3: Write `supabase/functions/_shared/ruleEvaluator.ts`**

```ts
// Rule evaluation. Pure — no Deno APIs, no database.
//
// Two hard rules, both about not crying wolf:
//   1. A missing or non-finite metric NEVER fires. An alert produced by absent
//      data is worse than no alert, because it teaches people to ignore alerts.
//   2. Firing is debounced per rule, so a condition that stays true for an
//      afternoon produces one message, not twenty.

export const METRICS = [
  'cost_per_scan',          // spend / billable scans, campaign to date
  'pacing_ratio',           // spend vs. flight progress; 1.0 is on pace
  'offline_screen_minutes', // longest current offline stretch on a booked screen
  'billable_scans',         // bot/duplicate-filtered scans, campaign to date
  'plays',                  // proof-of-play count, campaign to date
  'delivery_pct',           // delivered / expected plays, if reconciliation exists
] as const;

export const COMPARATORS = ['gt', 'gte', 'lt', 'lte'] as const;

export const DEBOUNCE_MS = 6 * 60 * 60 * 1000;

export type Metric = typeof METRICS[number];
export type Comparator = typeof COMPARATORS[number];

export interface Rule {
  id: string;
  metric: string;
  comparator: string;
  threshold: number;
  enabled: boolean;
  last_fired_at?: string | null;
}

export type Snapshot = Record<string, number | null | undefined>;

export interface Evaluation {
  fired: boolean;
  reason: string | null;
  value: number | null;
}

export function evaluateRule(rule: Rule, snapshot: Snapshot): Evaluation {
  const no = (reason: string, value: number | null = null): Evaluation => ({ fired: false, reason, value });

  if (!rule?.enabled) return no('disabled');
  if (!(METRICS as readonly string[]).includes(rule.metric)) return no('unknown_metric');
  if (!(COMPARATORS as readonly string[]).includes(rule.comparator)) return no('unknown_comparator');

  const raw = snapshot?.[rule.metric];
  const value = Number(raw);
  if (raw === null || raw === undefined || !Number.isFinite(value)) return no('metric_unavailable');

  const threshold = Number(rule.threshold);
  if (!Number.isFinite(threshold)) return no('invalid_threshold', value);

  let fired = false;
  switch (rule.comparator) {
    case 'gt':  fired = value >  threshold; break;
    case 'gte': fired = value >= threshold; break;
    case 'lt':  fired = value <  threshold; break;
    case 'lte': fired = value <= threshold; break;
  }

  return { fired, reason: fired ? null : 'not_met', value };
}

export function shouldNotify(rule: Rule, now: Date = new Date()): boolean {
  if (!rule?.last_fired_at) return true;
  const last = new Date(rule.last_fired_at).getTime();
  // An unparseable timestamp must not silence a rule forever.
  if (!Number.isFinite(last)) return true;
  return now.getTime() - last >= DEBOUNCE_MS;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test supabase/functions/_shared/ruleEvaluator.test.js`
Expected: PASS, 17 tests.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/ruleEvaluator.ts supabase/functions/_shared/ruleEvaluator.test.js
git commit -m "feat: add automation rule evaluator"
```

---

## Task 3: `automation_rules` table

**Files:**
- Create: `supabase/migrations/20260725000010_automation_rules.sql`

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Apply via the Supabase MCP `apply_migration` (project `hkqiuwnppxkkztacwicj`, name `automation_rules`)**

Do not use `supabase db push` — remote migration history does not match local filenames (pre-existing drift).

- [ ] **Step 3: Verify RLS actually scopes rules**

```sql
insert into automation_rules (owner_id, owner_side, name, metric, comparator, threshold)
select id, 'advertiser', 'probe', 'cost_per_scan', 'gt', 5 from profiles limit 1
returning id, owner_id;
```
Then, as a different user:
```sql
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000ff","role":"authenticated"}';
select count(*) from automation_rules;
```
Expected: `0`. Then delete the probe row:
```sql
delete from automation_rules where name = 'probe';
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260725000010_automation_rules.sql
git commit -m "feat: add automation_rules table"
```

---

## Task 4: Alert notification templates

**Files:**
- Modify: `supabase/functions/send-notification/index.ts`

- [ ] **Step 1: Add four templates to the `TEMPLATES` object**

Match the surrounding style — each returns `{ title, body, html }` using the shared `emailHtml` helper:

```ts
  screen_offline_during_flight: (d) => ({
    title: "A screen went dark on your campaign",
    body: `${d.screenName} has been offline for ${d.offlineMinutes} minutes while "${d.campaignName}" is live.`,
    html: emailHtml(
      "A screen went dark on your campaign",
      `<strong>${d.screenName}</strong> has been offline for ${d.offlineMinutes} minutes while your campaign <strong>${d.campaignName}</strong> is scheduled to run. You are not receiving the plays you booked on this screen.`,
      "View Campaign",
      d.appUrl ?? "",
    ),
  }),
  campaign_pacing_behind: (d) => ({
    title: "Campaign is pacing behind",
    body: `"${d.campaignName}" has spent ${d.spentPct}% of budget with ${d.elapsedPct}% of the flight elapsed.`,
    html: emailHtml(
      "Campaign is pacing behind",
      `Your campaign <strong>${d.campaignName}</strong> has spent ${d.spentPct}% of its budget with ${d.elapsedPct}% of the flight elapsed. At this rate it will under-deliver before the end date.`,
      "View Campaign",
      d.appUrl ?? "",
    ),
  }),
  cost_per_scan_high: (d) => ({
    title: "Cost per scan above your target",
    body: `"${d.campaignName}" is at ${d.costPerScan} per scan, above your ${d.threshold} target.`,
    html: emailHtml(
      "Cost per scan above your target",
      `Your campaign <strong>${d.campaignName}</strong> is currently at <strong>${d.costPerScan}</strong> per scan, above the ${d.threshold} target you set.`,
      "View Campaign",
      d.appUrl ?? "",
    ),
  }),
  rule_paused_campaign: (d) => ({
    title: "A rule paused your campaign",
    body: `"${d.campaignName}" was paused automatically: ${d.ruleName}.`,
    html: emailHtml(
      "A rule paused your campaign",
      `Your campaign <strong>${d.campaignName}</strong> was paused automatically by your rule <strong>${d.ruleName}</strong> (${d.metric} was ${d.value}). Nothing further will be spent until you resume it.`,
      "View Campaign",
      d.appUrl ?? "",
    ),
  }),
```

- [ ] **Step 2: Deploy and verify the template count**

```bash
pnpm dlx supabase functions deploy send-notification
```

Run: `grep -c "html: emailHtml" supabase/functions/send-notification/index.ts`
Expected: 21 if Phase 2A already added its two (17 + 2 + 4), otherwise 21 minus those.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/send-notification/index.ts
git commit -m "feat: add automation alert notification templates"
```

---

## Task 5: `run-automation-rules` edge function

**Files:**
- Create: `supabase/functions/run-automation-rules/index.ts`

- [ ] **Step 1: Write `supabase/functions/run-automation-rules/index.ts`**

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { evaluateRule, shouldNotify } from "../_shared/ruleEvaluator.ts";
import { flightProgress, pacingRatio } from "../_shared/pacing.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const FUNCTIONS_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
const INTERNAL_SECRET = Deno.env.get("INTERNAL_NOTIFICATION_SECRET") ?? "";
const APP_URL = Deno.env.get("PUBLIC_APP_URL") ?? "";
const CORS = { "Content-Type": "application/json" };

// Which notification each metric sends when it fires with action = 'notify'.
const METRIC_NOTIFICATION: Record<string, string> = {
  offline_screen_minutes: "screen_offline_during_flight",
  pacing_ratio: "campaign_pacing_behind",
  cost_per_scan: "cost_per_scan_high",
  billable_scans: "cost_per_scan_high",
  plays: "cost_per_scan_high",
  delivery_pct: "campaign_pacing_behind",
};

async function notify(userId: string, type: string, data: Record<string, string>) {
  if (!userId) return;
  await fetch(`${FUNCTIONS_URL}/send-notification`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-secret": INTERNAL_SECRET },
    body: JSON.stringify({ userId, type, data }),
  }).catch(() => {});
}

Deno.serve(async (_req: Request) => {
  const now = new Date();

  const { data: rules } = await supabase
    .from("automation_rules")
    .select("id, owner_id, owner_side, name, metric, comparator, threshold, action, scope_campaign_id, enabled, last_fired_at")
    .eq("enabled", true);

  if (!rules || rules.length === 0) {
    return new Response(JSON.stringify({ ok: true, rules: 0, fired: 0 }), { headers: CORS });
  }

  // Every campaign currently in flight. A rule can only be about a live
  // campaign — alerting on a finished one is noise.
  const { data: campaigns } = await supabase
    .from("bookings")
    .select("id, advertiser_id, campaign_name, advertiser_name, budget, spent, currency, start_date, end_date, status")
    .in("status", ["scheduled", "active"]);

  const liveCampaigns = campaigns ?? [];
  let firedCount = 0;

  // Snapshot cache: one build per campaign, reused across that campaign's rules.
  const snapshots = new Map<string, Record<string, number | null>>();

  async function snapshotFor(campaign: Record<string, unknown>) {
    const id = campaign.id as string;
    if (snapshots.has(id)) return snapshots.get(id)!;

    const { data: delivery } = await supabase
      .from("campaign_delivery_daily")
      .select("plays, billable_scans")
      .eq("campaign_id", id);

    const plays = (delivery ?? []).reduce((a, r) => a + (Number(r.plays) || 0), 0);
    const billableScans = (delivery ?? []).reduce((a, r) => a + (Number(r.billable_scans) || 0), 0);

    const spent = Number(campaign.spent) || 0;
    const progress = flightProgress(campaign.start_date as string, campaign.end_date as string, now);

    // Longest current offline stretch across this campaign's booked screens.
    const { data: cs } = await supabase
      .from("campaign_screens")
      .select("screen_id")
      .eq("campaign_id", id)
      .in("status", ["approved", "auto_approved"]);

    let offlineMinutes: number | null = null;
    let offlineScreenName = "";
    const screenIds = (cs ?? []).map(r => r.screen_id as string);
    if (screenIds.length > 0) {
      const { data: screens } = await supabase
        .from("screens")
        .select("id, name, health_status, last_seen")
        .in("id", screenIds)
        .eq("health_status", "offline");

      for (const s of screens ?? []) {
        if (!s.last_seen) continue;
        const mins = Math.round((now.getTime() - new Date(s.last_seen as string).getTime()) / 60000);
        if (offlineMinutes === null || mins > offlineMinutes) {
          offlineMinutes = mins;
          offlineScreenName = (s.name as string) ?? (s.id as string);
        }
      }
      // No offline screen is a real measurement of zero, not missing data.
      if (offlineMinutes === null) offlineMinutes = 0;
    }

    const { data: healthRows } = await supabase
      .from("campaign_delivery_health")
      .select("delivery_pct")
      .eq("campaign_id", id)
      .maybeSingle();

    const snapshot = {
      plays,
      billable_scans: billableScans,
      // Null, not Infinity, when there are no scans yet — a campaign with zero
      // scans on day one must not trip a cost-per-scan rule.
      cost_per_scan: billableScans > 0 ? spent / billableScans : null,
      pacing_ratio: pacingRatio(spent, Number(campaign.budget) || 0, progress),
      offline_screen_minutes: offlineMinutes,
      delivery_pct: healthRows?.delivery_pct != null ? Number(healthRows.delivery_pct) : null,
      _offline_screen_name: offlineScreenName as unknown as number, // carried for messaging
      _elapsed_pct: Math.round(progress * 100),
      _spent_pct: Number(campaign.budget) > 0 ? Math.round((spent / Number(campaign.budget)) * 100) : 0,
    } as Record<string, number | null>;

    snapshots.set(id, snapshot);
    return snapshot;
  }

  for (const rule of rules) {
    // Which campaigns this rule covers.
    const scoped = rule.scope_campaign_id
      ? liveCampaigns.filter(c => c.id === rule.scope_campaign_id)
      : liveCampaigns.filter(c => c.advertiser_id === rule.owner_id);

    for (const campaign of scoped) {
      const snapshot = await snapshotFor(campaign as Record<string, unknown>);
      const result = evaluateRule(rule, snapshot);
      if (!result.fired) continue;
      if (!shouldNotify(rule, now)) continue;

      const campaignLabel = (campaign.campaign_name ?? campaign.advertiser_name ?? campaign.id) as string;
      const currency = String(campaign.currency ?? "CAD").toUpperCase();

      if (rule.action === "pause_campaign") {
        await supabase.from("bookings").update({ status: "paused" }).eq("id", campaign.id);
        await notify(rule.owner_id as string, "rule_paused_campaign", {
          campaignName: campaignLabel,
          ruleName: rule.name as string,
          metric: rule.metric as string,
          value: String(result.value),
          appUrl: APP_URL,
        });
      } else {
        const type = METRIC_NOTIFICATION[rule.metric as string] ?? "campaign_pacing_behind";
        await notify(rule.owner_id as string, type, {
          campaignName: campaignLabel,
          screenName: String(snapshot._offline_screen_name ?? ""),
          offlineMinutes: String(snapshot.offline_screen_minutes ?? 0),
          spentPct: String(snapshot._spent_pct ?? 0),
          elapsedPct: String(snapshot._elapsed_pct ?? 0),
          costPerScan: `${Number(result.value ?? 0).toFixed(2)} ${currency}`,
          threshold: `${Number(rule.threshold).toFixed(2)} ${currency}`,
          appUrl: APP_URL,
        });
      }

      await supabase
        .from("automation_rules")
        .update({ last_fired_at: now.toISOString(), last_fired_value: result.value })
        .eq("id", rule.id);

      firedCount++;
      break; // one notification per rule per run, even across several campaigns
    }
  }

  return new Response(JSON.stringify({ ok: true, rules: rules.length, fired: firedCount }), { headers: CORS });
});
```

- [ ] **Step 2: Deploy**

```bash
pnpm dlx supabase functions deploy run-automation-rules --no-verify-jwt
```

- [ ] **Step 3: Run it once**

```bash
curl -s -X POST "https://hkqiuwnppxkkztacwicj.supabase.co/functions/v1/run-automation-rules"
```
Expected: `{"ok":true,"rules":N,"fired":K}` with no error.

- [ ] **Step 4: Verify debouncing — run it twice in a row**

Create one rule guaranteed to fire (threshold `-1` on `plays` with comparator `gt`), run the function twice, then:
```sql
select id, name, last_fired_at, last_fired_value from automation_rules where name = 'debounce-probe';
```
Expected: `last_fired_at` is set by the first run and **unchanged** by the second — the 6-hour debounce suppressed it. Delete the probe rule afterwards.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/run-automation-rules/index.ts
git commit -m "feat: add automation rule runner with debounced alerts"
```

---

## Task 6: 15-minute cron

**Files:**
- Create: `supabase/migrations/20260725000011_run_rules_cron.sql`

- [ ] **Step 1: Write the migration**

```sql
SELECT cron.unschedule('run-automation-rules')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'run-automation-rules');

SELECT cron.schedule(
  'run-automation-rules',
  '*/15 * * * *',
  $$SELECT net.http_post('https://hkqiuwnppxkkztacwicj.supabase.co/functions/v1/run-automation-rules', '{}', 'application/json');$$
);
```

- [ ] **Step 2: Apply via the Supabase MCP `apply_migration`, name `run_rules_cron`**

- [ ] **Step 3: Verify**

```sql
select jobname, schedule from cron.job where jobname = 'run-automation-rules';
```
Expected: one row, `*/15 * * * *`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260725000011_run_rules_cron.sql
git commit -m "feat: schedule automation rule runner every 15 minutes"
```

---

## Task 7: Rules UI

**Files:**
- Create: `src/views/shared/AutomationRulesView.jsx`
- Modify: `src/components/layout/Sidebar.jsx`, `src/App.jsx`

- [ ] **Step 1: Write `src/views/shared/AutomationRulesView.jsx`**

```jsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F } from '../../design/tokens.js';
import { Card } from '../../components/primitives/Card.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { Inp } from '../../components/primitives/Inp.jsx';
import { SelInput } from '../../components/primitives/SelInput.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { useToast } from '../../components/primitives/Toast.jsx';

const METRIC_LABELS = {
  cost_per_scan:          'Cost per scan',
  pacing_ratio:           'Pacing (1.0 = on pace)',
  offline_screen_minutes: 'Screen offline (minutes)',
  billable_scans:         'Billable scans',
  plays:                  'Plays',
  delivery_pct:           'Delivery %',
};

const COMPARATOR_LABELS = { gt: 'is above', gte: 'is at or above', lt: 'is below', lte: 'is at or below' };

// Sensible starting rules, offered as one-click adds rather than silently
// created — a rule that can pause a campaign should never appear by surprise.
const SUGGESTED = [
  { name: 'Screen dark during my flight', metric: 'offline_screen_minutes', comparator: 'gt',  threshold: 120,  action: 'notify' },
  { name: 'Pacing behind schedule',       metric: 'pacing_ratio',           comparator: 'lt',  threshold: 0.6,  action: 'notify' },
  { name: 'Cost per scan too high',       metric: 'cost_per_scan',          comparator: 'gt',  threshold: 5,    action: 'notify' },
];

export function AutomationRulesView({ user, ownerSide = 'advertiser' }) {
  const toast = useToast();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState({ name: '', metric: 'cost_per_scan', comparator: 'gt', threshold: '', action: 'notify' });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('automation_rules')
      .select('id, name, metric, comparator, threshold, action, enabled, last_fired_at, last_fired_value')
      .order('created_at', { ascending: false });
    setRules(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addRule = async (rule) => {
    const threshold = Number(rule.threshold);
    if (!rule.name.trim() || !Number.isFinite(threshold)) {
      toast.error('Give the rule a name and a numeric threshold.');
      return;
    }
    const { error } = await supabase.from('automation_rules').insert({
      owner_id: user.id,
      owner_side: ownerSide,
      name: rule.name.trim(),
      metric: rule.metric,
      comparator: rule.comparator,
      threshold,
      action: rule.action,
    });
    if (error) { toast.error(`Could not save rule: ${error.message}`); return; }
    toast.success('Rule added');
    setDraft({ name: '', metric: 'cost_per_scan', comparator: 'gt', threshold: '', action: 'notify' });
    load();
  };

  const toggle = async (rule) => {
    const { error } = await supabase.from('automation_rules').update({ enabled: !rule.enabled }).eq('id', rule.id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const remove = async (rule) => {
    const { error } = await supabase.from('automation_rules').delete().eq('id', rule.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Rule removed');
    load();
  };

  return (
    <div>
      <PageHeader title="Alerts & Rules" subtitle="Get told when something is wrong — or have AdGrid act on it for you" />

      {rules.length === 0 && !loading && (
        <Card style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>Suggested rules</div>
          <div style={{ fontSize: 12, color: C.textMuted, fontFamily: F.sans, marginBottom: 14 }}>
            Add any of these in one click. You can change or remove them later.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SUGGESTED.map(s => (
              <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans }}>
                  {s.name} — notify when {METRIC_LABELS[s.metric]} {COMPARATOR_LABELS[s.comparator]} {s.threshold}
                </span>
                <Btn size="sm" variant="secondary" onClick={() => addRule(s)}>Add</Btn>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 14 }}>New rule</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 0.8fr 1fr auto', gap: 10, alignItems: 'end' }}>
          <Inp label="Name" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
          <SelInput label="When" value={draft.metric} onChange={e => setDraft(d => ({ ...d, metric: e.target.value }))}>
            {Object.entries(METRIC_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </SelInput>
          <SelInput label="Condition" value={draft.comparator} onChange={e => setDraft(d => ({ ...d, comparator: e.target.value }))}>
            {Object.entries(COMPARATOR_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </SelInput>
          <Inp label="Value" type="number" value={draft.threshold} onChange={e => setDraft(d => ({ ...d, threshold: e.target.value }))} />
          <SelInput label="Then" value={draft.action} onChange={e => setDraft(d => ({ ...d, action: e.target.value }))}>
            <option value="notify">Notify me</option>
            <option value="pause_campaign">Pause the campaign</option>
          </SelInput>
          <Btn onClick={() => addRule(draft)}>Add rule</Btn>
        </div>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rules.map(r => (
          <Card key={r.id} style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.sans }}>{r.name}</div>
              <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 2 }}>
                {METRIC_LABELS[r.metric] ?? r.metric} {COMPARATOR_LABELS[r.comparator] ?? r.comparator} {r.threshold}
                {' · '}{r.action === 'pause_campaign' ? 'pauses the campaign' : 'notifies you'}
                {r.last_fired_at && ` · last fired ${new Date(r.last_fired_at).toLocaleString()}`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn size="sm" variant="secondary" onClick={() => toggle(r)}>{r.enabled ? 'Disable' : 'Enable'}</Btn>
              <Btn size="sm" variant="ghost" onClick={() => remove(r)}>Remove</Btn>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the nav item in `src/components/layout/Sidebar.jsx`**

Add an icon entry alongside the others (reuse the `signals` bolt glyph shape):

```js
  rules: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"/></svg>,
```

Then add to **both** nav lists — the operator list (after `signals`) and the advertiser list (after `adv-audience`):

```js
  { id: 'rules',     label: 'Alerts & Rules', icon: 'rules' },
```
```js
  { id: 'adv-rules', label: 'Alerts & Rules', icon: 'rules' },
```

- [ ] **Step 3: Route both ids in `src/App.jsx`**

Add the import next to the other view imports:

```js
import { AutomationRulesView } from './views/shared/AutomationRulesView.jsx';
```

Render it for both nav ids, matching how the file already dispatches views:

```jsx
{nav === 'rules'     && <AutomationRulesView user={user} ownerSide="operator" />}
{advNav === 'adv-rules' && <AutomationRulesView user={user} ownerSide="advertiser" />}
```

Use whatever nav state variable names this file actually uses — read the surrounding dispatch before editing.

- [ ] **Step 4: Verify in the browser**

Start the preview server, sign in, open **Alerts & Rules** in advertiser mode. Add a suggested rule, confirm it appears in the list, disable it, re-enable it, remove it. Check the console for errors with `read_console_messages`.

- [ ] **Step 5: Verify suite, build and scoped lint**

Run: `pnpm test && pnpm build`
Expected: both pass.

Run: `pnpm exec eslint src/views/shared/AutomationRulesView.jsx src/components/layout/Sidebar.jsx src/App.jsx`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/views/shared/AutomationRulesView.jsx src/components/layout/Sidebar.jsx src/App.jsx
git commit -m "feat: add alerts and automated rules UI"
```

---

## Task 8: Phase 2B verification pass

- [ ] **Step 1: Full test suite**

Run: `pnpm test`
Expected: all pass, including `ruleEvaluator` (17) and `pacing` (12).

- [ ] **Step 2: Build**

Run: `pnpm build`
Expected: exits 0.

- [ ] **Step 3: A rule cannot fire on missing data**

Create a rule on `cost_per_scan` for an account with zero scans, run the function, and confirm nothing fired:
```sql
select name, last_fired_at from automation_rules where metric = 'cost_per_scan';
```
Expected: `last_fired_at` stays null. A campaign with no scans must never trip a cost-per-scan rule.

- [ ] **Step 4: Debounce holds**

Run `run-automation-rules` three times in a row against a rule that does fire. `last_fired_at` must change once and then stay put.

- [ ] **Step 5: Rules are tenant-scoped**

```sql
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000ff","role":"authenticated"}';
select count(*) from automation_rules;
```
Expected: `0`.

- [ ] **Step 6: A pause rule actually pauses**

Create a rule with `action = 'pause_campaign'` and a threshold guaranteed to fire against a test campaign, run the function, and confirm:
```sql
select id, status from bookings where id = '<test-campaign-id>';
```
Expected: `paused`. Then set it back to its prior status.

- [ ] **Step 7: Confirm the acceptance criteria**

- A screen offline during a live flight notifies the advertiser within 15 minutes.
- A rule never fires on null or missing metrics.
- A firing rule notifies at most once per 6 hours.
- `pause_campaign` sets the booking status and tells the owner which rule did it.
- Rules are visible and editable only by their owner.

- [ ] **Step 8: Commit the checked-off plan**

```bash
git add docs/superpowers/plans/2026-07-25-phase2b-alerts-and-rules.md
git commit -m "docs: mark phase 2B alerts and rules complete"
```
