# Screen-Level Holdout / Lift Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an advertiser with 10+ matched screens opt into a holdout test — ~20% of screens randomly withheld as an unbilled, unserved control group — and see whether their campaign produced a statistically significant lift in scan rate, both privately (`CampaignDetail`) and on the public shareable report (`CampaignReport`).

**Architecture:** Two new DB columns (`bookings.holdout_enabled`, `campaign_screens.is_control`) plus a `lift_stats` SQL view (per-campaign scan-rate comparison, computed live — no materialization needed, this is a single-campaign filter not a network aggregate). Control-screen assignment happens server-side via a dedicated edge function calling a `SECURITY DEFINER` SQL function, never client-computed — an advertiser cherry-picking their own "unlucky" screens as control would fabricate a misleading lift number on their own public report. A pure `src/lib/liftTest.js` module (mirroring `src/lib/benchmark.js`'s "fail to unavailable, never to a misleading number" discipline) turns the view's row into a verdict. `display-feed` and `charge-campaign`'s operator-payout step both exclude `is_control` screens.

**Tech Stack:** Supabase Postgres (view + `SECURITY DEFINER` function), Deno edge functions, React 19 (JS), vitest.

**Depends on:** `campaign_delivery_daily` (2026-07-24), `campaign_screens` (2026-06-05), Phase 3A benchmarks pattern (2026-07-25, for the "self-gating, honest empty state" discipline this plan reuses).

---

## Context an engineer needs before starting

**Verified against production on 2026-08-14.**

- **IDs:** `bookings.id` is `text`. `campaign_screens.id` is `uuid`, `campaign_screens.campaign_id`/`screen_id` are `text`. `bookings.advertiser_id` is `uuid`.
- **`campaign_screens`** already has a `status` column (`pending`/`approved`/`auto_approved`/`rejected`) and RLS: advertisers can INSERT/SELECT rows for campaigns they own (`bookings.advertiser_id = auth.uid()`), operators can SELECT/UPDATE rows for screens they own. No column-level restriction — an advertiser's INSERT can set any column on their own campaign's rows, which is exactly why the random control assignment must be **server-computed after insert**, not sent by the client — a client-set `is_control` would let an advertiser choose which screens "lose," fabricating the lift number that later appears on their own public report.
- **`campaign_delivery_daily`** (view) columns: `campaign_id, screen_id, day, plays, completed_plays, impressions, attention_weighted_impressions, basis, scans, billable_scans`. Always use `billable_scans`, not `scans` (bot/duplicate filtered).
- **`bookings.budget`** is a flat number the advertiser types into the wizard (`StepBudgetReview`) — it is not computed from screen count × CPM anywhere in this codebase. So "the advertiser doesn't pay for holdout screens" cannot be implemented by changing what `charge-campaign` charges (it always charges `booking.budget` verbatim, unconditionally — see `supabase/functions/charge-campaign/index.ts`). It's implemented by excluding control screens from **`distributeOperatorCuts`**, the same function's operator-payout step: the platform simply doesn't pay an operator for a screen that never served the campaign. The advertiser's forecasted reach number shown at wizard time (`reachSummary` in `CreateCampaign.jsx`) is out of scope for this plan — it is a display-only estimate the advertiser already sees before enabling holdout, not tied to what they're billed.
- **The wizard's screen-insert flow** (`CreateCampaign.jsx` `handleSubmit`, `src/views/advertiser/CreateCampaign.jsx:270-312`) is reused both for brand-new campaigns and for "+ Add targeting group" (adds a new `bookings` row under an existing `campaigns.id` parent). This plan makes the holdout toggle a per-targeting-group choice: each new `bookings` row can independently opt in if it has ≥10 matched screens, rather than inheriting a parent campaign's holdout status. Simpler, and matches the spec's intent that newly added screens "are also randomly split."
- **`Campaigns.jsx`/`App.jsx`'s booking→display-object mapping is a spread** (`{ ...b, advertiser: b.advertiser_name, ... }` at `src/App.jsx:213-227`) — any new raw `bookings` column (like `holdout_enabled`) is automatically available on the campaign object components already receive as `c.holdout_enabled`, no mapping change needed.
- **Scope note vs. the design spec:** the spec's edge-case list included labeling a lift result "partial flight — interpret with caution" when a campaign is cancelled/paused before its scheduled end. This plan does not implement that label — it would require threading campaign status into the public report response (`campaign-report` deliberately omits status today; see its "no advertiser identity" comment) purely for a caveat string, for a condition (early cancellation while a holdout test is running) that will be rare in practice. `LiftTestPanel`'s existing "still collecting data" state already covers the underlying risk (a short flight won't clear `MIN_IMPRESSIONS_PER_GROUP` anyway in most cases). Deferred; add it in a follow-up if early-cancelled holdout campaigns turn out to be common enough to matter.
- **`campaign-report` edge function** (`supabase/functions/campaign-report/index.ts`) is the *only* source of data for the public `CampaignReport.jsx` page — it has no direct Supabase client access (unauthenticated, share-token gated). Any data added to the public report must be added to this function's JSON response.
- Run `pnpm test`. `pnpm lint` is not a usable gate; lint only files you touched against a `git stash` baseline (this repo has ~230 pre-existing lint errors unrelated to any of this work — confirmed via `git stash` diff during the operator-friction-fixes session).
- Apply migrations via the Supabase MCP `apply_migration` tool (project `hkqiuwnppxkkztacwicj`), and deploy edge functions via `npx supabase functions deploy <name> --project-ref hkqiuwnppxkkztacwicj` (Docker is not available locally — this prints a harmless warning and still deploys via remote bundling).

---

## File Structure

**Created:**
| Path | Responsibility |
|---|---|
| `supabase/migrations/20260815000000_holdout_lift_testing.sql` | New columns, `lift_stats` view, `assign_holdout_control()` SQL function |
| `supabase/functions/assign-holdout-control/index.ts` | Verifies caller owns the campaign, calls the SQL function |
| `src/lib/liftTest.js` | Pure: two-proportion z-test + CI, verdict classification |
| `src/lib/liftTest.test.js` | Tests for the above |
| `src/components/shared/LiftTestPanel.jsx` | Renders a lift result or an honest empty state |
| `src/components/shared/LiftTestPanel.test.jsx` | Tests for the above |

**Modified:**
| Path | Change |
|---|---|
| `supabase/functions/display-feed/index.ts` | Exclude `is_control=true` `campaign_screens` rows from serving |
| `supabase/functions/charge-campaign/index.ts` | Exclude `is_control=true` screens from `distributeOperatorCuts` |
| `supabase/functions/campaign-report/index.ts` | Include `lift_stats` row (when `holdout_enabled`) in the public JSON response |
| `src/views/advertiser/createCampaign/StepTargeting.jsx` | Holdout toggle, gated on ≥10 matched screens |
| `src/views/advertiser/CreateCampaign.jsx` | `holdout_enabled` form field, call `assign-holdout-control` after screen insert |
| `src/views/operator/CampaignDetail.jsx` | New "Lift Test" tab, shown only when `c.holdout_enabled` |
| `src/views/public/CampaignReport.jsx` | Render `LiftTestPanel` when the report includes a `lift` object |

---

## Task 1: Schema, view, and assignment function

**Files:**
- Create: `supabase/migrations/20260815000000_holdout_lift_testing.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- Screen-level holdout / lift testing.
--
-- An advertiser with >=10 matched screens can opt a campaign into a holdout
-- test: ~20% of its campaign_screens rows are randomly flagged is_control.
-- Control screens still get a normal campaign_screens row (they go through
-- approval like any other targeted screen) but never serve the campaign's
-- creative (display-feed excludes them) and are never billed to an operator
-- (charge-campaign's payout step excludes them). This is what makes the
-- unbilled/unserved holdout possible without touching the advertiser's flat
-- `bookings.budget` figure at all.
--
-- Random assignment happens server-side, in assign_holdout_control() below,
-- called only via the assign-holdout-control edge function -- never
-- client-set. campaign_screens' own RLS lets an advertiser's INSERT set any
-- column on their own campaign's rows (see 20260605000001_campaign_targeting.sql),
-- so a client-chosen is_control would let an advertiser cherry-pick which
-- screens "lose," fabricating the lift number that later appears on their
-- own public report.
-- ============================================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS holdout_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.campaign_screens
  ADD COLUMN IF NOT EXISTS is_control boolean NOT NULL DEFAULT false;

-- SECURITY DEFINER: runs as the function owner (postgres), not the caller,
-- so it can UPDATE campaign_screens rows regardless of the caller's RLS
-- grants. Only ever invoked by the assign-holdout-control edge function,
-- which authenticates the caller and verifies campaign ownership BEFORE
-- calling this -- this function itself does not re-check ownership, by
-- design, the same trust boundary the edge function / SQL function split
-- uses elsewhere in this codebase (e.g. charge-campaign's internal-secret
-- pattern). Do not grant EXECUTE on this to `authenticated` -- only the
-- edge function's service-role client may call it.
CREATE OR REPLACE FUNCTION public.assign_holdout_control(p_campaign_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
  v_control_count integer;
BEGIN
  SELECT count(*) INTO v_total
  FROM public.campaign_screens
  WHERE campaign_id = p_campaign_id;

  IF v_total < 10 THEN
    RETURN 0;
  END IF;

  v_control_count := ceil(v_total * 0.2)::integer;

  UPDATE public.campaign_screens
  SET is_control = true
  WHERE id IN (
    SELECT id FROM public.campaign_screens
    WHERE campaign_id = p_campaign_id
    ORDER BY random()
    LIMIT v_control_count
  );

  RETURN v_control_count;
END;
$$;

-- Per-campaign scan-rate comparison between exposed and control screens.
-- Computed live (not materialized) -- this is a single-campaign filter over
-- campaign_delivery_daily, not a network-wide aggregate, so precomputation
-- isn't warranted at expected request volumes. Revisit if this becomes a
-- hot path.
--
-- Unlike benchmark_stats, this view IS per-campaign and DOES carry
-- campaign_id -- that's the point here (a campaign checking its own lift,
-- not a cross-advertiser aggregate), and RLS on the underlying
-- campaign_delivery_daily / campaign_screens tables already scopes what a
-- given caller can join against. security_invoker=true is safe and correct
-- here (unlike benchmark_stats, which deliberately could not use it --
-- see 20260726000010_benchmark_stats.sql).
CREATE OR REPLACE VIEW public.lift_stats
WITH (security_invoker = true) AS
SELECT
  d.campaign_id,
  cs.is_control,
  sum(d.impressions)      AS impressions,
  sum(d.billable_scans)   AS billable_scans
FROM public.campaign_delivery_daily d
JOIN public.campaign_screens cs
  ON cs.campaign_id = d.campaign_id AND cs.screen_id = d.screen_id
GROUP BY d.campaign_id, cs.is_control;

GRANT SELECT ON public.lift_stats TO authenticated, service_role;
```

- [ ] **Step 2: Apply via the Supabase MCP `apply_migration` (project `hkqiuwnppxkkztacwicj`, name `holdout_lift_testing`)**

- [ ] **Step 3: Verify the columns exist**

```sql
select column_name, data_type, column_default
from information_schema.columns
where (table_name = 'bookings' and column_name = 'holdout_enabled')
   or (table_name = 'campaign_screens' and column_name = 'is_control');
```
Expected: two rows, both `boolean`, both defaulting to `false`.

- [ ] **Step 4: Verify the view has no rows yet (no campaign has opted in)**

```sql
select count(*) from public.lift_stats;
```
Expected: `0` — no `bookings.holdout_enabled = true` campaigns exist yet, so `campaign_screens.is_control` is `false` everywhere, but the view still requires actual `campaign_delivery_daily` rows to produce output. Either way, `0` here is not itself a signal of success or failure — it's simply "no data yet," confirmed by the column check in Step 3 instead.

- [ ] **Step 5: Verify `assign_holdout_control` is not callable by `authenticated`**

```sql
select has_function_privilege('authenticated', 'public.assign_holdout_control(text)', 'EXECUTE') as authenticated_can_call;
```
Expected: `false`. If `true`, add `REVOKE EXECUTE ON FUNCTION public.assign_holdout_control(text) FROM authenticated;` to the migration and re-run Steps 2-5 — `SECURITY DEFINER` functions are `EXECUTE`-granted to `PUBLIC` by default in Postgres, which would let any authenticated user call this directly instead of through the edge function's ownership check.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260815000000_holdout_lift_testing.sql
git commit -m "feat: add holdout/lift-testing schema, assignment function, lift_stats view"
```

---

## Task 2: Lift comparison (pure)

**Files:**
- Create: `src/lib/liftTest.js`, `src/lib/liftTest.test.js`

- [ ] **Step 1: Write the failing test at `src/lib/liftTest.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { compareLift, MIN_IMPRESSIONS_PER_GROUP } from './liftTest.js';

describe('compareLift', () => {
  it('reports a significant lift when exposed clearly outperforms control', () => {
    // Exposed: 200/10000 = 2.0% scan rate. Control: 100/10000 = 1.0%.
    const r = compareLift(
      { impressions: 10000, billable_scans: 200 },
      { impressions: 10000, billable_scans: 100 },
    );
    expect(r.available).toBe(true);
    expect(r.significant).toBe(true);
    expect(r.exposedRate).toBeCloseTo(2.0, 5);
    expect(r.controlRate).toBeCloseTo(1.0, 5);
    expect(r.liftPct).toBeCloseTo(100, 1); // 2.0 vs 1.0 = +100%
    expect(r.ci95.low).toBeGreaterThan(0);
  });

  it('reports not significant when rates are close', () => {
    const r = compareLift(
      { impressions: 1000, billable_scans: 20 },
      { impressions: 1000, billable_scans: 19 },
    );
    expect(r.available).toBe(true);
    expect(r.significant).toBe(false);
  });

  it('reports unavailable when exposed has too few impressions', () => {
    const r = compareLift(
      { impressions: MIN_IMPRESSIONS_PER_GROUP - 1, billable_scans: 5 },
      { impressions: 10000, billable_scans: 100 },
    );
    expect(r.available).toBe(false);
    expect(r.reason).toBe('insufficient_sample');
  });

  it('reports unavailable when control has too few impressions', () => {
    const r = compareLift(
      { impressions: 10000, billable_scans: 100 },
      { impressions: MIN_IMPRESSIONS_PER_GROUP - 1, billable_scans: 5 },
    );
    expect(r.available).toBe(false);
    expect(r.reason).toBe('insufficient_sample');
  });

  it('reports unavailable when either group is missing entirely', () => {
    expect(compareLift(null, { impressions: 10000, billable_scans: 100 }).reason).toBe('no_data');
    expect(compareLift({ impressions: 10000, billable_scans: 100 }, null).reason).toBe('no_data');
    expect(compareLift(null, null).reason).toBe('no_data');
  });

  it('does not divide by zero when control rate is zero', () => {
    const r = compareLift(
      { impressions: 10000, billable_scans: 50 },
      { impressions: 10000, billable_scans: 0 },
    );
    expect(r.available).toBe(true);
    expect(r.liftPct).toBeNull();
  });

  it('enforces a minimum of at least 500 impressions per group', () => {
    expect(MIN_IMPRESSIONS_PER_GROUP).toBeGreaterThanOrEqual(500);
  });

  it('never claims significance from a tiny absolute scan count even with high rate', () => {
    // 3/500 = 0.6% vs 1/500 = 0.2% "looks" like 3x lift, but n is too small
    // to be significant at 95% -- the z-test itself must catch this, not
    // just the impressions floor.
    const r = compareLift(
      { impressions: 500, billable_scans: 3 },
      { impressions: 500, billable_scans: 1 },
    );
    expect(r.available).toBe(true);
    expect(r.significant).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/liftTest.test.js`
Expected: FAIL — cannot resolve `./liftTest.js`.

- [ ] **Step 3: Write `src/lib/liftTest.js`**

```js
// Comparing a campaign's exposed screens against its own held-out control
// screens. Every path fails to "unavailable" rather than to a number --
// the same discipline src/lib/benchmark.js uses. A "lift" computed from a
// handful of scans is worse than none: it can make a client-facing report
// claim a result that a slightly different day's data would contradict.

export const MIN_IMPRESSIONS_PER_GROUP = 500;

// Standard normal CDF via the Abramowitz & Stegun approximation -- good to
// ~7 decimal places, no external dependency needed for a two-proportion
// z-test's significance check.
function normalCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (z > 0) p = 1 - p;
  return p;
}

export function compareLift(exposed, control) {
  if (!exposed || !control) return { available: false, reason: 'no_data' };

  const exposedImpr = Number(exposed.impressions) || 0;
  const controlImpr = Number(control.impressions) || 0;
  if (exposedImpr < MIN_IMPRESSIONS_PER_GROUP || controlImpr < MIN_IMPRESSIONS_PER_GROUP) {
    return { available: false, reason: 'insufficient_sample' };
  }

  const exposedScans = Number(exposed.billable_scans) || 0;
  const controlScans = Number(control.billable_scans) || 0;

  const exposedRate = (exposedScans / exposedImpr) * 100;
  const controlRate = (controlScans / controlImpr) * 100;

  const liftPct = controlRate !== 0 ? ((exposedRate - controlRate) / controlRate) * 100 : null;

  // Two-proportion z-test (pooled), standard Wald-style approach.
  const p1 = exposedScans / exposedImpr;
  const p2 = controlScans / controlImpr;
  const pPooled = (exposedScans + controlScans) / (exposedImpr + controlImpr);
  const se = Math.sqrt(pPooled * (1 - pPooled) * (1 / exposedImpr + 1 / controlImpr));

  let significant = false;
  let pValue = null;
  if (se > 0) {
    const z = (p1 - p2) / se;
    pValue = 2 * (1 - normalCdf(Math.abs(z)));
    significant = pValue < 0.05;
  }

  // 95% CI on the difference in proportions (unpooled SE, the standard
  // choice for a confidence interval on the difference itself), expressed
  // as percentage points to match exposedRate/controlRate's units.
  const seDiff = Math.sqrt((p1 * (1 - p1)) / exposedImpr + (p2 * (1 - p2)) / controlImpr);
  const diff = p1 - p2;
  const ci95 = {
    low: (diff - 1.96 * seDiff) * 100,
    high: (diff + 1.96 * seDiff) * 100,
  };

  return {
    available: true,
    reason: null,
    exposedRate,
    controlRate,
    liftPct,
    significant,
    pValue,
    ci95,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/liftTest.test.js`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/liftTest.js src/lib/liftTest.test.js
git commit -m "feat: add two-proportion lift comparison for holdout tests"
```

---

## Task 3: `assign-holdout-control` edge function

**Files:**
- Create: `supabase/functions/assign-holdout-control/index.ts`

- [ ] **Step 1: Write the function**

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Content-Type": "application/json",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401, headers: CORS });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return new Response("Unauthorized", { status: 401, headers: CORS });

  const { campaign_id } = await req.json().catch(() => ({}));
  if (!campaign_id || typeof campaign_id !== "string") {
    return new Response(JSON.stringify({ error: "campaign_id is required" }), { status: 400, headers: CORS });
  }

  // Ownership check before the privileged RPC call -- the SQL function
  // itself does not re-verify this (see the migration's comment on
  // assign_holdout_control), so this check IS the security boundary.
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, advertiser_id, holdout_enabled")
    .eq("id", campaign_id)
    .single();

  if (!booking || booking.advertiser_id !== user.id) {
    return new Response(JSON.stringify({ error: "Campaign not found" }), { status: 404, headers: CORS });
  }

  if (!booking.holdout_enabled) {
    return new Response(JSON.stringify({ error: "This campaign did not opt into a holdout test" }), { status: 400, headers: CORS });
  }

  const { data: controlCount, error: rpcError } = await supabase.rpc("assign_holdout_control", {
    p_campaign_id: campaign_id,
  });

  if (rpcError) {
    return new Response(JSON.stringify({ error: rpcError.message }), { status: 500, headers: CORS });
  }

  return new Response(JSON.stringify({ ok: true, control_count: controlCount }), { headers: CORS });
});
```

- [ ] **Step 2: Deploy**

Run: `npx supabase functions deploy assign-holdout-control --project-ref hkqiuwnppxkkztacwicj`
Expected: `"Deployed Functions."` in the JSON output, function `"assign-holdout-control"` listed.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/assign-holdout-control/index.ts
git commit -m "feat: add assign-holdout-control edge function"
```

---

## Task 4: Exclude control screens from serving and payout

**Files:**
- Modify: `supabase/functions/display-feed/index.ts`
- Modify: `supabase/functions/charge-campaign/index.ts`

- [ ] **Step 1: Exclude control screens from `display-feed`'s served-campaigns query**

In `supabase/functions/display-feed/index.ts`, find this block (currently around line 65):

```ts
  const { data: csRows } = await supabase
    .from("campaign_screens")
    .select("campaign_id, status, headline, cta_text, accent_color, destination_url, media_url, media_type")
    .eq("screen_id", screen.id)
    .in("status", ["approved", "auto_approved"]);
```

Change it to:

```ts
  const { data: csRows } = await supabase
    .from("campaign_screens")
    .select("campaign_id, status, headline, cta_text, accent_color, destination_url, media_url, media_type")
    .eq("screen_id", screen.id)
    .eq("is_control", false)
    .in("status", ["approved", "auto_approved"]);
```

- [ ] **Step 2: Exclude control screens from `charge-campaign`'s operator payout**

In `supabase/functions/charge-campaign/index.ts`, find this block inside `distributeOperatorCuts` (currently around line 38):

```ts
  const { data: csRows } = await supabase
    .from("campaign_screens")
    .select("screen_id")
    .eq("campaign_id", bookingId);
```

Change it to:

```ts
  // Control screens (holdout test) never served this campaign's creative --
  // an operator should not be paid for a screen that showed nothing.
  const { data: csRows } = await supabase
    .from("campaign_screens")
    .select("screen_id")
    .eq("campaign_id", bookingId)
    .eq("is_control", false);
```

- [ ] **Step 3: Deploy both**

Run:
```bash
npx supabase functions deploy display-feed --project-ref hkqiuwnppxkkztacwicj
npx supabase functions deploy charge-campaign --project-ref hkqiuwnppxkkztacwicj
```
Expected: both print `"Deployed Functions."`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/display-feed/index.ts supabase/functions/charge-campaign/index.ts
git commit -m "fix: exclude holdout control screens from serving and operator payout"
```

---

## Task 5: `LiftTestPanel` component

**Files:**
- Create: `src/components/shared/LiftTestPanel.jsx`, `src/components/shared/LiftTestPanel.test.jsx`

- [ ] **Step 1: Write the failing test at `src/components/shared/LiftTestPanel.test.jsx`**

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiftTestPanel } from './LiftTestPanel.jsx';

describe('LiftTestPanel', () => {
  it('renders nothing when the campaign did not opt into a holdout test', () => {
    const { container } = render(<LiftTestPanel holdoutEnabled={false} exposed={null} control={null} />);
    expect(container.textContent).toBe('');
  });

  it('says data is still being collected when the sample is too small', () => {
    render(<LiftTestPanel
      holdoutEnabled={true}
      exposed={{ impressions: 10, billable_scans: 1 }}
      control={{ impressions: 10, billable_scans: 0 }}
    />);
    expect(screen.getByText(/still collecting data/i)).toBeInTheDocument();
  });

  it('says data is still being collected when there is no delivery yet at all', () => {
    render(<LiftTestPanel holdoutEnabled={true} exposed={null} control={null} />);
    expect(screen.getByText(/still collecting data/i)).toBeInTheDocument();
  });

  it('reports a significant lift with the rate and CI', () => {
    render(<LiftTestPanel
      holdoutEnabled={true}
      exposed={{ impressions: 10000, billable_scans: 200 }}
      control={{ impressions: 10000, billable_scans: 100 }}
    />);
    expect(screen.getByText(/statistically significant/i)).toBeInTheDocument();
    expect(screen.getByText(/2\.00%/)).toBeInTheDocument();
    expect(screen.getByText(/1\.00%/)).toBeInTheDocument();
  });

  it('reports no significant difference when rates are close', () => {
    render(<LiftTestPanel
      holdoutEnabled={true}
      exposed={{ impressions: 1000, billable_scans: 20 }}
      control={{ impressions: 1000, billable_scans: 19 }}
    />);
    expect(screen.getByText(/no significant difference/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/shared/LiftTestPanel.test.jsx`
Expected: FAIL — cannot resolve `./LiftTestPanel.jsx`.

- [ ] **Step 3: Write `src/components/shared/LiftTestPanel.jsx`**

```jsx
import { C, F } from '../../design/tokens.js';
import { compareLift } from '../../lib/liftTest.js';

// Renders nothing at all when the campaign never opted into a holdout
// test, says so plainly when there isn't enough data yet, and never claims
// a lift number it can't stand behind -- same discipline as BenchmarkRow.
export function LiftTestPanel({ holdoutEnabled, exposed, control }) {
  if (!holdoutEnabled) return null;

  const result = compareLift(exposed, control);

  if (!result.available) {
    return (
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
        padding: '16px 20px', fontFamily: F.sans,
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>Lift Test</div>
        <div style={{ fontSize: 13, color: C.textMuted }}>
          Still collecting data for this lift test.
        </div>
      </div>
    );
  }

  const { exposedRate, controlRate, liftPct, significant, ci95 } = result;

  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
      padding: '16px 20px', fontFamily: F.sans,
    }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 10 }}>Lift Test</div>
      <div style={{ display: 'flex', gap: 24, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: C.textMuted }}>Exposed scan rate</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: F.mono }}>{exposedRate.toFixed(2)}%</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.textMuted }}>Control scan rate</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: F.mono }}>{controlRate.toFixed(2)}%</div>
        </div>
      </div>
      <div style={{
        fontSize: 13, fontWeight: 500,
        color: significant ? C.green : C.textSub,
      }}>
        {significant
          ? `Statistically significant lift: ${liftPct !== null ? `${liftPct >= 0 ? '+' : ''}${liftPct.toFixed(1)}%` : 'n/a'} (95% CI: [${ci95.low.toFixed(2)}, ${ci95.high.toFixed(2)}] pts)`
          : 'No significant difference detected between exposed and control screens yet.'}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/shared/LiftTestPanel.test.jsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/LiftTestPanel.jsx src/components/shared/LiftTestPanel.test.jsx
git commit -m "feat: add LiftTestPanel with honest empty state"
```

---

## Task 6: Wizard — holdout toggle and control assignment

**Files:**
- Modify: `src/views/advertiser/createCampaign/StepTargeting.jsx`
- Modify: `src/views/advertiser/CreateCampaign.jsx`

- [ ] **Step 1: Add the toggle to `StepTargeting.jsx`**

Change the function signature (currently `src/views/advertiser/createCampaign/StepTargeting.jsx:15`):

```jsx
export function StepTargeting({ form, setForm, reachSummary, allScreens, onPrevCampaigns, existingCampaign = null }) {
```

to:

```jsx
export function StepTargeting({ form, setForm, reachSummary, matchedScreenCount, allScreens, onPrevCampaigns, existingCampaign = null }) {
```

Find the `reachSummary` block (currently lines 194-198):

```jsx
        {reachSummary && (
          <div style={{ marginTop: 16, padding: '10px 14px', background: C.purpleSoft, borderRadius: 8, fontSize: 13, color: C.purple, fontFamily: F.sans }}>
            {reachSummary}
          </div>
        )}
```

Add a holdout toggle immediately after it:

```jsx
        {reachSummary && (
          <div style={{ marginTop: 16, padding: '10px 14px', background: C.purpleSoft, borderRadius: 8, fontSize: 13, color: C.purple, fontFamily: F.sans }}>
            {reachSummary}
          </div>
        )}

        {matchedScreenCount >= 10 && (
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 12,
            padding: '10px 14px', border: `1px solid ${C.border}`, borderRadius: 8, cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={form.holdout_enabled}
              onChange={e => setForm(s => ({ ...s, holdout_enabled: e.target.checked }))}
              style={{ marginTop: 2 }}
            />
            <span style={{ fontSize: 13, color: C.text, fontFamily: F.sans }}>
              <strong>Run a holdout test</strong> — we'll randomly hold back ~20% of screens as a control
              group to measure whether this campaign actually drives scans, at no extra cost (control
              screens aren't billed).
            </span>
          </label>
        )}
```

- [ ] **Step 2: Pass `matchedScreenCount` from `CreateCampaign.jsx` and add `holdout_enabled` to form state**

In `src/views/advertiser/CreateCampaign.jsx`, find the initial `form` state (currently lines 82-106) and add a field after `start_when: 'partial',` (the last field, currently line 105):

```jsx
    start_when: 'partial',
    holdout_enabled: false,
  });
```

Find where `StepTargeting` is rendered (currently `src/views/advertiser/CreateCampaign.jsx:498`):

```jsx
      {step === 0 && <StepTargeting form={form} setForm={setForm} reachSummary={reachSummary} allScreens={dbScreens} onPrevCampaigns={campaigns.length > 0 ? () => setShowDupModal(true) : null} existingCampaign={existingCampaign} />}
```

Change it to:

```jsx
      {step === 0 && <StepTargeting form={form} setForm={setForm} reachSummary={reachSummary} matchedScreenCount={matchedScreens.length} allScreens={dbScreens} onPrevCampaigns={campaigns.length > 0 ? () => setShowDupModal(true) : null} existingCampaign={existingCampaign} />}
```

- [ ] **Step 3: Include `holdout_enabled` in the `bookings` insert and call `assign-holdout-control` after screens are inserted**

Find the `bookings` insert (currently `src/views/advertiser/CreateCampaign.jsx:270-303`) and add the field right after `start_when: form.start_when,` (currently line 289):

```jsx
        start_when:            form.start_when,
        holdout_enabled:       form.holdout_enabled,
```

Find the screen-insert block right after it (currently lines 306-312):

```jsx
      const screenRows = form.selected_screen_ids.map(screen_id => ({
        campaign_id: campaignId,
        screen_id,
        status: matchedScreens.find(s => s.id === screen_id)?.auto_approve ? 'auto_approved' : 'pending',
      }));
      const { error: screenErr } = await supabase.from('campaign_screens').insert(screenRows);
      if (screenErr) throw new Error(screenErr.message);
```

Add the holdout-assignment call immediately after it:

```jsx
      const screenRows = form.selected_screen_ids.map(screen_id => ({
        campaign_id: campaignId,
        screen_id,
        status: matchedScreens.find(s => s.id === screen_id)?.auto_approve ? 'auto_approved' : 'pending',
      }));
      const { error: screenErr } = await supabase.from('campaign_screens').insert(screenRows);
      if (screenErr) throw new Error(screenErr.message);

      // Control-screen assignment is server-computed (never client-set --
      // see the migration's comment on assign_holdout_control). A failure
      // here does not roll back the campaign; it just means the holdout
      // test won't have a control group, which the Lift Test panel's
      // "still collecting data" state covers gracefully either way.
      if (form.holdout_enabled) {
        const { data: { session: holdoutSession } } = await supabase.auth.getSession();
        if (holdoutSession) {
          await fetch(`${SUPABASE_FUNCTIONS_URL}/assign-holdout-control`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${holdoutSession.access_token}` },
            body: JSON.stringify({ campaign_id: campaignId }),
          }).catch(() => {});
        }
      }
```

- [ ] **Step 4: Run the existing wizard test suite to confirm nothing broke**

Run: `npx vitest run src/views/advertiser`
Expected: all existing tests still pass (no test in this suite exercises `holdout_enabled` yet — this step is a regression check, not new coverage).

- [ ] **Step 5: Lint the changed files against baseline**

Run:
```bash
git stash
npx eslint src/views/advertiser/createCampaign/StepTargeting.jsx src/views/advertiser/CreateCampaign.jsx > /tmp/lint-before.txt 2>&1
git stash pop
npx eslint src/views/advertiser/createCampaign/StepTargeting.jsx src/views/advertiser/CreateCampaign.jsx > /tmp/lint-after.txt 2>&1
diff /tmp/lint-before.txt /tmp/lint-after.txt
```
Expected: no new lines in the diff (any pre-existing errors are unchanged; no new ones introduced).

- [ ] **Step 6: Commit**

```bash
git add src/views/advertiser/createCampaign/StepTargeting.jsx src/views/advertiser/CreateCampaign.jsx
git commit -m "feat: add holdout-test toggle to campaign wizard"
```

---

## Task 7: Private results — `CampaignDetail` tab

**Files:**
- Modify: `src/views/operator/CampaignDetail.jsx`

- [ ] **Step 1: Fetch lift_stats when the campaign has holdout enabled**

Add near the top of the component, after the existing `useState` declarations (currently around `src/views/operator/CampaignDetail.jsx:29`, right after `const [creativeForm, setCreativeForm] = useState({ accent_color: campaign.color ?? '#7c3aed' });`):

```jsx
  const [liftExposed, setLiftExposed] = useState(null);
  const [liftControl, setLiftControl] = useState(null);

  useEffect(() => {
    if (!c.holdout_enabled) return;
    supabase
      .from('lift_stats')
      .select('is_control, impressions, billable_scans')
      .eq('campaign_id', c.id)
      .then(({ data }) => {
        const exposedRow = (data ?? []).find(r => r.is_control === false);
        const controlRow = (data ?? []).find(r => r.is_control === true);
        setLiftExposed(exposedRow ?? null);
        setLiftControl(controlRow ?? null);
      });
  }, [c.id, c.holdout_enabled]);
```

Add `useEffect` to the existing `import { useState } from 'react';` line (currently `src/views/operator/CampaignDetail.jsx:1`):

```jsx
import { useState, useEffect } from 'react';
```

Add the import for `LiftTestPanel` alongside the other component imports (currently around line 15, after `import { CreativePreview } from '../../components/shared/CreativePreview.jsx';`):

```jsx
import { LiftTestPanel } from '../../components/shared/LiftTestPanel.jsx';
```

- [ ] **Step 2: Add the tab, conditionally**

Find the `Tabs` line (currently `src/views/operator/CampaignDetail.jsx:150`):

```jsx
      <Tabs tabs={[{ id: 'overview', label: 'Performance' }, { id: 'creative', label: 'Creative' }, { id: 'settings', label: 'Settings' }]} active={tab} onChange={setTab} />
```

Change it to:

```jsx
      <Tabs tabs={[
        { id: 'overview', label: 'Performance' },
        { id: 'creative', label: 'Creative' },
        ...(c.holdout_enabled ? [{ id: 'lift', label: 'Lift Test' }] : []),
        { id: 'settings', label: 'Settings' },
      ]} active={tab} onChange={setTab} />
```

Find the `{tab === 'creative' && (...)}`  block's closing (currently ends around line 226, right before `{tab === 'settings' && (`). Add the new tab's content right after the creative block's closing `)}`:

```jsx
      {tab === 'lift' && (
        <LiftTestPanel holdoutEnabled={c.holdout_enabled} exposed={liftExposed} control={liftControl} />
      )}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/views/operator/CampaignDetail.onApprovalChange.test.jsx`
Expected: PASS — confirms the `useState`/`useEffect` addition didn't break the existing component's rendering path.

- [ ] **Step 4: Lint against baseline**

Run:
```bash
git stash
npx eslint src/views/operator/CampaignDetail.jsx > /tmp/lint-before.txt 2>&1
git stash pop
npx eslint src/views/operator/CampaignDetail.jsx > /tmp/lint-after.txt 2>&1
diff /tmp/lint-before.txt /tmp/lint-after.txt
```
Expected: no new lines in the diff.

- [ ] **Step 5: Commit**

```bash
git add src/views/operator/CampaignDetail.jsx
git commit -m "feat: surface lift test results on CampaignDetail"
```

---

## Task 8: Public results — `campaign-report` and `CampaignReport.jsx`

**Files:**
- Modify: `supabase/functions/campaign-report/index.ts`
- Modify: `src/views/public/CampaignReport.jsx`

- [ ] **Step 1: Include lift data in the edge function's response**

In `supabase/functions/campaign-report/index.ts`, find the `bookings` select (currently around line 41):

```ts
  const { data: campaign } = await supabase
    .from("bookings")
    .select("id, campaign_name, advertiser_name, category, start_date, end_date, currency")
    .eq("id", campaignId)
    .single();
```

Change it to also select `holdout_enabled`:

```ts
  const { data: campaign } = await supabase
    .from("bookings")
    .select("id, campaign_name, advertiser_name, category, start_date, end_date, currency, holdout_enabled")
    .eq("id", campaignId)
    .single();
```

Find the `health` query right after it (currently around line 55) and add a lift query after it:

```ts
  const { data: health } = await supabase
    .from("campaign_delivery_health")
    .select("expected_plays, delivered_plays, delivery_pct, offline_days")
    .eq("campaign_id", campaignId)
    .maybeSingle();

  let lift = null;
  if (campaign?.holdout_enabled) {
    const { data: liftRows } = await supabase
      .from("lift_stats")
      .select("is_control, impressions, billable_scans")
      .eq("campaign_id", campaignId);
    const exposedRow = (liftRows ?? []).find((r) => r.is_control === false) ?? null;
    const controlRow = (liftRows ?? []).find((r) => r.is_control === true) ?? null;
    lift = { exposed: exposedRow, control: controlRow };
  }
```

Find the final `Response` body (currently around line 78):

```ts
  return new Response(JSON.stringify({
    campaign: {
      name: campaign?.campaign_name ?? campaign?.advertiser_name ?? campaignId,
      category: campaign?.category ?? null,
      start_date: campaign?.start_date ?? null,
      end_date: campaign?.end_date ?? null,
      currency: campaign?.currency ?? null,
    },
    totals,
    daily: rows,
    health: health ?? null,
  }), { headers: CORS });
```

Add `lift` to it:

```ts
  return new Response(JSON.stringify({
    campaign: {
      name: campaign?.campaign_name ?? campaign?.advertiser_name ?? campaignId,
      category: campaign?.category ?? null,
      start_date: campaign?.start_date ?? null,
      end_date: campaign?.end_date ?? null,
      currency: campaign?.currency ?? null,
    },
    totals,
    daily: rows,
    health: health ?? null,
    lift,
  }), { headers: CORS });
```

- [ ] **Step 2: Deploy**

Run: `npx supabase functions deploy campaign-report --project-ref hkqiuwnppxkkztacwicj`
Expected: `"Deployed Functions."` in the output.

- [ ] **Step 3: Render the panel in `CampaignReport.jsx`**

Add the import (currently `src/views/public/CampaignReport.jsx:1-4`):

```jsx
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { C, F } from '../../design/tokens.js';
import { downloadCsv } from '../../lib/csv.js';
import { LiftTestPanel } from '../../components/shared/LiftTestPanel.jsx';
import './CampaignReport.css';
```

Find where `report` is destructured (currently `src/views/public/CampaignReport.jsx:52`):

```jsx
  const { campaign, totals, daily, health } = report;
```

Change it to:

```jsx
  const { campaign, totals, daily, health, lift } = report;
```

Find the health block (currently lines 84-89):

```jsx
      {health?.delivery_pct != null && (
        <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, marginBottom: 28 }}>
          Delivery health: <strong style={{ color: C.text }}>{Number(health.delivery_pct).toFixed(1)}%</strong> of scheduled plays confirmed
          {Number(health.offline_days) > 0 && ` · ${health.offline_days} day(s) a screen was offline`}
        </div>
      )}
```

Add the lift panel right after it:

```jsx
      {health?.delivery_pct != null && (
        <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, marginBottom: 28 }}>
          Delivery health: <strong style={{ color: C.text }}>{Number(health.delivery_pct).toFixed(1)}%</strong> of scheduled plays confirmed
          {Number(health.offline_days) > 0 && ` · ${health.offline_days} day(s) a screen was offline`}
        </div>
      )}

      {lift && (
        <div style={{ marginBottom: 28 }}>
          {/* The public report never sends holdout_enabled directly (see
              campaign-report/index.ts) -- `lift` is only present at all when
              it's true, so its presence alone is the signal here. */}
          <LiftTestPanel holdoutEnabled={true} exposed={lift.exposed} control={lift.control} />
        </div>
      )}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/views/public 2>&1 || echo "no test file yet for CampaignReport — expected, none existed before this change either"`
Expected: no regressions (there is no pre-existing `CampaignReport.test.jsx` in this codebase — this step is a sanity check that the directory still imports cleanly, not new coverage).

- [ ] **Step 5: Lint against baseline**

Run:
```bash
git stash
npx eslint supabase/functions/campaign-report/index.ts src/views/public/CampaignReport.jsx > /tmp/lint-before.txt 2>&1
git stash pop
npx eslint supabase/functions/campaign-report/index.ts src/views/public/CampaignReport.jsx > /tmp/lint-after.txt 2>&1
diff /tmp/lint-before.txt /tmp/lint-after.txt
```
Expected: no new lines in the diff.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/campaign-report/index.ts src/views/public/CampaignReport.jsx
git commit -m "feat: surface lift test results on the public campaign report"
```

---

## Task 9: Full verification pass

- [ ] **Step 1: Full test suite**

Run: `npx vitest run`
Expected: all pass, including the 8 new `liftTest` tests and 5 new `LiftTestPanel` tests (baseline was 612 before this plan; expect 625).

- [ ] **Step 2: Build**

Run: `npx vite build`
Expected: exits 0.

- [ ] **Step 3: Verify no group leak in `lift_stats`**

```sql
select column_name from information_schema.columns where table_name = 'lift_stats';
```
Expected: `campaign_id, is_control, impressions, billable_scans`. This view is intentionally per-campaign (unlike `benchmark_stats`) — `campaign_id` here is correct, not a leak, since a campaign checking its own lift is exactly the point.

- [ ] **Step 4: Verify `assign_holdout_control` is still not directly callable by `authenticated`**

```sql
select has_function_privilege('authenticated', 'public.assign_holdout_control(text)', 'EXECUTE') as authenticated_can_call;
```
Expected: `false`.

- [ ] **Step 5: Confirm all 6 edge functions are deployed and ACTIVE**

```bash
npx supabase functions list --project-ref hkqiuwnppxkkztacwicj 2>&1 | grep -oE '"slug":"(assign-holdout-control|display-feed|charge-campaign|campaign-report)"'
```
Expected: all four slugs present (display-feed, charge-campaign, campaign-report were modified; assign-holdout-control is new — the other functions in this plan, StepTargeting/CreateCampaign/CampaignDetail/CampaignReport, are frontend and ship via the normal Vercel deploy on push to `main`, not a separate function deploy).

- [ ] **Step 6: Commit final state if any verification step required a fix**

```bash
git add -A
git commit -m "test: holdout/lift-testing verification pass"
```
(Skip this step if Steps 1-5 required no changes.)

---

## Acceptance criteria

- A campaign with <10 matched screens never shows the holdout toggle.
- A campaign with the toggle enabled ends up with ~20% of its `campaign_screens` rows flagged `is_control = true`, assigned server-side (never client-computed).
- Control screens appear in the campaign's screen list and approval queue like any other targeted screen, but never receive that campaign's creative from `display-feed`, and are excluded from `charge-campaign`'s operator-payout calculation.
- `LiftTestPanel` renders nothing for a non-holdout campaign, "still collecting data" below the impressions floor, and a plain-English significant/not-significant verdict above it — never a raw number it can't stand behind.
- The same panel, with the same states, is reachable both privately (`CampaignDetail`'s Lift Test tab) and publicly (`CampaignReport`, via the share-token-gated `campaign-report` function).
- `assign_holdout_control` is not directly callable by any authenticated user — only via the ownership-checked edge function.
