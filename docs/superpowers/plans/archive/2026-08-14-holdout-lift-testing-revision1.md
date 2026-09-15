# Screen-Level Holdout / Delivery-Check — Revision 1 Delta Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken scan-rate lift comparison with the "delivery-check" metric from `docs/superpowers/specs/2026-08-14-holdout-lift-testing-design.md`'s Revision 1: exposed screens' actual delivered rate (people/min, from real measured plays) vs. control screens' ambient audience rate (people/min, from CV camera data that doesn't require the ad to play), restricted to the campaign's own schedule window.

**Architecture:** This is a delta on top of an already-implemented, already-reviewed 9-task plan (`docs/superpowers/plans/2026-08-14-holdout-lift-testing.md`, all 9 tasks committed on this branch). Everything about *assignment* (schema, `assign_holdout_control`, the edge function, serving/payout exclusion, the wizard toggle mechanics) is correct and unchanged — this plan only replaces the *measurement* layer: one SQL view, one pure JS module, one React component, and the two call sites that wire them in.

**Tech Stack:** Supabase Postgres (view), Deno edge functions, React 19 (JS), vitest.

**Depends on:** All 9 tasks of `docs/superpowers/plans/2026-08-14-holdout-lift-testing.md` (already committed on `worktree-holdout-lift-testing` as of commit `dbda8ee`), and `screen_audience_index` (materialized view, migration `20260724000001_screen_audience_index.sql`).

---

## Context an engineer needs before starting

**Verified against production on 2026-08-14.**

- **Why the original metric is broken:** `display-feed` excludes `is_control=true` screens from serving a campaign (by design — see the original plan's Task 4). A screen that never serves a campaign never gets an `ad_plays` row for it, so `campaign_delivery_daily` (built entirely `FROM public.ad_plays`) never has a row for `(that campaign, that control screen)`. The original `lift_stats` view joined `campaign_delivery_daily` to `campaign_screens`, so it could structurally never produce an `is_control=true` row — the control side of the comparison was always empty, for every campaign, permanently.
- **The fix:** `screen_audience_index` (materialized view, columns `screen_id, dow, hour, people_per_min, avg_dwell_s, avg_attention, sample_windows`) is built from `impression_events` — the CV camera's raw ambient people-counting, independent of what plays on the screen. This is the one signal that exists for control screens too.
- **`screen_audience_index` has no RLS** (it's a materialized view; `relrowsecurity = false`), and its migration grants `SELECT` broadly to `authenticated` — any authenticated user can already read any screen's ambient audience index directly today. The new `delivery_check_stats` view joining it doesn't expose anything not already broadly readable; the campaign-specific parts of the join (`campaign_delivery_daily`, `campaign_screens`, `bookings`) remain properly RLS-scoped via `security_invoker = true`, exactly as the original (now-replaced) `lift_stats` view was.
- **`bookings` schedule columns:** `duration` is `integer` seconds (the campaign's per-play ad duration — same field `clampDurationToScreen` in `supabase/functions/_shared/adDuration.ts` clamps against a screen's `max_ad_duration`). `schedule_days` is `text[]` of `'Sun'|'Mon'|'Tue'|'Wed'|'Thu'|'Fri'|'Sat'` (matches `display-feed`'s own `dayNames` mapping — Sunday=0 through Saturday=6, the same convention Postgres's `EXTRACT(dow FROM ...)` uses). `time_start`/`time_end` are `text` in `'HH:MM'` format (castable directly to Postgres `time`).
- **Known scope limitation, deliberately accepted (not a bug to fix in this task):** the SQL below computes an hour window via `BETWEEN start_hour AND end_hour`, which does not correctly handle an overnight schedule (e.g. `time_start='22:00', time_end='02:00'`). Overnight-scheduled campaigns will get an incomplete/empty control window. This is an accepted v1 limitation — the vast majority of DOOH campaigns run within a single day's hours — not something to silently work around with more complex SQL in this delta.
- Run `pnpm test`. `pnpm lint` is not a usable gate; lint only files you touched against a `git stash` baseline.
- Apply migrations via the Supabase MCP `apply_migration` tool (project `hkqiuwnppxkkztacwicj`), deploy edge functions via `npx supabase functions deploy <name> --project-ref hkqiuwnppxkkztacwicj` (Docker isn't running locally — harmless warning, still deploys via remote bundling).

---

## File Structure

**Created:**
| Path | Responsibility |
|---|---|
| `supabase/migrations/20260816000000_delivery_check_stats.sql` | Drops `lift_stats`, creates `delivery_check_stats` view |
| `src/lib/deliveryCheck.js` | Pure: compare exposed actual rate vs. control ambient rate |
| `src/lib/deliveryCheck.test.js` | Tests for the above |
| `src/components/shared/DeliveryCheckPanel.jsx` | Renders the comparison or an honest empty state |
| `src/components/shared/DeliveryCheckPanel.test.jsx` | Tests for the above |

**Deleted:**
| Path | Reason |
|---|---|
| `src/lib/liftTest.js`, `src/lib/liftTest.test.js` | Replaced by `deliveryCheck.js` — the two-proportion z-test math is wrong for this feature (scan rate can never have control-side data) |
| `src/components/shared/LiftTestPanel.jsx`, `.test.jsx` | Replaced by `DeliveryCheckPanel.jsx` |

**Modified:**
| Path | Change |
|---|---|
| `src/views/operator/CampaignDetail.jsx` | Swap `LiftTestPanel`/`liftExposed`/`liftControl` → `DeliveryCheckPanel`/new state, query `delivery_check_stats` instead of `lift_stats`, tab label "Lift Test" → "Delivery Check" |
| `supabase/functions/campaign-report/index.ts` | Query `delivery_check_stats` instead of `lift_stats`, response key stays `lift` → rename to `deliveryCheck` for clarity |
| `src/views/public/CampaignReport.jsx` | Swap to `DeliveryCheckPanel`, destructure `deliveryCheck` instead of `lift` |
| `src/views/advertiser/createCampaign/StepTargeting.jsx` | Update toggle copy: "measure whether this campaign actually drives scans" → "measure whether delivery matched the audience" (the mechanism/gating is unchanged, only the claim in the copy needs to match the new metric) |

---

## Task A: `delivery_check_stats` view

**Files:**
- Create: `supabase/migrations/20260816000000_delivery_check_stats.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- Replaces lift_stats (see 20260815000000_holdout_lift_testing.sql).
--
-- lift_stats compared scan rates between exposed and control screens, but
-- control screens are excluded from serving (display-feed) by design, so
-- they never generate ad_plays / campaign_delivery_daily rows -- the
-- control side of that comparison was structurally always empty. See
-- Revision 1 in docs/superpowers/specs/2026-08-14-holdout-lift-testing-design.md.
--
-- This view compares exposed screens' ACTUAL delivered rate (measured
-- plays, from campaign_delivery_daily) against control screens' AMBIENT
-- audience rate (screen_audience_index, generated by the CV camera
-- regardless of what plays -- the only signal that exists for a screen
-- that never served this campaign), both expressed in people-per-minute
-- so they're directly comparable. Restricted to the campaign's own
-- schedule_days/time_start/time_end window so it's a fair comparison
-- against the same time-of-week the exposed screens actually played.
--
-- Known limitation: the hour-window filter below does not handle an
-- overnight schedule (time_start > time_end) -- accepted v1 scope, see
-- the plan's Context section.
-- ============================================================

DROP VIEW IF EXISTS public.lift_stats;

CREATE OR REPLACE VIEW public.delivery_check_stats
WITH (security_invoker = true) AS
WITH day_map(day_name, dow) AS (
  VALUES ('Sun',0),('Mon',1),('Tue',2),('Wed',3),('Thu',4),('Fri',5),('Sat',6)
),
exposed AS (
  SELECT
    d.campaign_id,
    sum(d.impressions)                                    AS exposed_impressions,
    sum(d.completed_plays * b.duration) / 60.0             AS exposed_play_minutes
  FROM public.campaign_delivery_daily d
  JOIN public.campaign_screens cs
    ON cs.campaign_id = d.campaign_id AND cs.screen_id = d.screen_id AND cs.is_control = false
  JOIN public.bookings b ON b.id = d.campaign_id
  GROUP BY d.campaign_id
),
control_windows AS (
  SELECT
    b.id AS campaign_id,
    dm.dow,
    extract(hour FROM b.time_start::time)::int AS start_hour,
    extract(hour FROM b.time_end::time)::int   AS end_hour
  FROM public.bookings b
  CROSS JOIN LATERAL unnest(b.schedule_days) AS sd(day_name)
  JOIN day_map dm ON dm.day_name = sd.day_name
  WHERE b.holdout_enabled = true
),
control AS (
  SELECT
    cw.campaign_id,
    avg(ai.people_per_min) AS control_people_per_min
  FROM control_windows cw
  JOIN public.campaign_screens cs
    ON cs.campaign_id = cw.campaign_id AND cs.is_control = true
  JOIN public.screen_audience_index ai
    ON ai.screen_id = cs.screen_id
   AND ai.dow = cw.dow
   AND ai.hour BETWEEN cw.start_hour AND cw.end_hour
  GROUP BY cw.campaign_id
)
SELECT
  coalesce(exposed.campaign_id, control.campaign_id)        AS campaign_id,
  exposed.exposed_impressions,
  exposed.exposed_play_minutes,
  CASE WHEN exposed.exposed_play_minutes > 0
       THEN exposed.exposed_impressions / exposed.exposed_play_minutes
       ELSE NULL END                                        AS exposed_rate,
  control.control_people_per_min                             AS control_rate
FROM exposed
FULL OUTER JOIN control ON control.campaign_id = exposed.campaign_id;

GRANT SELECT ON public.delivery_check_stats TO authenticated, service_role;
```

- [ ] **Step 2: Apply via the Supabase MCP `apply_migration` (project `hkqiuwnppxkkztacwicj`, name `delivery_check_stats`)**

- [ ] **Step 3: Verify `lift_stats` is gone and `delivery_check_stats` exists with the right columns**

```sql
select table_name from information_schema.tables where table_name = 'lift_stats';
```
Expected: no rows.

```sql
select column_name from information_schema.columns where table_name = 'delivery_check_stats';
```
Expected: `campaign_id, exposed_impressions, exposed_play_minutes, exposed_rate, control_rate`.

- [ ] **Step 4: Verify the view returns no rows (no campaign has real delivery data against this new shape yet)**

```sql
select count(*) from public.delivery_check_stats;
```
Expected: `0` or a small number if any test data exists from the prior implementation's manual verification — either way, not an error, and not itself a pass/fail signal (confirmed by the column check in Step 3 instead, same reasoning as the original `lift_stats` migration's Step 4).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260816000000_delivery_check_stats.sql
git commit -m "feat: replace lift_stats with delivery_check_stats (ambient control-group rate)"
```

---

## Task B: `deliveryCheck.js` pure module

**Files:**
- Create: `src/lib/deliveryCheck.js`, `src/lib/deliveryCheck.test.js`
- Delete: `src/lib/liftTest.js`, `src/lib/liftTest.test.js`

- [ ] **Step 1: Delete the old files**

```bash
git rm src/lib/liftTest.js src/lib/liftTest.test.js
```

- [ ] **Step 2: Write the failing test at `src/lib/deliveryCheck.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { compareDeliveryCheck, VERDICT } from './deliveryCheck.js';

describe('compareDeliveryCheck', () => {
  it('reports on-target when exposed rate is within 20% of control rate', () => {
    const r = compareDeliveryCheck({ exposed_rate: 9.5, control_rate: 10 });
    expect(r.available).toBe(true);
    expect(r.verdict).toBe(VERDICT.ON_TARGET);
    expect(r.ratio).toBeCloseTo(0.95, 5);
  });

  it('reports underperformed when exposed rate is well below control rate', () => {
    const r = compareDeliveryCheck({ exposed_rate: 5, control_rate: 10 });
    expect(r.available).toBe(true);
    expect(r.verdict).toBe(VERDICT.UNDERPERFORMED);
    expect(r.ratio).toBeCloseTo(0.5, 5);
  });

  it('reports exceeded when exposed rate is well above control rate', () => {
    const r = compareDeliveryCheck({ exposed_rate: 15, control_rate: 10 });
    expect(r.available).toBe(true);
    expect(r.verdict).toBe(VERDICT.EXCEEDED);
    expect(r.ratio).toBeCloseTo(1.5, 5);
  });

  it('treats exactly +/-20% as the boundary of on-target', () => {
    expect(compareDeliveryCheck({ exposed_rate: 8, control_rate: 10 }).verdict).toBe(VERDICT.ON_TARGET);
    expect(compareDeliveryCheck({ exposed_rate: 7.99, control_rate: 10 }).verdict).toBe(VERDICT.UNDERPERFORMED);
    expect(compareDeliveryCheck({ exposed_rate: 12, control_rate: 10 }).verdict).toBe(VERDICT.ON_TARGET);
    expect(compareDeliveryCheck({ exposed_rate: 12.01, control_rate: 10 }).verdict).toBe(VERDICT.EXCEEDED);
  });

  it('reports unavailable when there is no row at all', () => {
    const r = compareDeliveryCheck(null);
    expect(r.available).toBe(false);
    expect(r.reason).toBe('no_data');
  });

  it('reports unavailable when exposed_rate is missing', () => {
    const r = compareDeliveryCheck({ exposed_rate: null, control_rate: 10 });
    expect(r.available).toBe(false);
    expect(r.reason).toBe('no_data');
  });

  it('reports unavailable when control_rate is missing', () => {
    const r = compareDeliveryCheck({ exposed_rate: 10, control_rate: null });
    expect(r.available).toBe(false);
    expect(r.reason).toBe('no_data');
  });

  it('does not divide by a zero control rate', () => {
    const r = compareDeliveryCheck({ exposed_rate: 10, control_rate: 0 });
    expect(r.available).toBe(false);
    expect(r.reason).toBe('no_data');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/lib/deliveryCheck.test.js`
Expected: FAIL — cannot resolve `./deliveryCheck.js`.

- [ ] **Step 4: Write `src/lib/deliveryCheck.js`**

```js
// Comparing a campaign's exposed screens' actual delivered rate against its
// control screens' ambient audience rate. See Revision 1 in
// docs/superpowers/specs/2026-08-14-holdout-lift-testing-design.md for why
// this replaced a scan-rate comparison: control screens never serve the
// campaign (by design, to keep them unbilled/unmeasured-by-play), so they
// can never have scan or proof-of-play data. Ambient CV audience data
// (screen_audience_index) is the only signal that exists for them.
//
// This is a deliberately DESCRIPTIVE comparison, not a significance test --
// a rate-ratio hypothesis test needs real statistical care (Poisson
// variance estimation from CV sample-window counts) that wasn't feasible to
// design and independently verify correctly alongside everything else in
// this feature. A ratio and a threshold verdict, not a p-value or CI.

export const VERDICT = {
  UNDERPERFORMED: 'underperformed',
  ON_TARGET: 'on_target',
  EXCEEDED: 'exceeded',
};

const THRESHOLD = 0.2; // +/-20% counts as on-target

export function compareDeliveryCheck(row) {
  if (!row) return { available: false, reason: 'no_data' };

  const exposedRate = Number(row.exposed_rate);
  const controlRate = Number(row.control_rate);

  if (!Number.isFinite(exposedRate) || !Number.isFinite(controlRate) || controlRate <= 0) {
    return { available: false, reason: 'no_data' };
  }

  const ratio = exposedRate / controlRate;
  let verdict;
  if (ratio < 1 - THRESHOLD) verdict = VERDICT.UNDERPERFORMED;
  else if (ratio > 1 + THRESHOLD) verdict = VERDICT.EXCEEDED;
  else verdict = VERDICT.ON_TARGET;

  return { available: true, reason: null, exposedRate, controlRate, ratio, verdict };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/deliveryCheck.test.js`
Expected: PASS, 9 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/deliveryCheck.js src/lib/deliveryCheck.test.js
git rm src/lib/liftTest.js src/lib/liftTest.test.js
git commit -m "feat: replace liftTest.js with deliveryCheck.js (descriptive rate comparison)"
```

---

## Task C: `DeliveryCheckPanel` component

**Files:**
- Create: `src/components/shared/DeliveryCheckPanel.jsx`, `src/components/shared/DeliveryCheckPanel.test.jsx`
- Delete: `src/components/shared/LiftTestPanel.jsx`, `src/components/shared/LiftTestPanel.test.jsx`

- [ ] **Step 1: Delete the old files**

```bash
git rm src/components/shared/LiftTestPanel.jsx src/components/shared/LiftTestPanel.test.jsx
```

- [ ] **Step 2: Write the failing test at `src/components/shared/DeliveryCheckPanel.test.jsx`**

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeliveryCheckPanel } from './DeliveryCheckPanel.jsx';

describe('DeliveryCheckPanel', () => {
  it('renders nothing when the campaign did not opt into a holdout test', () => {
    const { container } = render(<DeliveryCheckPanel holdoutEnabled={false} row={null} />);
    expect(container.textContent).toBe('');
  });

  it('says data is still being collected when there is no row yet', () => {
    render(<DeliveryCheckPanel holdoutEnabled={true} row={null} />);
    expect(screen.getByText(/still collecting data/i)).toBeInTheDocument();
  });

  it('says data is still being collected when the control rate is zero', () => {
    render(<DeliveryCheckPanel holdoutEnabled={true} row={{ exposed_rate: 10, control_rate: 0 }} />);
    expect(screen.getByText(/still collecting data/i)).toBeInTheDocument();
  });

  it('reports underperformed with both rates shown', () => {
    render(<DeliveryCheckPanel holdoutEnabled={true} row={{ exposed_rate: 5, control_rate: 10 }} />);
    expect(screen.getByText(/underperformed/i)).toBeInTheDocument();
    expect(screen.getByText(/5\.00/)).toBeInTheDocument();
    expect(screen.getByText(/10\.00/)).toBeInTheDocument();
  });

  it('reports on target', () => {
    render(<DeliveryCheckPanel holdoutEnabled={true} row={{ exposed_rate: 9.5, control_rate: 10 }} />);
    expect(screen.getByText(/on target/i)).toBeInTheDocument();
  });

  it('reports exceeded', () => {
    render(<DeliveryCheckPanel holdoutEnabled={true} row={{ exposed_rate: 15, control_rate: 10 }} />);
    expect(screen.getByText(/exceeded/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/components/shared/DeliveryCheckPanel.test.jsx`
Expected: FAIL — cannot resolve `./DeliveryCheckPanel.jsx`.

- [ ] **Step 4: Write `src/components/shared/DeliveryCheckPanel.jsx`**

```jsx
import { C, F } from '../../design/tokens.js';
import { compareDeliveryCheck, VERDICT } from '../../lib/deliveryCheck.js';

const VERDICT_LABEL = {
  [VERDICT.UNDERPERFORMED]: 'Underperformed',
  [VERDICT.ON_TARGET]: 'On target',
  [VERDICT.EXCEEDED]: 'Exceeded',
};

const VERDICT_COLOR = {
  [VERDICT.UNDERPERFORMED]: C.red,
  [VERDICT.ON_TARGET]: C.textSub,
  [VERDICT.EXCEEDED]: C.green,
};

// Renders nothing at all when the campaign never opted into a holdout
// test, says so plainly when there isn't enough data yet, and only ever
// shows a descriptive ratio -- never a fabricated statistical claim.
export function DeliveryCheckPanel({ holdoutEnabled, row }) {
  if (!holdoutEnabled) return null;

  const result = compareDeliveryCheck(row);

  if (!result.available) {
    return (
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
        padding: '16px 20px', fontFamily: F.sans,
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>Delivery Check</div>
        <div style={{ fontSize: 13, color: C.textMuted }}>
          Still collecting data for this delivery check.
        </div>
      </div>
    );
  }

  const { exposedRate, controlRate, verdict } = result;

  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
      padding: '16px 20px', fontFamily: F.sans,
    }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 10 }}>Delivery Check</div>
      <div style={{ display: 'flex', gap: 24, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: C.textMuted }}>Exposed delivered rate</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: F.mono }}>{exposedRate.toFixed(2)} ppl/min</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.textMuted }}>Control ambient rate</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: F.mono }}>{controlRate.toFixed(2)} ppl/min</div>
        </div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: VERDICT_COLOR[verdict] }}>
        {VERDICT_LABEL[verdict]} — delivery vs. this campaign's randomly-assigned control group's measured ambient audience.
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/shared/DeliveryCheckPanel.test.jsx`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/shared/DeliveryCheckPanel.jsx src/components/shared/DeliveryCheckPanel.test.jsx
git rm src/components/shared/LiftTestPanel.jsx src/components/shared/LiftTestPanel.test.jsx
git commit -m "feat: replace LiftTestPanel with DeliveryCheckPanel"
```

---

## Task D: Wire into `CampaignDetail.jsx`

**Files:**
- Modify: `src/views/operator/CampaignDetail.jsx`

- [ ] **Step 1: Read the current file's lift-related code**

The prior implementation (commit `3007c02`) added: an import of `LiftTestPanel`, `liftExposed`/`liftControl` state, a `useEffect` fetching `lift_stats` with error handling, a conditional "Lift Test" tab, and a `{tab === 'lift' && <LiftTestPanel .../>}` block. Read the file to find the exact current location of each — this task replaces all of it.

- [ ] **Step 2: Replace the import**

Find:
```jsx
import { LiftTestPanel } from '../../components/shared/LiftTestPanel.jsx';
```
Replace with:
```jsx
import { DeliveryCheckPanel } from '../../components/shared/DeliveryCheckPanel.jsx';
```

- [ ] **Step 3: Replace the state and fetch effect**

Find the `liftExposed`/`liftControl` state and its `useEffect` (querying `lift_stats`, splitting by `is_control`). Replace with:

```jsx
  const [deliveryCheckRow, setDeliveryCheckRow] = useState(null);

  useEffect(() => {
    if (!c.holdout_enabled) return;
    supabase
      .from('delivery_check_stats')
      .select('exposed_impressions, exposed_play_minutes, exposed_rate, control_rate')
      .eq('campaign_id', c.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) { toast.error('Failed to load delivery check results.'); return; }
        setDeliveryCheckRow(data ?? null);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id, c.holdout_enabled]);
```

(`delivery_check_stats` returns at most one row per `campaign_id` — no exposed/control split needed client-side anymore, since the view already computes both rates in a single row. Use `.maybeSingle()`, not `.find()` over an array.)

- [ ] **Step 4: Replace the tab label**

Find:
```jsx
        ...(c.holdout_enabled ? [{ id: 'lift', label: 'Lift Test' }] : []),
```
Replace with:
```jsx
        ...(c.holdout_enabled ? [{ id: 'delivery-check', label: 'Delivery Check' }] : []),
```

- [ ] **Step 5: Replace the tab content block**

Find:
```jsx
      {tab === 'lift' && (
        <LiftTestPanel holdoutEnabled={c.holdout_enabled} exposed={liftExposed} control={liftControl} />
      )}
```
Replace with:
```jsx
      {tab === 'delivery-check' && (
        <DeliveryCheckPanel holdoutEnabled={c.holdout_enabled} row={deliveryCheckRow} />
      )}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/views/operator/CampaignDetail.onApprovalChange.test.jsx`
Expected: PASS.

- [ ] **Step 7: Lint against baseline**

```bash
git stash
npx eslint src/views/operator/CampaignDetail.jsx > /tmp/lint-before.txt 2>&1
git stash pop
npx eslint src/views/operator/CampaignDetail.jsx > /tmp/lint-after.txt 2>&1
diff /tmp/lint-before.txt /tmp/lint-after.txt
```
Expected: no new lines in the diff.

- [ ] **Step 8: Commit**

```bash
git add src/views/operator/CampaignDetail.jsx
git commit -m "feat: swap CampaignDetail's Lift Test tab for Delivery Check"
```

---

## Task E: Wire into `campaign-report` and `CampaignReport.jsx`

**Files:**
- Modify: `supabase/functions/campaign-report/index.ts`
- Modify: `src/views/public/CampaignReport.jsx`

- [ ] **Step 1: Replace the `lift_stats` query in the edge function**

In `supabase/functions/campaign-report/index.ts`, find the block added in the prior implementation (commit `dbda8ee`):

```ts
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

Replace with:

```ts
  let deliveryCheck = null;
  if (campaign?.holdout_enabled) {
    const { data: row } = await supabase
      .from("delivery_check_stats")
      .select("exposed_impressions, exposed_play_minutes, exposed_rate, control_rate")
      .eq("campaign_id", campaignId)
      .maybeSingle();
    deliveryCheck = row ?? null;
  }
```

- [ ] **Step 2: Rename the response key**

Find:
```ts
    health: health ?? null,
    lift,
  }), { headers: CORS });
```
Replace with:
```ts
    health: health ?? null,
    deliveryCheck,
  }), { headers: CORS });
```

- [ ] **Step 3: Deploy**

Run: `npx supabase functions deploy campaign-report --project-ref hkqiuwnppxkkztacwicj`
Expected: `"Deployed Functions."`.

- [ ] **Step 4: Update `CampaignReport.jsx`**

Find the import:
```jsx
import { LiftTestPanel } from '../../components/shared/LiftTestPanel.jsx';
```
Replace with:
```jsx
import { DeliveryCheckPanel } from '../../components/shared/DeliveryCheckPanel.jsx';
```

Find the destructure:
```jsx
  const { campaign, totals, daily, health, lift } = report;
```
Replace with:
```jsx
  const { campaign, totals, daily, health, deliveryCheck } = report;
```

Find the render block:
```jsx
      {lift && (
        <div style={{ marginBottom: 28 }}>
          {/* The public report never sends holdout_enabled directly (see
              campaign-report/index.ts) -- `lift` is only present at all when
              it's true, so its presence alone is the signal here. */}
          <LiftTestPanel holdoutEnabled={true} exposed={lift.exposed} control={lift.control} />
        </div>
      )}
```
Replace with:
```jsx
      {deliveryCheck && (
        <div style={{ marginBottom: 28 }}>
          {/* The public report never sends holdout_enabled directly (see
              campaign-report/index.ts) -- `deliveryCheck` is only present at
              all when it's true, so its presence alone is the signal here. */}
          <DeliveryCheckPanel holdoutEnabled={true} row={deliveryCheck} />
        </div>
      )}
```

- [ ] **Step 5: Lint against baseline**

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
git commit -m "feat: swap public campaign report's lift panel for delivery check"
```

---

## Task F: Update wizard copy

**Files:**
- Modify: `src/views/advertiser/createCampaign/StepTargeting.jsx`

- [ ] **Step 1: Update the toggle's explanatory copy**

Find:
```jsx
              <strong>Run a holdout test</strong> — we'll randomly hold back ~20% of screens as a control
              group to measure whether this campaign actually drives scans, at no extra cost (control
              screens aren't billed).
```
Replace with:
```jsx
              <strong>Run a holdout test</strong> — we'll randomly hold back ~20% of screens as a control
              group to check whether delivery matched the measured audience, at no extra cost (control
              screens aren't billed).
```

- [ ] **Step 2: Lint against baseline**

```bash
git stash
npx eslint src/views/advertiser/createCampaign/StepTargeting.jsx > /tmp/lint-before.txt 2>&1
git stash pop
npx eslint src/views/advertiser/createCampaign/StepTargeting.jsx > /tmp/lint-after.txt 2>&1
diff /tmp/lint-before.txt /tmp/lint-after.txt
```
Expected: no new lines in the diff.

- [ ] **Step 3: Commit**

```bash
git add src/views/advertiser/createCampaign/StepTargeting.jsx
git commit -m "docs(ui): update holdout toggle copy for the delivery-check metric"
```

---

## Task G: Full verification pass

- [ ] **Step 1: Full test suite**

Run: `npx vitest run`
Expected: all pass. Baseline before this delta was 625 (612 original + 13 from the first lift-testing implementation). This delta removes 8+5=13 old tests (`liftTest.test.js`, `LiftTestPanel.test.jsx`) and adds 9+6=15 new ones (`deliveryCheck.test.js`, `DeliveryCheckPanel.test.jsx`) — expect **627**.

- [ ] **Step 2: Build**

Run: `npx vite build`
Expected: exits 0.

- [ ] **Step 3: Confirm `lift_stats` is gone and `delivery_check_stats` has the right shape**

```sql
select table_name from information_schema.tables where table_name = 'lift_stats';
```
Expected: no rows.

```sql
select column_name from information_schema.columns where table_name = 'delivery_check_stats';
```
Expected: `campaign_id, exposed_impressions, exposed_play_minutes, exposed_rate, control_rate`.

- [ ] **Step 4: Confirm no leftover references to the old names anywhere in source**

```bash
grep -rn "LiftTestPanel\|liftTest\|lift_stats\b" src/ supabase/functions/ --include='*.js' --include='*.jsx' --include='*.ts'
```
Expected: no matches. If any remain, that's a task from this plan that missed a call site — fix it before proceeding.

- [ ] **Step 5: Confirm all touched edge functions are deployed and ACTIVE**

```bash
npx supabase functions list --project-ref hkqiuwnppxkkztacwicj 2>&1 | grep -oE '"slug":"campaign-report"'
```
Expected: present. (`assign-holdout-control`, `display-feed`, `charge-campaign` are untouched by this delta — no redeploy needed for them.)

- [ ] **Step 6: Commit final state if any verification step required a fix**

```bash
git add -A
git commit -m "test: delivery-check revision verification pass"
```
(Skip this step if Steps 1-5 required no changes.)

---

## Acceptance criteria

- `lift_stats` no longer exists in production; `delivery_check_stats` exists with the documented shape.
- A holdout-enabled campaign with real delivery data produces a `delivery_check_stats` row with a non-null `control_rate` once its control screens have accumulated `screen_audience_index` samples for the campaign's schedule window — this is the property that was structurally impossible before this revision.
- `DeliveryCheckPanel` never shows a fabricated statistical claim (no p-value, no CI) — only a ratio and a plain-English verdict.
- No source file anywhere still references `LiftTestPanel`, `liftTest.js`, or `lift_stats`.
- The wizard toggle's copy accurately describes what the feature now measures.
