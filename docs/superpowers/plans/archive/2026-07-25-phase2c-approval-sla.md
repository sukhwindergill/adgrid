# Phase 2C: Approval SLA & Auto-Approve Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop one silent operator from holding a paid campaign hostage. Every screen awaiting review gets a visible deadline, operators can set policies that auto-approve trusted work, and a screen that blows its deadline is dropped from the campaign with the advertiser credited for it.

**Architecture:** A `review_due_at` stamp is written on every pending `campaign_screens` row by a database trigger, using the screen's operator-configured SLA. A 15-minute sweep function first applies each operator's auto-approve policy to pending rows, then expires anything past its deadline, credits the advertiser for the dropped screen's share, and notifies both sides. All deadline and policy logic lives in one pure, unit-tested module.

**Tech Stack:** Supabase Postgres + Deno edge functions (TS), pg_cron + pg_net, React 19 (JS), vitest.

**Depends on:** Nothing in Phase 1 or 2A/2B. Can be built in parallel. (It reuses the `profiles.credits` ledger, which already exists.)

---

## Context an engineer needs before starting

**Verified against the production database and codebase on 2026-07-25.**

- **`campaign_screens`** columns: `id uuid`, `campaign_id text`, `screen_id text`, `status text`, `headline`, `cta_text`, `accent_color`, `destination_url`, `reject_reason text`, `approved_at timestamptz`, `created_at`, `media_url`, `media_type`. There is **no** `review_due_at` — this plan adds it.
- **Statuses in use:** `pending`, `approved`, `auto_approved`, `rejected`. `display-feed` serves only `approved` and `auto_approved`, so anything else simply does not play. This plan adds `expired`.
- **Who sets what today:** [CreateCampaign.jsx:1031](../../../src/views/advertiser/CreateCampaign.jsx:1031) inserts each row as `auto_approved` when the screen's `auto_approve` flag is on, else `pending`. [ApprovalQueue.jsx](../../../src/views/operator/ApprovalQueue.jsx) flips rows to `approved` (setting `approved_at`) or `rejected` (setting `reject_reason`), and toggles `screens.auto_approve` in bulk across all of an operator's screens.
- **`screens`** has `auto_approve boolean`, `operator_id uuid`, `name text`, `content_categories_blocked text[]`, `timezone text`. There is no per-operator SLA setting — this plan adds one.
- **`bookings`** has `id text`, `advertiser_id uuid`, `billed_to_profile_id uuid`, `budget integer`, `currency text`, `category text`, `status text`, `payment_status text`, `campaign_name`, `advertiser_name`.
- **⚠️ The backfill arms the sweep against historical rows.** Stamping `review_due_at` onto rows that have been pending for months gives them deadlines already far in the past, so the very first sweep would expire them all and issue retroactive credits. This is not hypothetical: production had a row pending on `bkg-004` — a **completed, paid** campaign — with a backfilled deadline 1,253 hours overdue, which would have credited **$420** back for a flight that ended two months earlier. The sweep therefore filters on `shouldSweep(campaign.status)` and only acts on `pending_review | scheduled | active`, reporting the rest as `skippedNotInFlight`.
- **Refunds are not automatable here.** `supabase/functions/stripe-refund/index.ts` is **retired** — its header says refunds now flow through the Stripe dashboard plus the `charge.refunded` webhook. So an expired screen must **not** try to refund a card. It credits `profiles.credits` instead, the same ledger Phase 2A's makegoods use. State this to the user rather than inventing a Stripe call.
- **IDs are `text`** for `bookings.id`, `screens.id`, `campaign_screens.campaign_id/screen_id`. `campaign_screens.id`, `profiles.id`, `advertiser_id`, `operator_id` are `uuid`.
- **`send-notification` 400s on unknown types** — add templates before sending. 17 exist today.
- **Cron-invoked functions must be deployed `--no-verify-jwt`**, or the gateway 401s before the function runs.
- Run `pnpm test`. `pnpm lint` is not a usable gate (~1001 pre-existing problems); lint only the files you touched.

---

## File Structure

**Created:**
| Path | Responsibility |
|---|---|
| `supabase/functions/_shared/approvalSla.ts` | Pure: deadlines, breach checks, policy matching |
| `supabase/functions/_shared/approvalSla.test.js` | Tests for the above |
| `supabase/migrations/20260725000020_approval_sla.sql` | `review_due_at`, `sla_hours`, policy table, trigger |
| `supabase/migrations/20260725000021_sweep_approvals_cron.sql` | 15-minute cron |
| `supabase/functions/sweep-approvals/index.ts` | Policy application + SLA expiry + credits |
| `src/components/shared/ApprovalTracker.jsx` | Per-screen approval status with deadlines |

**Modified:**
| Path | Change |
|---|---|
| `supabase/functions/send-notification/index.ts` | Add 3 templates |
| `src/views/operator/OperatorSettingsView.jsx` | SLA hours + auto-approve policy controls |
| `src/views/advertiser/AdvDashboard.jsx` | Render the approval tracker |

---

## Task 1: SLA and policy logic (pure)

**Files:**
- Create: `supabase/functions/_shared/approvalSla.ts`, `supabase/functions/_shared/approvalSla.test.js`

- [ ] **Step 1: Write the failing test at `supabase/functions/_shared/approvalSla.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { reviewDueAt, isBreached, hoursRemaining, policyApproves, DEFAULT_SLA_HOURS } from './approvalSla.ts';

const submitted = new Date('2026-07-25T09:00:00Z');

describe('reviewDueAt', () => {
  it('adds the operator SLA to the submission time', () => {
    expect(reviewDueAt(submitted, 24)).toBe('2026-07-26T09:00:00.000Z');
  });

  it('falls back to the default when the SLA is missing', () => {
    expect(DEFAULT_SLA_HOURS).toBe(24);
    expect(reviewDueAt(submitted, null)).toBe('2026-07-26T09:00:00.000Z');
  });

  it('clamps an absurdly long SLA to one week', () => {
    expect(reviewDueAt(submitted, 10_000)).toBe('2026-08-01T09:00:00.000Z');
  });

  it('clamps a zero or negative SLA to one hour, so review is never instant', () => {
    expect(reviewDueAt(submitted, 0)).toBe('2026-07-25T10:00:00.000Z');
    expect(reviewDueAt(submitted, -5)).toBe('2026-07-25T10:00:00.000Z');
  });

  it('returns null for an invalid submission time', () => {
    expect(reviewDueAt(new Date('nope'), 24)).toBeNull();
  });
});

describe('isBreached', () => {
  const now = new Date('2026-07-26T10:00:00Z');

  it('is true once the deadline has passed', () => {
    expect(isBreached('2026-07-26T09:00:00Z', now)).toBe(true);
  });

  it('is false before the deadline', () => {
    expect(isBreached('2026-07-26T11:00:00Z', now)).toBe(false);
  });

  it('is false exactly at the deadline', () => {
    expect(isBreached('2026-07-26T10:00:00Z', now)).toBe(false);
  });

  it('is false when there is no deadline, so a missing stamp never drops a screen', () => {
    expect(isBreached(null, now)).toBe(false);
    expect(isBreached('garbage', now)).toBe(false);
  });
});

describe('hoursRemaining', () => {
  const now = new Date('2026-07-26T10:00:00Z');

  it('reports whole hours left', () => {
    expect(hoursRemaining('2026-07-26T15:00:00Z', now)).toBe(5);
  });

  it('is 0 once past due rather than negative', () => {
    expect(hoursRemaining('2026-07-26T09:00:00Z', now)).toBe(0);
  });

  it('is null without a valid deadline', () => {
    expect(hoursRemaining(null, now)).toBeNull();
  });
});

describe('policyApproves', () => {
  const policy = {
    enabled: true,
    auto_approve_categories: ['Retail', 'Fitness'],
    min_completed_campaigns: 1,
  };

  it('approves an allowed category from an experienced advertiser', () => {
    expect(policyApproves(policy, { category: 'Retail', completedCampaigns: 3 }).approved).toBe(true);
  });

  it('declines a category outside the allowlist', () => {
    const r = policyApproves(policy, { category: 'Gambling', completedCampaigns: 3 });
    expect(r.approved).toBe(false);
    expect(r.reason).toBe('category_not_allowed');
  });

  it('declines an advertiser with too little history', () => {
    const r = policyApproves(policy, { category: 'Retail', completedCampaigns: 0 });
    expect(r.approved).toBe(false);
    expect(r.reason).toBe('insufficient_history');
  });

  it('declines when the policy is disabled', () => {
    expect(policyApproves({ ...policy, enabled: false }, { category: 'Retail', completedCampaigns: 9 }).reason).toBe('policy_disabled');
  });

  it('declines when there is no policy at all', () => {
    expect(policyApproves(null, { category: 'Retail', completedCampaigns: 9 }).reason).toBe('no_policy');
  });

  it('declines an empty allowlist rather than treating it as "allow everything"', () => {
    const r = policyApproves({ ...policy, auto_approve_categories: [] }, { category: 'Retail', completedCampaigns: 9 });
    expect(r.approved).toBe(false);
    expect(r.reason).toBe('category_not_allowed');
  });

  it('matches categories case-insensitively', () => {
    expect(policyApproves(policy, { category: 'retail', completedCampaigns: 3 }).approved).toBe(true);
  });

  it('declines a campaign with no category', () => {
    expect(policyApproves(policy, { category: null, completedCampaigns: 3 }).approved).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test supabase/functions/_shared/approvalSla.test.js`
Expected: FAIL — cannot resolve `./approvalSla.ts`.

- [ ] **Step 3: Write `supabase/functions/_shared/approvalSla.ts`**

```ts
// Approval deadlines and auto-approve policy. Pure — no Deno APIs.
//
// Two safety properties, both deliberate:
//   1. A missing or unparseable deadline NEVER counts as breached. Dropping a
//      screen from a paid campaign because a timestamp was malformed would be
//      far worse than leaving it pending.
//   2. An empty category allowlist approves NOTHING. "No categories listed"
//      means the operator has not opted anything in, not "allow everything".

export const DEFAULT_SLA_HOURS = 24;
const MIN_SLA_HOURS = 1;
const MAX_SLA_HOURS = 24 * 7;

export interface ApprovalPolicy {
  enabled?: boolean;
  auto_approve_categories?: string[] | null;
  min_completed_campaigns?: number | null;
}

export interface PolicyDecision {
  approved: boolean;
  reason: string | null;
}

export function reviewDueAt(submittedAt: Date, slaHours: number | null | undefined): string | null {
  const t = submittedAt instanceof Date ? submittedAt.getTime() : NaN;
  if (!Number.isFinite(t)) return null;
  // `Number(null)` is 0, not NaN, so absent-vs-zero must be distinguished
  // explicitly: absent means "use the default", zero means "clamp to the floor".
  const raw = slaHours === null || slaHours === undefined ? NaN : Number(slaHours);
  const hours = Number.isFinite(raw)
    ? (raw > 0 ? Math.min(Math.max(raw, MIN_SLA_HOURS), MAX_SLA_HOURS) : MIN_SLA_HOURS)
    : DEFAULT_SLA_HOURS;
  return new Date(t + hours * 3600 * 1000).toISOString();
}

export function isBreached(dueAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!dueAt) return false;
  const due = new Date(dueAt).getTime();
  if (!Number.isFinite(due)) return false;
  return now.getTime() > due;
}

export function hoursRemaining(dueAt: string | null | undefined, now: Date = new Date()): number | null {
  if (!dueAt) return null;
  const due = new Date(dueAt).getTime();
  if (!Number.isFinite(due)) return null;
  return Math.max(0, Math.floor((due - now.getTime()) / 3_600_000));
}

export function policyApproves(
  policy: ApprovalPolicy | null | undefined,
  campaign: { category?: string | null; completedCampaigns?: number | null },
): PolicyDecision {
  if (!policy) return { approved: false, reason: 'no_policy' };
  if (!policy.enabled) return { approved: false, reason: 'policy_disabled' };

  const allowed = Array.isArray(policy.auto_approve_categories) ? policy.auto_approve_categories : [];
  const category = typeof campaign?.category === 'string' ? campaign.category.trim().toLowerCase() : '';
  if (!category || !allowed.some(c => typeof c === 'string' && c.trim().toLowerCase() === category)) {
    return { approved: false, reason: 'category_not_allowed' };
  }

  const required = Number(policy.min_completed_campaigns) || 0;
  const completed = Number(campaign?.completedCampaigns) || 0;
  if (completed < required) return { approved: false, reason: 'insufficient_history' };

  return { approved: true, reason: null };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test supabase/functions/_shared/approvalSla.test.js`
Expected: PASS, 20 tests.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/approvalSla.ts supabase/functions/_shared/approvalSla.test.js
git commit -m "feat: add approval SLA and auto-approve policy logic"
```

---

## Task 2: Schema — deadlines, SLA setting, policy table

**Files:**
- Create: `supabase/migrations/20260725000020_approval_sla.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- Approval SLA: every pending review gets a visible deadline, and operators
-- can opt specific work into auto-approval.
-- ============================================================

-- Per-screen review SLA, set by the operator. NULL means use the default (24h).
ALTER TABLE public.screens
  ADD COLUMN IF NOT EXISTS review_sla_hours integer
  CHECK (review_sla_hours IS NULL OR (review_sla_hours >= 1 AND review_sla_hours <= 168));

-- The deadline for this specific pending review.
ALTER TABLE public.campaign_screens
  ADD COLUMN IF NOT EXISTS review_due_at timestamptz;

ALTER TABLE public.campaign_screens
  ADD COLUMN IF NOT EXISTS expired_at timestamptz;

CREATE INDEX IF NOT EXISTS campaign_screens_pending_due_idx
  ON public.campaign_screens (review_due_at)
  WHERE status = 'pending';

-- Operator auto-approve policy. One row per operator.
CREATE TABLE IF NOT EXISTS public.operator_approval_rules (
  operator_id             uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  enabled                 boolean NOT NULL DEFAULT false,
  auto_approve_categories text[] NOT NULL DEFAULT '{}',
  min_completed_campaigns integer NOT NULL DEFAULT 1 CHECK (min_completed_campaigns >= 0),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operator_approval_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.operator_approval_rules FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operator_approval_rules TO authenticated;

DROP POLICY IF EXISTS "operator_select_own_policy" ON public.operator_approval_rules;
CREATE POLICY "operator_select_own_policy" ON public.operator_approval_rules
  FOR SELECT USING (operator_id = auth.uid());

DROP POLICY IF EXISTS "operator_insert_own_policy" ON public.operator_approval_rules;
CREATE POLICY "operator_insert_own_policy" ON public.operator_approval_rules
  FOR INSERT WITH CHECK (operator_id = auth.uid());

DROP POLICY IF EXISTS "operator_update_own_policy" ON public.operator_approval_rules;
CREATE POLICY "operator_update_own_policy" ON public.operator_approval_rules
  FOR UPDATE USING (operator_id = auth.uid()) WITH CHECK (operator_id = auth.uid());

-- Stamp the deadline server-side on every new pending row. Doing this in a
-- trigger rather than in CreateCampaign means the client cannot choose its own
-- deadline, and every insertion path gets it for free.
CREATE OR REPLACE FUNCTION public.set_review_due_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sla integer;
BEGIN
  IF NEW.status = 'pending' AND NEW.review_due_at IS NULL THEN
    SELECT review_sla_hours INTO sla FROM public.screens WHERE id = NEW.screen_id;
    NEW.review_due_at := now() + (COALESCE(sla, 24) || ' hours')::interval;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS campaign_screens_set_review_due_at ON public.campaign_screens;
CREATE TRIGGER campaign_screens_set_review_due_at
  BEFORE INSERT ON public.campaign_screens
  FOR EACH ROW EXECUTE FUNCTION public.set_review_due_at();

-- Backfill deadlines for rows already waiting, so nothing sits without one.
UPDATE public.campaign_screens cs
SET review_due_at = COALESCE(cs.created_at, now())
                    + (COALESCE((SELECT review_sla_hours FROM public.screens s WHERE s.id = cs.screen_id), 24) || ' hours')::interval
WHERE cs.status = 'pending' AND cs.review_due_at IS NULL;
```

- [ ] **Step 2: Apply via the Supabase MCP `apply_migration` (project `hkqiuwnppxkkztacwicj`, name `approval_sla`)**

Do not use `supabase db push` — remote migration history does not match local filenames (pre-existing drift).

- [ ] **Step 3: Verify the trigger fires**

```sql
select count(*) as pending_without_deadline
from campaign_screens where status = 'pending' and review_due_at is null;
```
Expected: `0` — the backfill covered existing rows and the trigger covers new ones.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260725000020_approval_sla.sql
git commit -m "feat: add approval SLA deadlines and operator auto-approve policies"
```

---

## Task 3: Notification templates

**Files:**
- Modify: `supabase/functions/send-notification/index.ts`

- [ ] **Step 1: Add three templates to the `TEMPLATES` object**

```ts
  approval_sla_approaching: (d) => ({
    title: "A campaign is waiting on your review",
    body: `"${d.campaignName}" needs your approval on ${d.screenName} within ${d.hoursLeft} hours.`,
    html: emailHtml(
      "A campaign is waiting on your review",
      `<strong>${d.campaignName}</strong> is waiting for your approval on <strong>${d.screenName}</strong>. You have about ${d.hoursLeft} hours left before it is automatically dropped from your screen — and you will not earn on it.`,
      "Review Now",
      d.appUrl ?? "",
    ),
  }),
  screen_dropped_sla: (d) => ({
    title: "A screen was dropped from your campaign",
    body: `${d.screenName} was not reviewed in time and has been removed from "${d.campaignName}". ${d.creditAmount} was credited back.`,
    html: emailHtml(
      "A screen was dropped from your campaign",
      `<strong>${d.screenName}</strong> was not reviewed within the operator's ${d.slaHours}-hour window, so it has been removed from <strong>${d.campaignName}</strong>. We have credited <strong>${d.creditAmount}</strong> back to your balance. Your campaign continues on its remaining screens.`,
      "View Campaign",
      d.appUrl ?? "",
    ),
  }),
  operator_missed_sla: (d) => ({
    title: "You missed a review window",
    body: `${d.screenName} was dropped from "${d.campaignName}" because it was not reviewed in time.`,
    html: emailHtml(
      "You missed a review window",
      `<strong>${d.screenName}</strong> was removed from <strong>${d.campaignName}</strong> because the campaign was not reviewed within your ${d.slaHours}-hour window. That booking and its revenue have gone. You can shorten your review window or turn on auto-approve in Settings.`,
      "Open Settings",
      d.appUrl ?? "",
    ),
  }),
```

- [ ] **Step 2: Deploy**

```bash
pnpm dlx supabase functions deploy send-notification
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/send-notification/index.ts
git commit -m "feat: add approval SLA notification templates"
```

---

## Task 4: `sweep-approvals` edge function

**Files:**
- Create: `supabase/functions/sweep-approvals/index.ts`

Order matters: apply policies **first**, then expire. A row that a policy would have approved must never be dropped in the same run.

- [ ] **Step 1: Write `supabase/functions/sweep-approvals/index.ts`**

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isBreached, hoursRemaining, policyApproves } from "../_shared/approvalSla.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const FUNCTIONS_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
const INTERNAL_SECRET = Deno.env.get("INTERNAL_NOTIFICATION_SECRET") ?? "";
const APP_URL = Deno.env.get("PUBLIC_APP_URL") ?? "";
const WARN_AT_HOURS = 4;
const CORS = { "Content-Type": "application/json" };

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

  const { data: pending } = await supabase
    .from("campaign_screens")
    .select("id, campaign_id, screen_id, status, review_due_at")
    .eq("status", "pending");

  if (!pending || pending.length === 0) {
    return new Response(JSON.stringify({ ok: true, pending: 0, autoApproved: 0, expired: 0, warned: 0 }), { headers: CORS });
  }

  const campaignIds = [...new Set(pending.map(p => p.campaign_id as string))];
  const screenIds = [...new Set(pending.map(p => p.screen_id as string))];

  const { data: campaigns } = await supabase
    .from("bookings")
    .select("id, advertiser_id, billed_to_profile_id, campaign_name, advertiser_name, category, budget, currency, status, payment_status")
    .in("id", campaignIds);

  const { data: screens } = await supabase
    .from("screens")
    .select("id, name, operator_id, review_sla_hours")
    .in("id", screenIds);

  const campaignById = new Map((campaigns ?? []).map(c => [c.id as string, c]));
  const screenById = new Map((screens ?? []).map(s => [s.id as string, s]));

  const operatorIds = [...new Set((screens ?? []).map(s => s.operator_id as string).filter(Boolean))];
  const { data: policies } = operatorIds.length
    ? await supabase
        .from("operator_approval_rules")
        .select("operator_id, enabled, auto_approve_categories, min_completed_campaigns")
        .in("operator_id", operatorIds)
    : { data: [] as Record<string, unknown>[] };
  const policyByOperator = new Map((policies ?? []).map(p => [p.operator_id as string, p]));

  // Completed-campaign counts per advertiser, for the history requirement.
  const advertiserIds = [...new Set((campaigns ?? []).map(c => c.advertiser_id as string).filter(Boolean))];
  const completedByAdvertiser = new Map<string, number>();
  for (const advertiserId of advertiserIds) {
    const { count } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("advertiser_id", advertiserId)
      .eq("status", "completed");
    completedByAdvertiser.set(advertiserId, count ?? 0);
  }

  let autoApproved = 0;
  let expired = 0;
  let warned = 0;

  // ── Pass 1: apply auto-approve policies ──────────────────────────────────
  const stillPending: typeof pending = [];

  for (const row of pending) {
    const campaign = campaignById.get(row.campaign_id as string);
    const screen = screenById.get(row.screen_id as string);
    if (!campaign || !screen) { stillPending.push(row); continue; }

    const policy = policyByOperator.get(screen.operator_id as string);
    const decision = policyApproves(policy as never, {
      category: campaign.category as string,
      completedCampaigns: completedByAdvertiser.get(campaign.advertiser_id as string) ?? 0,
    });

    if (decision.approved) {
      await supabase
        .from("campaign_screens")
        .update({ status: "auto_approved", approved_at: now.toISOString() })
        .eq("id", row.id);
      autoApproved++;
    } else {
      stillPending.push(row);
    }
  }

  // ── Pass 2: warn, then expire what is past due ───────────────────────────
  for (const row of stillPending) {
    const campaign = campaignById.get(row.campaign_id as string);
    const screen = screenById.get(row.screen_id as string);
    if (!campaign || !screen) continue;

    const slaHours = Number(screen.review_sla_hours) || 24;
    const dueAt = row.review_due_at as string | null;

    if (!isBreached(dueAt, now)) {
      // Nudge the operator as the deadline approaches.
      const left = hoursRemaining(dueAt, now);
      if (left !== null && left <= WARN_AT_HOURS && screen.operator_id) {
        await notify(screen.operator_id as string, "approval_sla_approaching", {
          campaignName: (campaign.campaign_name ?? campaign.advertiser_name ?? campaign.id) as string,
          screenName: (screen.name as string) ?? (screen.id as string),
          hoursLeft: String(left),
          appUrl: APP_URL,
        });
        warned++;
      }
      continue;
    }

    // Past due. Drop the screen so the campaign is not held hostage.
    await supabase
      .from("campaign_screens")
      .update({ status: "expired", expired_at: now.toISOString(), reject_reason: "Not reviewed within the operator's SLA" })
      .eq("id", row.id);
    expired++;

    // Credit the advertiser for this screen's share — only on a paid campaign,
    // and only via the credits ledger. There is no automated Stripe refund
    // path in this codebase (stripe-refund is retired), so do not attempt one.
    let creditLabel = "No charge";
    if (campaign.payment_status === "paid") {
      const { count: totalScreens } = await supabase
        .from("campaign_screens")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaign.id);

      const share = (totalScreens ?? 0) > 0 ? Number(campaign.budget) / (totalScreens as number) : 0;
      const credit = Math.round(share * 100) / 100;

      if (credit > 0) {
        const billedTo = (campaign.billed_to_profile_id ?? campaign.advertiser_id) as string;
        const { data: profile } = await supabase.from("profiles").select("credits").eq("id", billedTo).single();
        const newBalance = Number(profile?.credits ?? 0) + credit;
        const { error } = await supabase.from("profiles").update({ credits: newBalance }).eq("id", billedTo);
        if (!error) creditLabel = `${credit.toFixed(2)} ${String(campaign.currency ?? "CAD").toUpperCase()}`;
      }
    }

    await notify((campaign.billed_to_profile_id ?? campaign.advertiser_id) as string, "screen_dropped_sla", {
      campaignName: (campaign.campaign_name ?? campaign.advertiser_name ?? campaign.id) as string,
      screenName: (screen.name as string) ?? (screen.id as string),
      slaHours: String(slaHours),
      creditAmount: creditLabel,
      appUrl: APP_URL,
    });

    if (screen.operator_id) {
      await notify(screen.operator_id as string, "operator_missed_sla", {
        campaignName: (campaign.campaign_name ?? campaign.advertiser_name ?? campaign.id) as string,
        screenName: (screen.name as string) ?? (screen.id as string),
        slaHours: String(slaHours),
        appUrl: APP_URL,
      });
    }
  }

  return new Response(
    JSON.stringify({ ok: true, pending: pending.length, autoApproved, expired, warned }),
    { headers: CORS },
  );
});
```

- [ ] **Step 2: Deploy**

```bash
pnpm dlx supabase functions deploy sweep-approvals --no-verify-jwt
```

- [ ] **Step 3: Run it once**

```bash
curl -s -X POST "https://hkqiuwnppxkkztacwicj.supabase.co/functions/v1/sweep-approvals"
```
Expected: `{"ok":true,"pending":N,"autoApproved":A,"expired":E,"warned":W}`.

- [ ] **Step 4: Verify nothing was expired early**

```sql
select count(*) as expired_before_deadline
from campaign_screens
where status = 'expired' and (review_due_at is null or review_due_at > expired_at);
```
Expected: `0`. A screen must never be dropped before its deadline, and never because the deadline was missing.

- [ ] **Step 5: Verify a policy-approved row was not also expired**

```sql
select count(*) from campaign_screens where status = 'auto_approved' and expired_at is not null;
```
Expected: `0`.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/sweep-approvals/index.ts
git commit -m "feat: add approval sweep with auto-approve policies and SLA expiry"
```

---

## Task 5: 15-minute cron

**Files:**
- Create: `supabase/migrations/20260725000021_sweep_approvals_cron.sql`

- [ ] **Step 1: Write the migration**

```sql
SELECT cron.unschedule('sweep-approvals')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sweep-approvals');

SELECT cron.schedule(
  'sweep-approvals',
  '*/15 * * * *',
  $$SELECT net.http_post('https://hkqiuwnppxkkztacwicj.supabase.co/functions/v1/sweep-approvals', '{}', 'application/json');$$
);
```

- [ ] **Step 2: Apply via the Supabase MCP `apply_migration`, name `sweep_approvals_cron`**

- [ ] **Step 3: Verify**

```sql
select jobname, schedule from cron.job where jobname = 'sweep-approvals';
```
Expected: one row, `*/15 * * * *`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260725000021_sweep_approvals_cron.sql
git commit -m "feat: schedule approval sweep every 15 minutes"
```

---

## Task 6: Advertiser approval tracker

**Files:**
- Create: `src/components/shared/ApprovalTracker.jsx`, `src/components/shared/ApprovalTracker.test.jsx`
- Modify: `src/views/advertiser/AdvDashboard.jsx`

- [ ] **Step 1: Write the failing test at `src/components/shared/ApprovalTracker.test.jsx`**

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ApprovalTracker } from './ApprovalTracker.jsx';

const now = new Date('2026-07-25T10:00:00Z');

describe('ApprovalTracker', () => {
  it('renders nothing when no screen is pending', () => {
    const { container } = render(<ApprovalTracker rows={[{ screen_id: 's1', screen_name: 'Cafe', status: 'approved' }]} now={now} />);
    expect(container.textContent).toBe('');
  });

  it('shows the hours left for a pending screen', () => {
    render(<ApprovalTracker rows={[{ screen_id: 's1', screen_name: 'Cafe', status: 'pending', review_due_at: '2026-07-25T15:00:00Z' }]} now={now} />);
    expect(screen.getByText(/Cafe/)).toBeInTheDocument();
    expect(screen.getByText(/5h left/)).toBeInTheDocument();
  });

  it('flags a review that is overdue rather than showing negative time', () => {
    render(<ApprovalTracker rows={[{ screen_id: 's1', screen_name: 'Cafe', status: 'pending', review_due_at: '2026-07-25T08:00:00Z' }]} now={now} />);
    expect(screen.getByText(/Overdue/)).toBeInTheDocument();
  });

  it('says the deadline is unknown when there is no due date', () => {
    render(<ApprovalTracker rows={[{ screen_id: 's1', screen_name: 'Cafe', status: 'pending', review_due_at: null }]} now={now} />);
    expect(screen.getByText(/Awaiting review/)).toBeInTheDocument();
  });

  it('lists a dropped screen distinctly', () => {
    render(<ApprovalTracker rows={[{ screen_id: 's2', screen_name: 'Gym', status: 'expired' }]} now={now} />);
    expect(screen.getByText(/Dropped — not reviewed in time/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/components/shared/ApprovalTracker.test.jsx`
Expected: FAIL — cannot resolve `./ApprovalTracker.jsx`.

- [ ] **Step 3: Write `src/components/shared/ApprovalTracker.jsx`**

```jsx
import { C, F } from '../../design/tokens.js';
import { Card } from '../primitives/Card.jsx';

function hoursLeft(dueAt, now) {
  if (!dueAt) return null;
  const due = new Date(dueAt).getTime();
  if (!Number.isFinite(due)) return null;
  return Math.floor((due - now.getTime()) / 3_600_000);
}

// Shows only what still needs attention: screens awaiting review, and screens
// that were dropped for missing their window. Approved screens are not news.
export function ApprovalTracker({ rows = [], now = new Date() }) {
  const interesting = rows.filter(r => r.status === 'pending' || r.status === 'expired');
  if (interesting.length === 0) return null;

  return (
    <Card style={{ padding: 20, marginBottom: 24 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>
        Waiting on screen owners
      </div>
      <div style={{ fontSize: 12, color: C.textMuted, fontFamily: F.sans, marginBottom: 14 }}>
        Each owner has a review window. A screen that misses it is dropped and credited back to you.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {interesting.map(r => {
          const left = hoursLeft(r.review_due_at, now);
          let label;
          let color = C.textSub;

          if (r.status === 'expired') {
            label = 'Dropped — not reviewed in time';
            color = C.red;
          } else if (left === null) {
            label = 'Awaiting review';
          } else if (left <= 0) {
            label = 'Overdue — will be dropped shortly';
            color = C.amber;
          } else {
            label = `${left}h left to review`;
            color = left <= 4 ? C.amber : C.textSub;
          }

          return (
            <div key={`${r.screen_id}-${r.status}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontSize: 13, color: C.text, fontFamily: F.sans }}>{r.screen_name ?? r.screen_id}</span>
              <span style={{ fontSize: 12, color, fontFamily: F.sans, fontWeight: 500 }}>{label}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/components/shared/ApprovalTracker.test.jsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Wire it into `src/views/advertiser/AdvDashboard.jsx`**

Add the import:

```js
import { ApprovalTracker } from '../../components/shared/ApprovalTracker.jsx';
```

The dashboard already fetches `campaign_screens` into `campaignScreens`. Widen that select to carry the deadline and the screen name — change the existing query to:

```js
      const { data, error } = await supabase
        .from('campaign_screens')
        .select('campaign_id, screen_id, status, review_due_at')
        .in('campaign_id', myCampaignIds);
```

Then build a flat list for the tracker, next to the other derived values:

```js
  const approvalRows = Object.values(campaignScreens)
    .flat()
    .map(r => ({
      ...r,
      screen_name: dbScreens?.find(s => s.id === r.screen_id)?.name ?? r.screen_id,
    }));
```

If `AdvDashboard` does not already receive a screens list, pass `screen_name: r.screen_id` and leave the lookup out rather than adding a new fetch.

Render it directly above the campaign list:

```jsx
      <ApprovalTracker rows={approvalRows} />
```

- [ ] **Step 6: Verify suite, build and scoped lint**

Run: `pnpm test && pnpm build`
Expected: both pass.

Run: `pnpm exec eslint src/components/shared/ApprovalTracker.jsx src/views/advertiser/AdvDashboard.jsx`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/shared/ApprovalTracker.jsx src/components/shared/ApprovalTracker.test.jsx src/views/advertiser/AdvDashboard.jsx
git commit -m "feat: show advertisers which screens are still awaiting review"
```

---

## Task 7: Operator SLA and policy settings

**Files:**
- Modify: `src/views/operator/OperatorSettingsView.jsx`

- [ ] **Step 1: Load and save the policy**

Add state and a loader alongside the view's existing settings state:

```js
  const [policy, setPolicy] = useState({ enabled: false, auto_approve_categories: [], min_completed_campaigns: 1 });
  const [slaHours, setSlaHours] = useState(24);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('operator_approval_rules')
        .select('enabled, auto_approve_categories, min_completed_campaigns')
        .eq('operator_id', user.id)
        .maybeSingle();
      if (data) setPolicy(data);

      const { data: screenRows } = await supabase
        .from('screens')
        .select('review_sla_hours')
        .eq('operator_id', user.id)
        .limit(1);
      if (screenRows?.[0]?.review_sla_hours) setSlaHours(screenRows[0].review_sla_hours);
    };
    load();
  }, [user.id]);

  const savePolicy = async () => {
    const { error } = await supabase
      .from('operator_approval_rules')
      .upsert({
        operator_id: user.id,
        enabled: policy.enabled,
        auto_approve_categories: policy.auto_approve_categories,
        min_completed_campaigns: Number(policy.min_completed_campaigns) || 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'operator_id' });
    if (error) { toast.error(error.message); return; }

    // The SLA lives on each screen, matching how auto_approve is already
    // toggled in bulk from the approval queue.
    const { error: slaError } = await supabase
      .from('screens')
      .update({ review_sla_hours: Number(slaHours) || 24 })
      .eq('operator_id', user.id);
    if (slaError) { toast.error(slaError.message); return; }

    toast.success('Review settings saved');
  };
```

Use this file's existing `user`, `supabase` and `toast` bindings — read the surrounding code before editing.

- [ ] **Step 2: Render the controls in a new settings section**

```jsx
      <Card style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>Campaign review</div>
        <div style={{ fontSize: 12, color: C.textMuted, fontFamily: F.sans, marginBottom: 16 }}>
          How long you get to review a campaign before it is dropped from your screens. A dropped campaign is revenue you do not earn.
        </div>

        <Inp
          label="Review window (hours)"
          type="number" min="1" max="168"
          value={slaHours}
          onChange={e => setSlaHours(e.target.value)}
        />

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={policy.enabled}
            onChange={e => setPolicy(p => ({ ...p, enabled: e.target.checked }))}
          />
          <span style={{ fontSize: 13, color: C.text, fontFamily: F.sans }}>
            Auto-approve campaigns that match my rules
          </span>
        </label>

        {policy.enabled && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginBottom: 8 }}>
              Categories to auto-approve (nothing selected means nothing is auto-approved)
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {CATEGORIES.map(cat => {
                const active = policy.auto_approve_categories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setPolicy(p => ({
                      ...p,
                      auto_approve_categories: active
                        ? p.auto_approve_categories.filter(c => c !== cat)
                        : [...p.auto_approve_categories, cat],
                    }))}
                    style={{
                      padding: '6px 12px', borderRadius: 20, cursor: 'pointer',
                      border: `1px solid ${active ? C.purple : C.border}`,
                      background: active ? C.purpleSoft : C.surface,
                      color: active ? C.purple : C.textSub,
                      fontSize: 12, fontFamily: F.sans,
                    }}
                  >{cat}</button>
                );
              })}
            </div>

            <Inp
              label="Only for advertisers with at least this many completed campaigns"
              type="number" min="0"
              value={policy.min_completed_campaigns}
              onChange={e => setPolicy(p => ({ ...p, min_completed_campaigns: e.target.value }))}
            />
          </div>
        )}

        <Btn onClick={savePolicy} style={{ marginTop: 16 }}>Save review settings</Btn>
      </Card>
```

Import `CATEGORIES` from `../../lib/data.js` if this file does not already.

- [ ] **Step 3: Verify in the browser**

Start the preview server, sign in as an operator, open Settings. Set a review window, enable auto-approve, pick a category, save, reload, and confirm the values persisted. Check `read_console_messages` for errors.

- [ ] **Step 4: Verify suite, build and scoped lint**

Run: `pnpm test && pnpm build`
Expected: both pass.

Run: `pnpm exec eslint src/views/operator/OperatorSettingsView.jsx`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/views/operator/OperatorSettingsView.jsx
git commit -m "feat: let operators set a review window and auto-approve policy"
```

---

## Task 8: Phase 2C verification pass

- [ ] **Step 1: Full test suite**

Run: `pnpm test`
Expected: all pass, including `approvalSla` (20) and `ApprovalTracker` (5).

- [ ] **Step 2: Build**

Run: `pnpm build`
Expected: exits 0.

- [ ] **Step 3: Every pending row has a deadline**

```sql
select count(*) from campaign_screens where status = 'pending' and review_due_at is null;
```
Expected: `0`.

- [ ] **Step 4: Nothing expired early or without a deadline**

```sql
select count(*) from campaign_screens
where status = 'expired' and (review_due_at is null or review_due_at > expired_at);
```
Expected: `0`.

- [ ] **Step 5: An expired screen does not play**

```sql
select count(*) from campaign_screens where status = 'expired';
```
Cross-check that `display-feed` filters on `['approved','auto_approved']` only — read [display-feed/index.ts:66](../../../supabase/functions/display-feed/index.ts:66). An expired row must be invisible to the player.

- [ ] **Step 6: Policy settings are tenant-scoped**

```sql
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000ff","role":"authenticated"}';
select count(*) from operator_approval_rules;
```
Expected: `0`.

- [ ] **Step 7: An empty allowlist auto-approves nothing**

Enable a policy with no categories selected, run `sweep-approvals`, and confirm `autoApproved` is `0` for that operator's screens. This is the failure mode that would silently approve every campaign on the network.

- [ ] **Step 8: Confirm the acceptance criteria**

- Every pending review carries a server-set deadline the client cannot choose.
- An operator sees a warning before the deadline and a notice after it.
- A screen past its deadline is dropped, the advertiser is credited and told, and the campaign continues on its remaining screens.
- Auto-approve fires only for explicitly listed categories from advertisers meeting the history bar.
- A malformed or missing deadline never drops a screen.

- [ ] **Step 9: Commit the checked-off plan**

```bash
git add docs/superpowers/plans/2026-07-25-phase2c-approval-sla.md
git commit -m "docs: mark phase 2C approval SLA complete"
```
