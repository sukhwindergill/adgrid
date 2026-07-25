# Phase 2A: Delivery Reconciliation & Makegoods Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile what each advertiser was billed for against what actually played, credit the shortfall automatically when a screen was dark, and show both sides a delivery-health number they can trust.

**Architecture:** A pure module computes how many plays a (campaign, screen, day) *should* have had, from the campaign's schedule intersected with the screen's operating hours. A nightly edge function compares that against `campaign_delivery_daily` (Phase 1), attributes any shortfall to screen downtime using `display_heartbeats`, writes an immutable `delivery_reconciliation` row, and issues a one-time credit to the billed party. Only fully-closed days are reconciled, so a day is never credited twice or credited early.

**Tech Stack:** Supabase Postgres + Deno edge functions (TS), pg_cron + pg_net, React 19 (JS), vitest.

**Depends on:** Phase 1 (`ad_plays`, `campaign_delivery_daily`). Do not start until Phase 1 is deployed.

---

## Context an engineer needs before starting

**Verified against the production database on 2026-07-25 — use these facts, not the older migration files, which declare `uuid` columns that the live database does not have.**

- **IDs are `text`, not uuid:** `bookings.id`, `screens.id`, `campaign_screens.campaign_id`, `campaign_screens.screen_id`, `display_heartbeats.screen_id`, `display_heartbeats.campaign_id`, `ad_plays.campaign_id`, `ad_plays.screen_id`. Only `profiles.id`, `bookings.advertiser_id`, `bookings.billed_to_profile_id`, `screens.operator_id` and `campaign_screens.id` are `uuid`.
- **A campaign is a `bookings` row.** Scheduling columns already exist and are what "expected plays" is derived from:
  - `schedule_days text[]` — day abbreviations as written by the wizard: `Mon Tue Wed Thu Fri Sat Sun`
  - `time_start text`, `time_end text` — `"HH:MM"`
  - `duration integer` — seconds of one play (wizard default 15)
  - `slots integer` — **percent** of screen airtime, 1–100 (wizard default 10). It is a share, not a count.
  - `start_date date`, `end_date date`, `budget integer`, `spent integer`, `currency text`, `payment_status text`, `status text`
- **`screens`** has `operating_hours_start time`, `operating_hours_end time`, `timezone text` (default `America/Toronto`), `operator_id uuid`, `health_status text`, `last_seen timestamptz`.
- **`campaign_screens.status`** is one of `pending | approved | auto_approved | rejected`. Only `approved` and `auto_approved` actually play — `display-feed` filters on exactly those two.
- **`profiles.credits numeric`** already exists and is the credit ledger balance. `profiles.billed_to_profile_id` does not exist; the billed party is `bookings.billed_to_profile_id ?? bookings.advertiser_id` (agency-vs-client billing, set at campaign creation).
- **`display_heartbeats`** gets one row per 30-second `display-feed` poll: `screen_id`, `campaign_id`, `status` (`playing`/`idle`), `created_at`. It proves the screen was reachable; it does not prove a specific creative played (that is `ad_plays`).
- **`send-notification` rejects unknown types with HTTP 400.** There are 17 templates today (`campaign_approved`, `campaign_live`, `campaign_paused`, `low_budget`, `campaign_ended`, `scan_milestone`, `weekly_report`, `payment_failed`, `payment_authentication_required`, `new_advertiser`, `campaign_submitted`, `payout_completed`, `weekly_revenue`, `team_member_joined`, `screen_offline`, `screen_registered`, `grant_invite`). **Any new notification type must be added to `TEMPLATES` before it is sent**, or the call 400s and the alert is silently dropped.
- **Crons call functions over HTTP** via pg_net, e.g. `supabase/migrations/20260707000000_data_retention_cron_schedule.sql`. Existing jobs: `daily-notifications`, `data-retention-cron`, `notification-cron-pending-push`, `screen-health-check`, `refresh-screen-audience-index`.
- **Edge functions that are called without a user JWT must be deployed with `--no-verify-jwt`**, otherwise the gateway returns 401 before the function runs. This bit Phase 1.
- **Views that read `public.screens` cannot use `security_invoker = true`** — `authenticated` has no SELECT on `screens` (it carries `monthly_revenue`). Follow the `campaign_delivery_daily` pattern: owner-executed view with its own `current_user IN ('postgres','supabase_admin','service_role') OR …auth.uid()…` predicate.
- Run `pnpm test` (vitest, added in Phase 1). `pnpm lint` is **not** a usable gate — it reports ~1001 pre-existing problems because eslint walks `.claude/worktrees/**` and `mobile/**`. Lint only the files you touched.

---

## File Structure

**Created:**
| Path | Responsibility |
|---|---|
| `supabase/functions/_shared/deliveryExpectation.ts` | Pure: expected plays for one (campaign, screen, day) |
| `supabase/functions/_shared/deliveryExpectation.test.js` | Tests for the above |
| `supabase/functions/_shared/makegood.ts` | Pure: shortfall %, credit amount, credit-worthiness |
| `supabase/functions/_shared/makegood.test.js` | Tests for the above |
| `supabase/migrations/20260725000000_delivery_reconciliation.sql` | Reconciliation table + RLS |
| `supabase/migrations/20260725000001_delivery_health.sql` | `campaign_delivery_health` view |
| `supabase/migrations/20260725000002_reconcile_delivery_cron.sql` | Nightly cron |
| `supabase/functions/reconcile-delivery/index.ts` | Nightly reconciliation + credit issuance |
| `src/components/shared/DeliveryHealthCard.jsx` | Shared delivery-health UI |

**Modified:**
| Path | Change |
|---|---|
| `supabase/functions/send-notification/index.ts` | Add `delivery_shortfall_credited` + `screen_downtime_attributed` templates |
| `src/views/advertiser/AdvDashboard.jsx` | Render delivery health |
| `src/views/operator/ScreenDetail.jsx` | Show downtime attributed to this screen |

---

## Task 1: Expected-plays model (pure)

**Files:**
- Create: `supabase/functions/_shared/deliveryExpectation.ts`, `supabase/functions/_shared/deliveryExpectation.test.js`

The model: on a scheduled day, the campaign occupies `slots` percent of the airtime where the campaign's daypart overlaps the screen's operating hours. Expected plays = `floor(overlapSeconds × slots/100 / duration)`.

- [ ] **Step 1: Write the failing test at `supabase/functions/_shared/deliveryExpectation.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { parseHhMm, overlapSeconds, expectedPlays } from './deliveryExpectation.ts';

describe('parseHhMm', () => {
  it('parses HH:MM to seconds from midnight', () => {
    expect(parseHhMm('00:00')).toBe(0);
    expect(parseHhMm('07:30')).toBe(27_000);
    expect(parseHhMm('22:00')).toBe(79_200);
  });

  it('parses a postgres time with seconds', () => {
    expect(parseHhMm('07:30:00')).toBe(27_000);
  });

  it('returns null for junk', () => {
    expect(parseHhMm('')).toBeNull();
    expect(parseHhMm(null)).toBeNull();
    expect(parseHhMm('25:00')).toBeNull();
    expect(parseHhMm('nonsense')).toBeNull();
  });
});

describe('overlapSeconds', () => {
  it('returns the intersection of two windows', () => {
    // campaign 09:00-17:00, screen 07:00-22:00 -> 8h
    expect(overlapSeconds('09:00', '17:00', '07:00', '22:00')).toBe(8 * 3600);
  });

  it('clamps to the narrower screen window', () => {
    // campaign 06:00-23:00, screen 09:00-17:00 -> 8h
    expect(overlapSeconds('06:00', '23:00', '09:00', '17:00')).toBe(8 * 3600);
  });

  it('returns 0 when the windows do not overlap', () => {
    expect(overlapSeconds('06:00', '08:00', '09:00', '17:00')).toBe(0);
  });

  it('falls back to the full day when a bound is missing', () => {
    expect(overlapSeconds(null, null, '09:00', '17:00')).toBe(8 * 3600);
    expect(overlapSeconds('09:00', '17:00', null, null)).toBe(8 * 3600);
  });

  it('treats an inverted window as zero rather than negative', () => {
    expect(overlapSeconds('17:00', '09:00', '07:00', '22:00')).toBe(0);
  });
});

describe('expectedPlays', () => {
  const campaign = {
    schedule_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    time_start: '09:00',
    time_end: '17:00',
    duration: 15,
    slots: 10,
    start_date: '2026-07-01',
    end_date: '2026-07-31',
  };
  const screen = { operating_hours_start: '07:00', operating_hours_end: '22:00' };

  it('computes plays from the overlap, slot share and play duration', () => {
    // 8h overlap = 28800s; 10% = 2880s; / 15s = 192 plays
    const r = expectedPlays(campaign, screen, '2026-07-08'); // a Wednesday
    expect(r.expectedPlays).toBe(192);
    expect(r.scheduled).toBe(true);
  });

  it('returns 0 on a day not in schedule_days', () => {
    const r = expectedPlays(campaign, screen, '2026-07-11'); // a Saturday
    expect(r.expectedPlays).toBe(0);
    expect(r.scheduled).toBe(false);
    expect(r.reason).toBe('day_not_scheduled');
  });

  it('returns 0 before the campaign start date', () => {
    const r = expectedPlays(campaign, screen, '2026-06-30');
    expect(r.expectedPlays).toBe(0);
    expect(r.reason).toBe('outside_flight');
  });

  it('returns 0 after the campaign end date', () => {
    const r = expectedPlays(campaign, screen, '2026-08-03');
    expect(r.expectedPlays).toBe(0);
    expect(r.reason).toBe('outside_flight');
  });

  it('includes the first and last day of the flight', () => {
    expect(expectedPlays(campaign, screen, '2026-07-01').scheduled).toBe(true);  // Wednesday
    expect(expectedPlays(campaign, screen, '2026-07-31').scheduled).toBe(true);  // Friday
  });

  it('returns 0 when the daypart does not overlap operating hours', () => {
    const night = { ...campaign, time_start: '02:00', time_end: '05:00' };
    const r = expectedPlays(night, screen, '2026-07-08');
    expect(r.expectedPlays).toBe(0);
    expect(r.reason).toBe('no_overlap');
  });

  it('treats an empty schedule_days as every day', () => {
    const always = { ...campaign, schedule_days: [] };
    expect(expectedPlays(always, screen, '2026-07-11').scheduled).toBe(true);
  });

  it('defaults duration to 15s and slots to 10% when absent', () => {
    const bare = { ...campaign, duration: null, slots: null };
    expect(expectedPlays(bare, screen, '2026-07-08').expectedPlays).toBe(192);
  });

  it('clamps a slot share above 100 percent', () => {
    const greedy = { ...campaign, slots: 400 };
    // capped at 100% of the 8h overlap: 28800 / 15 = 1920
    expect(expectedPlays(greedy, screen, '2026-07-08').expectedPlays).toBe(1920);
  });

  it('returns 0 for a non-positive duration instead of dividing by zero', () => {
    const broken = { ...campaign, duration: 0 };
    const r = expectedPlays(broken, screen, '2026-07-08');
    expect(r.expectedPlays).toBe(0);
    expect(r.reason).toBe('invalid_duration');
  });

  it('accepts full day names as well as abbreviations', () => {
    const long = { ...campaign, schedule_days: ['Wednesday'] };
    expect(expectedPlays(long, screen, '2026-07-08').scheduled).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test supabase/functions/_shared/deliveryExpectation.test.js`
Expected: FAIL — cannot resolve `./deliveryExpectation.ts`.

- [ ] **Step 3: Write `supabase/functions/_shared/deliveryExpectation.ts`**

```ts
// How many plays a (campaign, screen, day) SHOULD have had.
//
// Pure — no Deno APIs, no database — so vitest runs it directly. This is the
// billing-side counterpart to ad_plays: what the advertiser paid for, versus
// what actually ran.
//
// Model: on a scheduled day the campaign occupies `slots` PERCENT of the
// airtime where its daypart overlaps the screen's operating hours.

export interface CampaignSchedule {
  schedule_days?: string[] | null;
  time_start?: string | null;
  time_end?: string | null;
  duration?: number | null;   // seconds per play
  slots?: number | null;      // percent of airtime, 1-100
  start_date?: string | null;
  end_date?: string | null;
}

export interface ScreenHours {
  operating_hours_start?: string | null;
  operating_hours_end?: string | null;
}

export interface Expectation {
  expectedPlays: number;
  scheduled: boolean;
  overlapSeconds: number;
  reason: string | null;
}

const DEFAULT_DURATION_S = 15;
const DEFAULT_SLOT_PCT = 10;
const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function parseHhMm(value: string | null | undefined): number | null {
  if (typeof value !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  const s = Number(m[3] ?? 0);
  if (h > 23 || min > 59 || s > 59) return null;
  return h * 3600 + min * 60 + s;
}

export function overlapSeconds(
  campaignStart: string | null | undefined,
  campaignEnd: string | null | undefined,
  screenStart: string | null | undefined,
  screenEnd: string | null | undefined,
): number {
  // A missing bound means "no restriction from this side".
  const cs = parseHhMm(campaignStart) ?? 0;
  const ce = parseHhMm(campaignEnd) ?? 86_400;
  const ss = parseHhMm(screenStart) ?? 0;
  const se = parseHhMm(screenEnd) ?? 86_400;

  const start = Math.max(cs, ss);
  const end = Math.min(ce, se);
  return Math.max(0, end - start);
}

function isScheduledDay(scheduleDays: string[] | null | undefined, day: Date): boolean {
  // An empty or absent list means every day.
  if (!Array.isArray(scheduleDays) || scheduleDays.length === 0) return true;
  const abbr = DAY_ABBR[day.getUTCDay()];
  return scheduleDays.some(d => typeof d === 'string' && d.slice(0, 3).toLowerCase() === abbr.toLowerCase());
}

export function expectedPlays(
  campaign: CampaignSchedule,
  screen: ScreenHours,
  day: string,
): Expectation {
  const none = (reason: string, overlap = 0): Expectation =>
    ({ expectedPlays: 0, scheduled: false, overlapSeconds: overlap, reason });

  const dayDate = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(dayDate.getTime())) return none('invalid_day');

  if (campaign.start_date && day < campaign.start_date) return none('outside_flight');
  if (campaign.end_date && day > campaign.end_date) return none('outside_flight');
  if (!isScheduledDay(campaign.schedule_days, dayDate)) return none('day_not_scheduled');

  const overlap = overlapSeconds(
    campaign.time_start, campaign.time_end,
    screen.operating_hours_start, screen.operating_hours_end,
  );
  if (overlap <= 0) return none('no_overlap');

  // `Number(null)` is 0, not NaN — so an absent duration must be detected
  // explicitly, otherwise `|| DEFAULT` would also swallow a genuine 0 and
  // divide by zero below.
  const durationS = campaign.duration === null || campaign.duration === undefined
    ? DEFAULT_DURATION_S
    : Number(campaign.duration);
  if (!Number.isFinite(durationS) || durationS <= 0) return none('invalid_duration', overlap);

  const slotsRaw = campaign.slots === null || campaign.slots === undefined
    ? DEFAULT_SLOT_PCT
    : Number(campaign.slots);
  const slotPct = Math.min(Math.max(Number.isFinite(slotsRaw) ? slotsRaw : DEFAULT_SLOT_PCT, 0), 100);
  const airtimeS = overlap * (slotPct / 100);

  return {
    expectedPlays: Math.floor(airtimeS / durationS),
    scheduled: true,
    overlapSeconds: overlap,
    reason: null,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test supabase/functions/_shared/deliveryExpectation.test.js`
Expected: PASS, 19 tests.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/deliveryExpectation.ts supabase/functions/_shared/deliveryExpectation.test.js
git commit -m "feat: add expected-plays model for delivery reconciliation"
```

---

## Task 2: Makegood math (pure)

**Files:**
- Create: `supabase/functions/_shared/makegood.ts`, `supabase/functions/_shared/makegood.test.js`

- [ ] **Step 1: Write the failing test at `supabase/functions/_shared/makegood.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { shortfallPct, dailyBudgetShare, creditAmount, SHORTFALL_THRESHOLD } from './makegood.ts';

describe('shortfallPct', () => {
  it('is 0 when delivery meets expectation', () => {
    expect(shortfallPct(100, 100)).toBe(0);
  });

  it('is 0 when delivery exceeds expectation', () => {
    expect(shortfallPct(120, 100)).toBe(0);
  });

  it('is the missing fraction when delivery falls short', () => {
    expect(shortfallPct(75, 100)).toBeCloseTo(0.25, 6);
  });

  it('is 1 when nothing was delivered', () => {
    expect(shortfallPct(0, 100)).toBe(1);
  });

  it('is 0 when nothing was expected, so an idle day is never a credit', () => {
    expect(shortfallPct(0, 0)).toBe(0);
    expect(shortfallPct(5, 0)).toBe(0);
  });
});

describe('dailyBudgetShare', () => {
  it('splits the budget evenly across flight days and screens', () => {
    // $300 over 10 days across 3 screens = $10 per screen-day
    expect(dailyBudgetShare(300, 10, 3)).toBeCloseTo(10, 6);
  });

  it('returns 0 when any divisor is missing', () => {
    expect(dailyBudgetShare(300, 0, 3)).toBe(0);
    expect(dailyBudgetShare(300, 10, 0)).toBe(0);
    expect(dailyBudgetShare(0, 10, 3)).toBe(0);
  });
});

describe('creditAmount', () => {
  it('credits the shortfall fraction of the screen-day budget', () => {
    // 25% short of a $10 screen-day = $2.50
    expect(creditAmount(0.25, 10)).toBeCloseTo(2.5, 6);
  });

  it('rounds to cents', () => {
    expect(creditAmount(1 / 3, 10)).toBe(3.33);
  });

  it('is 0 below the threshold, so rounding noise is not a payout', () => {
    expect(SHORTFALL_THRESHOLD).toBe(0.05);
    expect(creditAmount(0.04, 10)).toBe(0);
    expect(creditAmount(0.05, 10)).toBeCloseTo(0.5, 6);
  });

  it('never exceeds the screen-day budget', () => {
    expect(creditAmount(1, 10)).toBe(10);
  });

  it('is 0 for nonsense input', () => {
    expect(creditAmount(NaN, 10)).toBe(0);
    expect(creditAmount(0.5, NaN)).toBe(0);
    expect(creditAmount(-1, 10)).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test supabase/functions/_shared/makegood.test.js`
Expected: FAIL — cannot resolve `./makegood.ts`.

- [ ] **Step 3: Write `supabase/functions/_shared/makegood.ts`**

```ts
// Makegood math: how much of a screen-day the advertiser did not receive, and
// what that is worth back to them.
//
// Deliberately conservative: a day with nothing expected is never a credit,
// and a credit can never exceed that screen-day's share of the budget.

export const SHORTFALL_THRESHOLD = 0.05;

export function shortfallPct(delivered: number, expected: number): number {
  const d = Number(delivered);
  const e = Number(expected);
  if (!Number.isFinite(d) || !Number.isFinite(e) || e <= 0) return 0;
  if (d >= e) return 0;
  return (e - d) / e;
}

export function dailyBudgetShare(budget: number, flightDays: number, screenCount: number): number {
  const b = Number(budget);
  const days = Number(flightDays);
  const screens = Number(screenCount);
  if (!Number.isFinite(b) || !Number.isFinite(days) || !Number.isFinite(screens)) return 0;
  if (b <= 0 || days <= 0 || screens <= 0) return 0;
  return b / days / screens;
}

export function creditAmount(shortfall: number, screenDayBudget: number): number {
  const s = Number(shortfall);
  const b = Number(screenDayBudget);
  if (!Number.isFinite(s) || !Number.isFinite(b) || s <= 0 || b <= 0) return 0;
  if (s < SHORTFALL_THRESHOLD) return 0;
  const raw = Math.min(s, 1) * b;
  return Math.round(raw * 100) / 100;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test supabase/functions/_shared/makegood.test.js`
Expected: PASS, 14 tests.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/makegood.ts supabase/functions/_shared/makegood.test.js
git commit -m "feat: add makegood credit math"
```

---

## Task 3: `delivery_reconciliation` table

**Files:**
- Create: `supabase/migrations/20260725000000_delivery_reconciliation.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- One immutable row per (campaign, screen, closed day): what was expected,
-- what actually played, and what was credited back.
--
-- `credited_at` makes credit issuance idempotent — the reconciliation row may
-- be recomputed, but a credit is applied exactly once.
--
-- NOTE: campaign_id and screen_id are text, matching bookings.id / screens.id.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.delivery_reconciliation (
  id                bigserial PRIMARY KEY,
  campaign_id       text NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  screen_id         text NOT NULL REFERENCES public.screens(id) ON DELETE CASCADE,
  day               date NOT NULL,
  expected_plays    integer NOT NULL DEFAULT 0,
  delivered_plays   integer NOT NULL DEFAULT 0,
  shortfall_pct     numeric NOT NULL DEFAULT 0 CHECK (shortfall_pct >= 0 AND shortfall_pct <= 1),
  screen_day_budget numeric NOT NULL DEFAULT 0,
  credit_amount     numeric NOT NULL DEFAULT 0 CHECK (credit_amount >= 0),
  currency          text,
  reason            text,          -- 'screen_offline' | 'underdelivered' | 'met' | 'not_scheduled'
  credited_to       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  credited_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delivery_reconciliation_unique UNIQUE (campaign_id, screen_id, day)
);

CREATE INDEX IF NOT EXISTS delivery_reconciliation_campaign_idx
  ON public.delivery_reconciliation (campaign_id, day DESC);
CREATE INDEX IF NOT EXISTS delivery_reconciliation_screen_idx
  ON public.delivery_reconciliation (screen_id, day DESC);

ALTER TABLE public.delivery_reconciliation ENABLE ROW LEVEL SECURITY;

-- Only the service role writes reconciliation rows.
REVOKE INSERT, UPDATE, DELETE ON public.delivery_reconciliation FROM anon, authenticated;
REVOKE ALL ON public.delivery_reconciliation FROM anon;
GRANT SELECT ON public.delivery_reconciliation TO authenticated;

DROP POLICY IF EXISTS "advertiser_view_own_reconciliation" ON public.delivery_reconciliation;
CREATE POLICY "advertiser_view_own_reconciliation" ON public.delivery_reconciliation
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = delivery_reconciliation.campaign_id
        AND b.advertiser_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "operator_view_own_screen_reconciliation" ON public.delivery_reconciliation;
CREATE POLICY "operator_view_own_screen_reconciliation" ON public.delivery_reconciliation
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.screens s
      WHERE s.id = delivery_reconciliation.screen_id
        AND s.operator_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Apply it**

Apply through the Supabase MCP `apply_migration` (project `hkqiuwnppxkkztacwicj`, name `delivery_reconciliation`), **not** `supabase db push` — the CLI refuses to push because remote migration history does not match local filenames (a pre-existing drift, not something to repair as part of this task).

- [ ] **Step 3: Verify the table exists with the right column types**

```sql
select column_name, data_type from information_schema.columns
where table_name = 'delivery_reconciliation' order by ordinal_position;
```
Expected: 14 rows; `campaign_id` and `screen_id` are `text`; `credited_to` is `uuid`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260725000000_delivery_reconciliation.sql
git commit -m "feat: add delivery_reconciliation table"
```

---

## Task 4: Notification templates for makegoods

**Files:**
- Modify: `supabase/functions/send-notification/index.ts`

`send-notification` 400s on an unknown type, so the templates must exist before the reconciliation function can send anything.

- [ ] **Step 1: Add both templates to the `TEMPLATES` object**

Insert these two entries alongside the existing ones (e.g. after `campaign_ended`). Match the surrounding style exactly — each returns `{ title, body, html }` and uses the shared `emailHtml` helper:

```ts
  delivery_shortfall_credited: (d) => ({
    title: "Delivery credit applied",
    body: `"${d.campaignName}" under-delivered on ${d.day} and ${d.creditAmount} has been credited back to your balance.`,
    html: emailHtml(
      "Delivery credit applied",
      `Your campaign <strong>${d.campaignName}</strong> delivered ${d.deliveredPlays} of ${d.expectedPlays} scheduled plays on ${d.day}. We have credited <strong>${d.creditAmount}</strong> back to your account balance.`,
      "View Delivery",
      d.appUrl ?? "",
    ),
  }),
  screen_downtime_attributed: (d) => ({
    title: "Screen downtime affected a campaign",
    body: `${d.screenName} missed ${d.missedPlays} scheduled plays on ${d.day}. The advertiser has been credited.`,
    html: emailHtml(
      "Screen downtime affected a campaign",
      `<strong>${d.screenName}</strong> delivered ${d.deliveredPlays} of ${d.expectedPlays} scheduled plays on ${d.day}. The advertiser has been credited for the shortfall. Check the screen's connection to avoid further lost revenue.`,
      "View Screen",
      d.appUrl ?? "",
    ),
  }),
```

- [ ] **Step 2: Deploy and confirm an unknown type is still rejected but the new ones are accepted**

```bash
pnpm dlx supabase functions deploy send-notification
```

Then confirm the type list grew — the function returns 400 `Unknown notification type` for a bogus type and does not for the new ones. Verify by reading the deployed source list:

Run: `grep -c "html: emailHtml" supabase/functions/send-notification/index.ts`
Expected: 19 (17 existing + 2 new).

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/send-notification/index.ts
git commit -m "feat: add delivery shortfall and screen downtime notification templates"
```

---

## Task 5: `reconcile-delivery` edge function

**Files:**
- Create: `supabase/functions/reconcile-delivery/index.ts`

Reconciles **closed days only** — a day is closed once it is strictly before today in the screen's own timezone. This is what prevents a still-running day from being credited as a shortfall.

- [ ] **Step 1: Write `supabase/functions/reconcile-delivery/index.ts`**

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { expectedPlays } from "../_shared/deliveryExpectation.ts";
import { shortfallPct, dailyBudgetShare, creditAmount, SHORTFALL_THRESHOLD } from "../_shared/makegood.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const FUNCTIONS_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
const INTERNAL_SECRET = Deno.env.get("INTERNAL_NOTIFICATION_SECRET") ?? "";
const APP_URL = Deno.env.get("PUBLIC_APP_URL") ?? "";

// How far back to re-check. Covers a cron outage without rescanning history.
const LOOKBACK_DAYS = 7;

const CORS = { "Content-Type": "application/json" };

/** Today's date in a given IANA timezone, as YYYY-MM-DD. */
function todayInTz(tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
  }
}

function addDays(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function daysBetweenInclusive(start: string, end: string): number {
  const a = new Date(`${start}T00:00:00Z`).getTime();
  const b = new Date(`${end}T00:00:00Z`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

async function notify(userId: string, type: string, data: Record<string, string>) {
  if (!userId) return;
  await fetch(`${FUNCTIONS_URL}/send-notification`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-secret": INTERNAL_SECRET },
    body: JSON.stringify({ userId, type, data }),
  }).catch(() => {});
}

Deno.serve(async (_req: Request) => {
  // Only paid campaigns can be credited — there is nothing to give back on an
  // unpaid one.
  const { data: campaigns } = await supabase
    .from("bookings")
    .select("id, advertiser_id, billed_to_profile_id, campaign_name, advertiser_name, budget, currency, start_date, end_date, schedule_days, time_start, time_end, duration, slots, status, payment_status")
    .eq("payment_status", "paid")
    .in("status", ["scheduled", "active", "completed"]);

  if (!campaigns || campaigns.length === 0) {
    return new Response(JSON.stringify({ ok: true, campaigns: 0, rows: 0, credited: 0 }), { headers: CORS });
  }

  let rowsWritten = 0;
  let creditsIssued = 0;

  for (const campaign of campaigns) {
    // Only screens that were actually cleared to play can under-deliver.
    const { data: campaignScreens } = await supabase
      .from("campaign_screens")
      .select("screen_id, status")
      .eq("campaign_id", campaign.id)
      .in("status", ["approved", "auto_approved"]);

    const screenIds = (campaignScreens ?? []).map(cs => cs.screen_id as string);
    if (screenIds.length === 0) continue;

    const { data: screens } = await supabase
      .from("screens")
      .select("id, name, operator_id, timezone, operating_hours_start, operating_hours_end")
      .in("id", screenIds);

    if (!screens || screens.length === 0) continue;

    const flightDays = daysBetweenInclusive(campaign.start_date as string, campaign.end_date as string);
    const screenDayBudget = dailyBudgetShare(campaign.budget as number, flightDays, screens.length);
    const billedTo = (campaign.billed_to_profile_id ?? campaign.advertiser_id) as string;
    const campaignLabel = (campaign.campaign_name ?? campaign.advertiser_name ?? campaign.id) as string;

    for (const screen of screens) {
      const tz = (screen.timezone as string) ?? "UTC";
      const today = todayInTz(tz);

      // Closed days only: strictly before today in the screen's timezone.
      const windowStart = addDays(today, -LOOKBACK_DAYS);
      const firstDay = campaign.start_date && (campaign.start_date as string) > windowStart
        ? (campaign.start_date as string)
        : windowStart;
      const lastDay = campaign.end_date && (campaign.end_date as string) < addDays(today, -1)
        ? (campaign.end_date as string)
        : addDays(today, -1);

      if (lastDay < firstDay) continue;

      const { data: delivered } = await supabase
        .from("campaign_delivery_daily")
        .select("day, plays")
        .eq("campaign_id", campaign.id)
        .eq("screen_id", screen.id)
        .gte("day", firstDay)
        .lte("day", lastDay);

      const deliveredByDay = new Map<string, number>();
      for (const row of delivered ?? []) {
        deliveredByDay.set(row.day as string, Number(row.plays) || 0);
      }

      for (let day = firstDay; day <= lastDay; day = addDays(day, 1)) {
        const expectation = expectedPlays(campaign, screen, day);
        if (!expectation.scheduled) continue; // nothing owed on an unscheduled day

        const deliveredPlays = deliveredByDay.get(day) ?? 0;
        const shortfall = shortfallPct(deliveredPlays, expectation.expectedPlays);
        const credit = creditAmount(shortfall, screenDayBudget);

        // Attribute the cause. A screen with no heartbeat at all that day was
        // dark; anything else is under-delivery we cannot blame on downtime.
        let reason = "met";
        if (shortfall >= SHORTFALL_THRESHOLD) {
          const { count: heartbeats } = await supabase
            .from("display_heartbeats")
            .select("id", { count: "exact", head: true })
            .eq("screen_id", screen.id)
            .gte("created_at", `${day}T00:00:00Z`)
            .lt("created_at", `${addDays(day, 1)}T00:00:00Z`);
          reason = (heartbeats ?? 0) === 0 ? "screen_offline" : "underdelivered";
        }

        // Upsert the reconciliation row. Never touch credited_at here — credit
        // issuance below owns it, so a recompute cannot double-credit.
        const { data: existing } = await supabase
          .from("delivery_reconciliation")
          .select("id, credited_at")
          .eq("campaign_id", campaign.id)
          .eq("screen_id", screen.id)
          .eq("day", day)
          .maybeSingle();

        const row = {
          campaign_id: campaign.id,
          screen_id: screen.id,
          day,
          expected_plays: expectation.expectedPlays,
          delivered_plays: deliveredPlays,
          shortfall_pct: shortfall,
          screen_day_budget: screenDayBudget,
          credit_amount: credit,
          currency: campaign.currency,
          reason,
          credited_to: credit > 0 ? billedTo : null,
        };

        if (existing) {
          await supabase.from("delivery_reconciliation").update(row).eq("id", existing.id);
        } else {
          await supabase.from("delivery_reconciliation").insert(row);
        }
        rowsWritten++;

        // Issue the credit exactly once per reconciliation row.
        if (credit > 0 && !existing?.credited_at) {
          const { data: profile } = await supabase
            .from("profiles").select("credits").eq("id", billedTo).single();

          const newBalance = Number(profile?.credits ?? 0) + credit;
          const { error: creditError } = await supabase
            .from("profiles").update({ credits: newBalance }).eq("id", billedTo);

          if (!creditError) {
            await supabase
              .from("delivery_reconciliation")
              .update({ credited_at: new Date().toISOString() })
              .eq("campaign_id", campaign.id)
              .eq("screen_id", screen.id)
              .eq("day", day);
            creditsIssued++;

            await notify(billedTo, "delivery_shortfall_credited", {
              campaignName: campaignLabel,
              day,
              creditAmount: `${credit.toFixed(2)} ${String(campaign.currency ?? "CAD").toUpperCase()}`,
              deliveredPlays: String(deliveredPlays),
              expectedPlays: String(expectation.expectedPlays),
              appUrl: APP_URL,
            });

            if (reason === "screen_offline" && screen.operator_id) {
              await notify(screen.operator_id as string, "screen_downtime_attributed", {
                screenName: (screen.name as string) ?? screen.id,
                day,
                missedPlays: String(expectation.expectedPlays - deliveredPlays),
                deliveredPlays: String(deliveredPlays),
                expectedPlays: String(expectation.expectedPlays),
                appUrl: APP_URL,
              });
            }
          }
        }
      }
    }
  }

  return new Response(
    JSON.stringify({ ok: true, campaigns: campaigns.length, rows: rowsWritten, credited: creditsIssued }),
    { headers: CORS },
  );
});
```

- [ ] **Step 2: Deploy**

```bash
pnpm dlx supabase functions deploy reconcile-delivery --no-verify-jwt
```

The `--no-verify-jwt` flag is required: pg_cron calls this with no user JWT, and without it the gateway 401s before the function runs.

- [ ] **Step 3: Run it once and read the result**

```bash
curl -s -X POST "https://hkqiuwnppxkkztacwicj.supabase.co/functions/v1/reconcile-delivery"
```
Expected: JSON `{"ok":true,"campaigns":N,"rows":M,"credited":K}` with no error field.

- [ ] **Step 4: Verify idempotency — run it a second time**

```bash
curl -s -X POST "https://hkqiuwnppxkkztacwicj.supabase.co/functions/v1/reconcile-delivery"
```
Then check that no credit was applied twice:
```sql
select count(*) as credited_rows, coalesce(sum(credit_amount),0) as total_credit
from delivery_reconciliation where credited_at is not null;
```
Expected: identical `total_credit` after both runs. This is the single most important check in this plan — run it before moving on.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/reconcile-delivery/index.ts
git commit -m "feat: add nightly delivery reconciliation with one-time makegood credits"
```

---

## Task 6: Nightly cron

**Files:**
- Create: `supabase/migrations/20260725000002_reconcile_delivery_cron.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Runs at 04:00 UTC, after the 03:00 data-retention job and safely past
-- midnight in every Canadian timezone, so "yesterday" is closed everywhere.
SELECT cron.unschedule('reconcile-delivery')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconcile-delivery');

SELECT cron.schedule(
  'reconcile-delivery',
  '0 4 * * *',
  $$SELECT net.http_post('https://hkqiuwnppxkkztacwicj.supabase.co/functions/v1/reconcile-delivery', '{}', 'application/json');$$
);
```

- [ ] **Step 2: Apply via the Supabase MCP `apply_migration`, name `reconcile_delivery_cron`**

- [ ] **Step 3: Verify the job is registered**

```sql
select jobname, schedule from cron.job where jobname = 'reconcile-delivery';
```
Expected: one row, schedule `0 4 * * *`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260725000002_reconcile_delivery_cron.sql
git commit -m "feat: schedule nightly delivery reconciliation"
```

---

## Task 7: `campaign_delivery_health` view

**Files:**
- Create: `supabase/migrations/20260725000001_delivery_health.sql`

One row per campaign: the headline "97% of scheduled plays confirmed" number.

- [ ] **Step 1: Write the migration**

```sql
-- Per-campaign delivery health, rolled up from reconciliation.
--
-- Access model matches campaign_delivery_daily: this view reads public.screens
-- (via delivery_reconciliation's screen join it does not, but keep the pattern
-- consistent and explicit), so it is owner-executed with its own predicate
-- scoped on the DATABASE role rather than a JWT claim — an absent claim must
-- not widen access.
CREATE OR REPLACE VIEW public.campaign_delivery_health AS
SELECT
  r.campaign_id,
  sum(r.expected_plays)::bigint  AS expected_plays,
  sum(r.delivered_plays)::bigint AS delivered_plays,
  CASE WHEN sum(r.expected_plays) > 0
       THEN round(sum(r.delivered_plays)::numeric / sum(r.expected_plays) * 100, 1)
       ELSE NULL END             AS delivery_pct,
  sum(r.credit_amount)           AS total_credited,
  count(*) FILTER (WHERE r.reason = 'screen_offline')  AS offline_days,
  count(*) FILTER (WHERE r.reason = 'underdelivered')  AS underdelivered_days,
  max(r.day)                     AS last_reconciled_day
FROM public.delivery_reconciliation r
WHERE
  current_user IN ('postgres', 'supabase_admin', 'service_role')
  OR EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = r.campaign_id AND b.advertiser_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.screens s
    WHERE s.id = r.screen_id AND s.operator_id = auth.uid()
  )
GROUP BY r.campaign_id;

REVOKE ALL ON public.campaign_delivery_health FROM anon;
GRANT SELECT ON public.campaign_delivery_health TO authenticated, service_role;
```

- [ ] **Step 2: Apply via the Supabase MCP `apply_migration`, name `campaign_delivery_health`**

- [ ] **Step 3: Verify tenant scoping with four probes**

Run each and record the row count:
```sql
-- admin sees all
select count(*) from campaign_delivery_health;
```
```sql
-- owning advertiser sees their own
set local role authenticated;
set local request.jwt.claims = '{"sub":"<advertiser-uuid>","role":"authenticated"}';
select count(*) from campaign_delivery_health;
```
```sql
-- a different advertiser sees none
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000ff","role":"authenticated"}';
select count(*) from campaign_delivery_health;
```
```sql
-- authenticated with NO claims sees none
set local role authenticated;
select count(*) from campaign_delivery_health;
```
Expected: all rows / own rows / 0 / 0. The last probe is the one that caught a real leak in Phase 1 — do not skip it.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260725000001_delivery_health.sql
git commit -m "feat: add campaign delivery health view"
```

---

## Task 8: Delivery health card

**Files:**
- Create: `src/components/shared/DeliveryHealthCard.jsx`, `src/components/shared/DeliveryHealthCard.test.jsx`
- Modify: `src/views/advertiser/AdvDashboard.jsx`

- [ ] **Step 1: Write the failing test at `src/components/shared/DeliveryHealthCard.test.jsx`**

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeliveryHealthCard } from './DeliveryHealthCard.jsx';

describe('DeliveryHealthCard', () => {
  it('renders the delivery percentage', () => {
    render(<DeliveryHealthCard health={{ delivery_pct: 97.4, delivered_plays: 974, expected_plays: 1000, total_credited: 0, offline_days: 0 }} />);
    expect(screen.getByText(/97.4%/)).toBeInTheDocument();
    expect(screen.getByText(/974 of 1,000 scheduled plays confirmed/)).toBeInTheDocument();
  });

  it('shows credited amount when a makegood was issued', () => {
    render(<DeliveryHealthCard health={{ delivery_pct: 80, delivered_plays: 800, expected_plays: 1000, total_credited: 42.5, offline_days: 2 }} currency="cad" />);
    expect(screen.getByText(/\$42.50 credited back/)).toBeInTheDocument();
    expect(screen.getByText(/2 days a screen was offline/)).toBeInTheDocument();
  });

  it('says so plainly when nothing has been reconciled yet', () => {
    render(<DeliveryHealthCard health={null} />);
    expect(screen.getByText(/No completed days to reconcile yet/)).toBeInTheDocument();
  });

  it('does not claim a percentage when none was computed', () => {
    const { container } = render(<DeliveryHealthCard health={{ delivery_pct: null, delivered_plays: 0, expected_plays: 0, total_credited: 0, offline_days: 0 }} />);
    expect(container.textContent).not.toMatch(/%/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/components/shared/DeliveryHealthCard.test.jsx`
Expected: FAIL — cannot resolve `./DeliveryHealthCard.jsx`.

- [ ] **Step 3: Write `src/components/shared/DeliveryHealthCard.jsx`**

```jsx
import { C, F } from '../../design/tokens.js';
import { Card } from '../primitives/Card.jsx';
import { ProgressBar } from '../primitives/ProgressBar.jsx';

// Delivery health is only ever computed from CLOSED days, so a running
// campaign legitimately shows less than its full flight. Never imply a
// shortfall for a day that has not finished.
export function DeliveryHealthCard({ health, currency = 'cad' }) {
  if (!health) {
    return (
      <Card style={{ padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: C.textSub, fontFamily: F.sans, marginBottom: 8 }}>Delivery health</div>
        <div style={{ fontSize: 13, color: C.textMuted, fontFamily: F.sans }}>
          No completed days to reconcile yet.
        </div>
      </Card>
    );
  }

  const pct = health.delivery_pct;
  const hasPct = pct !== null && pct !== undefined && Number.isFinite(Number(pct));
  const credited = Number(health.total_credited) || 0;
  const offlineDays = Number(health.offline_days) || 0;
  const color = !hasPct ? C.text : Number(pct) >= 95 ? C.green : Number(pct) >= 85 ? C.amber : C.red;

  return (
    <Card style={{ padding: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: C.textSub, fontFamily: F.sans, marginBottom: 8 }}>Delivery health</div>

      {hasPct && (
        <div style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1, marginBottom: 6, fontFamily: F.mono }}>
          {Number(pct).toFixed(1)}%
        </div>
      )}

      <div style={{ fontSize: 12, color: C.textMuted, fontFamily: F.sans, marginBottom: 10 }}>
        {Number(health.delivered_plays).toLocaleString()} of {Number(health.expected_plays).toLocaleString()} scheduled plays confirmed
      </div>

      {hasPct && <ProgressBar value={Number(health.delivered_plays)} max={Number(health.expected_plays)} height={4} />}

      {credited > 0 && (
        <div style={{ fontSize: 12, color: C.green, fontFamily: F.sans, marginTop: 10, fontWeight: 500 }}>
          ${credited.toFixed(2)} credited back{currency ? ` (${String(currency).toUpperCase()})` : ''}
        </div>
      )}

      {offlineDays > 0 && (
        <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 4 }}>
          {offlineDays} {offlineDays === 1 ? 'day a screen was' : 'days a screen was'} offline
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/components/shared/DeliveryHealthCard.test.jsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Wire it into `src/views/advertiser/AdvDashboard.jsx`**

Add the import next to the other component imports:

```js
import { DeliveryHealthCard } from '../../components/shared/DeliveryHealthCard.jsx';
```

Add state and a fetch alongside the existing `delivery` effect:

```js
  const [health, setHealth] = useState(null);

  useEffect(() => {
    const fetchHealth = async () => {
      const myCampaignIds = campaigns
        .filter(c => c.advertiser_id === advertiserId)
        .map(c => c.id);
      if (myCampaignIds.length === 0) { setHealth(null); return; }

      const { data, error } = await supabase
        .from('campaign_delivery_health')
        .select('campaign_id, expected_plays, delivered_plays, delivery_pct, total_credited, offline_days')
        .in('campaign_id', myCampaignIds);

      if (error || !data || data.length === 0) { setHealth(null); return; }

      // Roll every campaign up into one account-level number.
      const expected = data.reduce((a, r) => a + (Number(r.expected_plays) || 0), 0);
      const delivered = data.reduce((a, r) => a + (Number(r.delivered_plays) || 0), 0);
      setHealth({
        expected_plays: expected,
        delivered_plays: delivered,
        delivery_pct: expected > 0 ? (delivered / expected) * 100 : null,
        total_credited: data.reduce((a, r) => a + (Number(r.total_credited) || 0), 0),
        offline_days: data.reduce((a, r) => a + (Number(r.offline_days) || 0), 0),
      });
    };
    fetchHealth();
  }, [campaigns, advertiserId]);
```

Render it directly below the existing KPI grid, before the campaign list:

```jsx
      <div style={{ marginBottom: 24 }}>
        <DeliveryHealthCard health={health} currency={myCampaigns[0]?.currency} />
      </div>
```

- [ ] **Step 6: Verify the full suite, build, and scoped lint**

Run: `pnpm test`
Expected: all suites pass.

Run: `pnpm build`
Expected: exits 0.

Run: `pnpm exec eslint src/components/shared/DeliveryHealthCard.jsx src/views/advertiser/AdvDashboard.jsx`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/shared/DeliveryHealthCard.jsx src/components/shared/DeliveryHealthCard.test.jsx src/views/advertiser/AdvDashboard.jsx
git commit -m "feat: show delivery health and makegood credits to advertisers"
```

---

## Task 9: Operator-side downtime attribution

**Files:**
- Modify: `src/views/operator/ScreenDetail.jsx`

An operator must see downtime attributed to their screen — it is revenue they lost, and the fastest way to get them to fix a dark screen.

- [ ] **Step 1: Fetch reconciliation for this screen**

Add near the other data fetches in `ScreenDetail`:

```js
  const [downtime, setDowntime] = useState([]);

  useEffect(() => {
    if (!screen?.id) return;
    const fetchDowntime = async () => {
      const { data } = await supabase
        .from('delivery_reconciliation')
        .select('day, expected_plays, delivered_plays, reason, credit_amount, currency')
        .eq('screen_id', screen.id)
        .neq('reason', 'met')
        .order('day', { ascending: false })
        .limit(30);
      setDowntime(data ?? []);
    };
    fetchDowntime();
  }, [screen?.id]);
```

Use the existing screen state variable name in this file if it is not `screen`.

- [ ] **Step 2: Render a section below the existing screen detail cards**

```jsx
      {downtime.length > 0 && (
        <Card style={{ padding: 20, marginTop: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>
            Missed delivery
          </div>
          <div style={{ fontSize: 12, color: C.textMuted, fontFamily: F.sans, marginBottom: 14 }}>
            Days this screen delivered fewer plays than campaigns had scheduled. Advertisers were credited for the shortfall.
          </div>
          <Table
            columns={[
              { key: 'day', label: 'Day' },
              { key: 'delivered_plays', label: 'Delivered', render: (v, r) => `${v} of ${r.expected_plays}` },
              { key: 'reason', label: 'Cause', render: v => v === 'screen_offline' ? 'Screen offline' : 'Under-delivered' },
              { key: 'credit_amount', label: 'Credited back', render: (v, r) => `$${Number(v).toFixed(2)} ${String(r.currency ?? '').toUpperCase()}` },
            ]}
            rows={downtime}
          />
        </Card>
      )}
```

Match the `Table` prop names already used in this file — if it takes `data` rather than `rows`, use that.

- [ ] **Step 3: Verify**

Run: `pnpm test && pnpm build`
Expected: both pass.

Run: `pnpm exec eslint src/views/operator/ScreenDetail.jsx`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/views/operator/ScreenDetail.jsx
git commit -m "feat: show operators the delivery they missed on each screen"
```

---

## Task 10: Phase 2A verification pass

- [ ] **Step 1: Full test suite**

Run: `pnpm test`
Expected: all pass. Record the count.

- [ ] **Step 2: Build**

Run: `pnpm build`
Expected: exits 0.

- [ ] **Step 3: Credits are issued exactly once**

Run the reconciliation function twice more, then:
```sql
select count(*) as credited_rows, coalesce(sum(credit_amount),0) as total_credit
from delivery_reconciliation where credited_at is not null;
```
Expected: unchanged between runs.

- [ ] **Step 4: No credit was issued for an open day**

```sql
select count(*) as future_or_today_rows
from delivery_reconciliation r
join screens s on s.id = r.screen_id
where r.day >= (now() at time zone coalesce(s.timezone,'UTC'))::date;
```
Expected: `0`. Reconciling a day that has not closed would credit a shortfall that has not happened.

- [ ] **Step 5: Credits reconcile against profile balances**

```sql
select p.id, p.credits, coalesce(sum(r.credit_amount),0) as reconciliation_total
from profiles p
left join delivery_reconciliation r on r.credited_to = p.id and r.credited_at is not null
group by p.id, p.credits
having p.credits <> coalesce(sum(r.credit_amount),0);
```
Expected: rows only for profiles whose credits were set by something other than this pipeline. Any campaign-credited profile must match exactly.

- [ ] **Step 6: Tenant scoping holds on both new surfaces**

Re-run the four probes from Task 7 Step 3 against **both** `campaign_delivery_health` and `delivery_reconciliation`.
Expected: admin all, owner own, other 0, no-claims 0.

- [ ] **Step 7: Confirm the acceptance criteria**

- A closed day with a dark screen produces a reconciliation row with `reason = 'screen_offline'` and a credit.
- Re-running reconciliation never changes `total_credit`.
- An unscheduled day (not in `schedule_days`) never produces a row.
- The advertiser sees delivery health and the credited amount; the operator sees the same shortfall attributed to their screen.
- No open day is ever reconciled.

- [ ] **Step 8: Commit the checked-off plan**

```bash
git add docs/superpowers/plans/2026-07-25-phase2a-delivery-reconciliation.md
git commit -m "docs: mark phase 2A delivery reconciliation complete"
```
