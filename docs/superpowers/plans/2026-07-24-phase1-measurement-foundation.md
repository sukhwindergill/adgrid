# Phase 1: Measurement Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace AdGrid's single conflated "impressions" number and its fabricated trend arrows with three separately-derived, correctly-labelled metrics — proof-of-play, audience-weighted impressions, and CV attention — plus honest period-over-period deltas and bot/duplicate-filtered scans.

**Architecture:** A new `ad_plays` table records one row per creative play, pushed by the display player through a new token-authenticated `ingest-plays` edge function (idempotent on a client-generated play id, so buffered offline plays survive retries). A materialized view aggregates the existing camera `impression_events` into a per-screen, per-hour audience index; impressions are then *derived* as `plays × audience_multiplier`, falling back to a venue-type footfall model with an explicit `basis` flag when there is not enough camera data. A single `campaign_delivery_daily` view becomes the one source every product surface reads. All pure logic lives in unit-tested modules under `src/lib/` and `supabase/functions/_shared/`.

**Tech Stack:** React 19 + Vite 8 (JS, no TypeScript in `src/`), Supabase Postgres + Deno edge functions (TS), pg_cron, vitest (added in Task 1 — the web app currently has no test runner).

---

## Context an engineer needs before starting

- **Repo layout:** web app in `src/`, Deno edge functions in `supabase/functions/<name>/index.ts`, SQL migrations in `supabase/migrations/YYYYMMDDHHMMSS_name.sql`. Package manager is **pnpm** (there is a `pnpm-lock.yaml` and `pnpm-workspace.yaml`).
- **A "campaign" is a row in `bookings`.** There is no `campaigns` table. `campaign_screens` is the join table between a booking and each screen, and carries per-screen `status` and creative overrides (`media_url`, `media_type`).
- **`impression_events` already exists and is populated** by the CV screen agent (`screen-agent/`) via the `ingest-impressions` edge function. Columns: `screen_id`, `campaign_id`, `window_start`, `window_end`, `people_count`, `avg_dwell_seconds`, `avg_attention_score` (0–1), age buckets, gender buckets, `qr_scans_in_window`.
- **Deliberate existing design decision — do not break it.** [DisplayPlayer.jsx](../../../src/views/display/DisplayPlayer.jsx) carries a comment stating the browser player has no camera and must **not** post audience impressions, because that would fabricate "1 person watched" per rotation. This plan honours that: `ad_plays` records *that a creative played*, never *who saw it*. Audience is only ever derived from camera data or explicitly labelled as modelled.
- **`display_heartbeats` is not proof of play.** `display-feed` writes a heartbeat row per 30-second poll. That records "the screen was alive and had something to show" — it cannot say which creative played, for how long, or whether it completed. That is why `ad_plays` is needed.
- **Do not use `pnpm test` before Task 1** — no test runner is installed yet.

---

## File Structure

**Created:**
| Path | Responsibility |
|---|---|
| `vitest.config.js` | Test runner config (jsdom env, setup file) |
| `vitest.setup.js` | Registers jest-dom matchers |
| `src/lib/periodDelta.js` | Pure period-over-period delta math |
| `src/lib/periodDelta.test.js` | Tests for the above |
| `src/lib/footfallCurves.js` | Venue-type hourly footfall shape, used for modelled fallback |
| `src/lib/footfallCurves.test.js` | Tests for the above |
| `src/lib/playBuffer.js` | Pure play-buffer state machine used by the display player |
| `src/lib/playBuffer.test.js` | Tests for the above |
| `supabase/functions/_shared/playValidation.ts` | Pure validation/clamping for play batches |
| `supabase/functions/_shared/playValidation.test.js` | Tests for the above (run by vitest) |
| `supabase/functions/_shared/scanQuality.ts` | Pure bot detection + dedup key derivation |
| `supabase/functions/_shared/scanQuality.test.js` | Tests for the above |
| `supabase/functions/ingest-plays/index.ts` | Token-authenticated batch play ingest |
| `supabase/migrations/20260724000000_ad_plays.sql` | `ad_plays` table + RLS |
| `supabase/migrations/20260724000001_screen_audience_index.sql` | Audience index materialized view + refresh cron |
| `supabase/migrations/20260724000002_scan_quality.sql` | `scans` bot/duplicate columns |
| `supabase/migrations/20260724000003_campaign_delivery_daily.sql` | Unified delivery view |

**Task order note:** the delivery view (Task 11) reads `scans.is_bot` / `scans.is_duplicate`, which the scan-quality migration (Task 12) creates. The migration *filenames* above are therefore numbered so `scan_quality` applies first. Either apply Task 12's migration before Task 11's, or write both files before the first `db push` — the timestamps guarantee the correct order regardless of which task you author first.

**Modified:**
| Path | Change |
|---|---|
| `package.json` | vitest devDeps + `test` scripts |
| `src/components/primitives/KPI.jsx` | Render nothing when trend is null; label the comparison period |
| `src/views/operator/Analytics.jsx:276` | Remove `trend={8}`, pass a real delta |
| `src/views/operator/Billing.jsx:92` | Remove `trend={14}`, pass a real delta |
| `src/views/operator/Dashboard.jsx:174` | Remove `trend={12}`, pass a real delta |
| `src/views/operator/Revenue.jsx:55` | Remove `trend={14}`, pass a real delta |
| `src/views/display/DisplayPlayer.jsx` | Emit plays into the buffer and flush to `ingest-plays` |
| `supabase/functions/scan-redirect/index.ts` | Stamp `is_bot`, `is_duplicate`, `dedup_key` on insert |
| `src/views/advertiser/AdvDashboard.jsx` | Read delivery from `campaign_delivery_daily`, show basis + filtered scans |

---

## Task 1: Test infrastructure

**Files:**
- Create: `vitest.config.js`, `vitest.setup.js`, `src/lib/smoke.test.js`
- Modify: `package.json`

- [ ] **Step 1: Install the test toolchain**

```bash
pnpm add -D vitest@^3 jsdom@^26 @testing-library/react@^16 @testing-library/jest-dom@^6
```

- [ ] **Step 2: Create `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.js'],
    include: ['src/**/*.test.{js,jsx}', 'supabase/functions/**/*.test.js'],
    globals: true,
  },
});
```

- [ ] **Step 3: Create `vitest.setup.js`**

```js
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4: Add scripts to `package.json`**

In the `"scripts"` block, add these two entries after `"lint"`:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 5: Write a smoke test at `src/lib/smoke.test.js`**

```js
import { describe, it, expect } from 'vitest';

describe('test harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run it**

Run: `pnpm test`
Expected: PASS, 1 test passed.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.js vitest.setup.js src/lib/smoke.test.js
git commit -m "test: add vitest harness for the web app"
```

---

## Task 2: Honest period deltas (pure module)

**Files:**
- Create: `src/lib/periodDelta.js`, `src/lib/periodDelta.test.js`

- [ ] **Step 1: Write the failing test at `src/lib/periodDelta.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { periodDelta, splitByPeriod } from './periodDelta.js';

describe('periodDelta', () => {
  it('returns positive percent growth', () => {
    expect(periodDelta(120, 100)).toBe(20);
  });

  it('returns negative percent decline', () => {
    expect(periodDelta(75, 100)).toBe(-25);
  });

  it('rounds to a whole percent', () => {
    expect(periodDelta(103.7, 100)).toBe(4);
  });

  it('returns null when there is no prior baseline', () => {
    expect(periodDelta(120, 0)).toBeNull();
  });

  it('returns null when either value is not a finite number', () => {
    expect(periodDelta(120, null)).toBeNull();
    expect(periodDelta(undefined, 100)).toBeNull();
    expect(periodDelta(NaN, 100)).toBeNull();
  });
});

describe('splitByPeriod', () => {
  const now = new Date('2026-07-24T12:00:00Z');
  const rows = [
    { at: '2026-07-23T10:00:00Z', amount: 10 }, // current 7d
    { at: '2026-07-19T10:00:00Z', amount: 5 },  // current 7d
    { at: '2026-07-14T10:00:00Z', amount: 40 }, // prior 7d
    { at: '2026-06-01T10:00:00Z', amount: 99 }, // older than both
  ];

  it('sums the current and prior windows', () => {
    const { current, prior } = splitByPeriod(rows, 'at', 'amount', 7, now);
    expect(current).toBe(15);
    expect(prior).toBe(40);
  });

  it('ignores rows with an unparseable date', () => {
    const { current } = splitByPeriod([{ at: 'not-a-date', amount: 7 }], 'at', 'amount', 7, now);
    expect(current).toBe(0);
  });

  it('counts rows when no value key is given', () => {
    const { current, prior } = splitByPeriod(rows, 'at', null, 7, now);
    expect(current).toBe(2);
    expect(prior).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/lib/periodDelta.test.js`
Expected: FAIL — `Failed to resolve import "./periodDelta.js"`.

- [ ] **Step 3: Write `src/lib/periodDelta.js`**

```js
// Period-over-period math for KPI trend arrows.
//
// Returns null rather than a number whenever a comparison would be
// meaningless (no baseline, missing data). Callers must render nothing in
// that case — never a zero and never a placeholder. Fabricated trend values
// were a real defect in this codebase; null is the honest answer.

export function periodDelta(current, prior) {
  if (!Number.isFinite(current) || !Number.isFinite(prior)) return null;
  if (prior === 0) return null;
  return Math.round(((current - prior) / prior) * 100);
}

// Splits rows into the trailing `days` window and the `days` window before it.
// `valueKey` of null counts rows instead of summing a field.
export function splitByPeriod(rows, dateKey, valueKey, days, now = new Date()) {
  const msPerDay = 86_400_000;
  const currentStart = now.getTime() - days * msPerDay;
  const priorStart   = now.getTime() - 2 * days * msPerDay;

  let current = 0;
  let prior   = 0;

  for (const row of rows ?? []) {
    const t = new Date(row?.[dateKey]).getTime();
    if (!Number.isFinite(t)) continue;
    const amount = valueKey === null ? 1 : Number(row[valueKey]) || 0;
    if (t >= currentStart && t <= now.getTime()) current += amount;
    else if (t >= priorStart && t < currentStart) prior += amount;
  }

  return { current, prior };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/lib/periodDelta.test.js`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/periodDelta.js src/lib/periodDelta.test.js
git commit -m "feat: add period-over-period delta helpers"
```

---

## Task 3: KPI renders only real trends

**Files:**
- Modify: `src/components/primitives/KPI.jsx`
- Create: `src/components/primitives/KPI.test.jsx`

- [ ] **Step 1: Write the failing test at `src/components/primitives/KPI.test.jsx`**

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KPI } from './KPI.jsx';

describe('KPI', () => {
  it('renders the value and label', () => {
    render(<KPI label="Impressions" value="12.4K" />);
    expect(screen.getByText('Impressions')).toBeInTheDocument();
    expect(screen.getByText('12.4K')).toBeInTheDocument();
  });

  it('renders no trend row when trend is null', () => {
    const { container } = render(<KPI label="Impressions" value="12.4K" trend={null} />);
    expect(container.textContent).not.toMatch(/vs prior/);
  });

  it('renders no trend row when trend is omitted', () => {
    const { container } = render(<KPI label="Impressions" value="12.4K" />);
    expect(container.textContent).not.toMatch(/vs prior/);
  });

  it('renders an up arrow and the comparison window for a positive trend', () => {
    render(<KPI label="Spend" value="$100" trend={12} trendLabel="vs prior 30 days" />);
    expect(screen.getByText(/▲ 12% vs prior 30 days/)).toBeInTheDocument();
  });

  it('renders a down arrow for a negative trend', () => {
    render(<KPI label="Spend" value="$100" trend={-8} trendLabel="vs prior 7 days" />);
    expect(screen.getByText(/▼ 8% vs prior 7 days/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/components/primitives/KPI.test.jsx`
Expected: FAIL — the "no trend row when trend is null" case fails, because the current component tests `trend !== undefined` and so renders `▲ 0% vs last month` for null; the trendLabel cases fail because the string is hardcoded to "vs last month".

- [ ] **Step 3: Replace the trend block in `src/components/primitives/KPI.jsx`**

Replace the whole file with:

```jsx
import { C, F } from '../../design/tokens.js';
import { Card } from './Card.jsx';

// `trend` is a whole-number percent from lib/periodDelta.js, or null when
// there is no baseline to compare against. Null renders nothing — never a
// placeholder number.
export const KPI = ({ label, value, sub, color = C.text, trend = null, trendLabel = 'vs prior period', icon }) => (
  <Card style={{ padding: 20 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: C.textSub, fontFamily: F.sans }}>{label}</span>
      {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
    </div>
    <div style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1, marginBottom: 4, fontFamily: F.mono }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: C.textMuted, fontFamily: F.sans }}>{sub}</div>}
    {Number.isFinite(trend) && (
      <div style={{ fontSize: 12, marginTop: 6, color: trend >= 0 ? C.green : C.red, fontFamily: F.sans, fontWeight: 500 }}>
        {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}% {trendLabel}
      </div>
    )}
  </Card>
);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/components/primitives/KPI.test.jsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/primitives/KPI.jsx src/components/primitives/KPI.test.jsx
git commit -m "fix: KPI renders nothing when there is no real trend to show"
```

---

## Task 4: Remove the four fabricated trend values

Each of these four call sites passes a constant that renders as if measured. Each is replaced with a real delta computed from data the view already loads.

**Files:**
- Modify: `src/views/operator/Revenue.jsx:55`, `src/views/operator/Billing.jsx:92`, `src/views/operator/Dashboard.jsx:174`, `src/views/operator/Analytics.jsx:276`

- [ ] **Step 1: Confirm the four fabricated values are still present**

Run: `grep -rn "trend={" src/views/`
Expected: exactly four hits — `Analytics.jsx:276` (`trend={8}`), `Billing.jsx:92` (`trend={14}`), `Dashboard.jsx:174` (`trend={12}`), `Revenue.jsx:55` (`trend={14}`).

- [ ] **Step 2: Fix `src/views/operator/Revenue.jsx`**

Add the import at the top of the file, next to the other `../../lib/` imports:

```js
import { periodDelta, splitByPeriod } from '../../lib/periodDelta.js';
```

Immediately below the existing `const maxRev = …` line (after the `if (loading)` early return, so the constants are in scope), add:

```js
  // Real 30-day-over-30-day delta. `filteredCampaigns` rows carry `start_date`
  // and `budget` — the same fields the `total` above sums.
  const spendPeriods = splitByPeriod(filteredCampaigns, 'start_date', 'budget', 30);
  const spendTrend   = periodDelta(spendPeriods.current, spendPeriods.prior);
```

Then change line 55 from:

```jsx
        <KPI label="Total Ad Spend"   value={`$${total.toLocaleString()}`}    sub="from advertisers" trend={14} icon="💰" />
```

to:

```jsx
        <KPI label="Total Ad Spend"   value={`$${total.toLocaleString()}`}    sub="from advertisers" trend={spendTrend} trendLabel="vs prior 30 days" icon="💰" />
```

- [ ] **Step 3: Fix `src/views/operator/Billing.jsx`** the same way

Add the same import. Below the existing `const pendingIn = …` line, add:

```js
  // `charges` rows are shaped { id, advertiser, screen, date, amount, status }
  // by the operator-billing edge function — the date field is `date`.
  const chargedPeriods = splitByPeriod(charges, 'date', 'amount', 30);
  const chargedTrend   = periodDelta(chargedPeriods.current, chargedPeriods.prior);
```

Change line 92's `trend={14}` to `trend={chargedTrend} trendLabel="vs prior 30 days"`.

- [ ] **Step 4: Fix `src/views/operator/Dashboard.jsx`**

Add the same import. Above the `return (`, add:

```js
  // Network revenue has no per-transaction history loaded in this view, so
  // there is no honest baseline to compare against here. Pass null until the
  // Phase 2 reconciliation table lands, which carries dated revenue rows.
  const revenueTrend = null;
```

Change line 174's `trend={12}` to `trend={revenueTrend}`.

- [ ] **Step 5: Fix `src/views/operator/Analytics.jsx`**

Add the same import. Inside the `stats` `useMemo` (which already has the impression rows and the selected `period` in scope), compute:

```js
  const impressionPeriods = splitByPeriod(events, 'window_start', 'people_count', Number(period) || 30);
  const impressionTrend   = periodDelta(impressionPeriods.current, impressionPeriods.prior);
```

Return `impressionTrend` from the memo alongside the existing stats, destructure it where the other stats are destructured, and change line 276's `trend={8}` to `trend={impressionTrend} trendLabel={`vs prior ${period} days`}`. If the impression-event rows are held under a different variable name in this file, use that name.

- [ ] **Step 6: Verify no fabricated trends remain**

Run: `grep -rnE "trend=\{[0-9]" src/`
Expected: no output.

- [ ] **Step 7: Verify the app still builds and lints**

Run: `pnpm lint && pnpm build`
Expected: both exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/views/operator/Revenue.jsx src/views/operator/Billing.jsx src/views/operator/Dashboard.jsx src/views/operator/Analytics.jsx
git commit -m "fix: replace fabricated KPI trend values with real period deltas"
```

---

## Task 5: `ad_plays` table

**Files:**
- Create: `supabase/migrations/20260724000000_ad_plays.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- Proof of play. One row per creative play on one screen.
--
-- This is NOT audience data. It records that a creative was displayed,
-- for how long, and whether it completed. Audience is derived separately
-- from impression_events (camera) or modelled — never inferred from a play.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ad_plays (
  id             bigserial PRIMARY KEY,
  campaign_id    uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  screen_id      uuid NOT NULL REFERENCES public.screens(id) ON DELETE CASCADE,
  played_at      timestamptz NOT NULL,
  duration_s     numeric NOT NULL CHECK (duration_s > 0 AND duration_s <= 300),
  completed      boolean NOT NULL DEFAULT true,
  client_play_id text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ad_plays_client_unique UNIQUE (screen_id, client_play_id)
);

CREATE INDEX IF NOT EXISTS ad_plays_campaign_played_idx ON public.ad_plays (campaign_id, played_at DESC);
CREATE INDEX IF NOT EXISTS ad_plays_screen_played_idx   ON public.ad_plays (screen_id, played_at DESC);

ALTER TABLE public.ad_plays ENABLE ROW LEVEL SECURITY;

-- Only the service role writes plays (via the ingest-plays edge function,
-- which authenticates the caller by screen_token). No anon/authenticated insert.
REVOKE INSERT, UPDATE, DELETE ON public.ad_plays FROM anon, authenticated;

DROP POLICY IF EXISTS "operator_view_own_screen_plays" ON public.ad_plays;
CREATE POLICY "operator_view_own_screen_plays" ON public.ad_plays
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.screens s
      WHERE s.id = ad_plays.screen_id AND s.operator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "advertiser_view_own_campaign_plays" ON public.ad_plays;
CREATE POLICY "advertiser_view_own_campaign_plays" ON public.ad_plays
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = ad_plays.campaign_id AND b.advertiser_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Apply the migration to the local/dev project**

Run: `pnpm dlx supabase db push`
Expected: reports the new migration applied with no errors.

- [ ] **Step 3: Verify the table and its constraint exist**

Run:
```bash
pnpm dlx supabase db execute "select column_name, data_type from information_schema.columns where table_name = 'ad_plays' order by ordinal_position"
```
Expected: 8 rows — `id, campaign_id, screen_id, played_at, duration_s, completed, client_play_id, created_at`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260724000000_ad_plays.sql
git commit -m "feat: add ad_plays proof-of-play table"
```

---

## Task 6: Play batch validation (pure module)

**Files:**
- Create: `supabase/functions/_shared/playValidation.ts`, `supabase/functions/_shared/playValidation.test.js`

This module must import nothing Deno-specific so vitest can run it directly.

- [ ] **Step 1: Write the failing test at `supabase/functions/_shared/playValidation.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { MAX_BATCH, validatePlayBatch } from './playValidation.ts';

const now = new Date('2026-07-24T12:00:00Z');
const valid = {
  campaign_id: '11111111-1111-1111-1111-111111111111',
  client_play_id: 'p1',
  played_at: '2026-07-24T11:59:00Z',
  duration_s: 10,
  completed: true,
};

describe('validatePlayBatch', () => {
  it('accepts a well-formed play and echoes its fields', () => {
    const { accepted, rejected } = validatePlayBatch([valid], now);
    expect(rejected).toHaveLength(0);
    expect(accepted[0]).toMatchObject({
      campaign_id: valid.campaign_id,
      client_play_id: 'p1',
      duration_s: 10,
      completed: true,
    });
  });

  it('rejects a play with no campaign_id', () => {
    const { accepted, rejected } = validatePlayBatch([{ ...valid, campaign_id: null }], now);
    expect(accepted).toHaveLength(0);
    expect(rejected[0].reason).toBe('missing_campaign_id');
  });

  it('rejects a play with no client_play_id', () => {
    const { rejected } = validatePlayBatch([{ ...valid, client_play_id: '' }], now);
    expect(rejected[0].reason).toBe('missing_client_play_id');
  });

  it('rejects a play timestamped in the future', () => {
    const { rejected } = validatePlayBatch([{ ...valid, played_at: '2026-07-24T12:05:00Z' }], now);
    expect(rejected[0].reason).toBe('played_at_out_of_range');
  });

  it('rejects a play older than 48 hours', () => {
    const { rejected } = validatePlayBatch([{ ...valid, played_at: '2026-07-21T12:00:00Z' }], now);
    expect(rejected[0].reason).toBe('played_at_out_of_range');
  });

  it('rejects an unparseable timestamp', () => {
    const { rejected } = validatePlayBatch([{ ...valid, played_at: 'whenever' }], now);
    expect(rejected[0].reason).toBe('played_at_out_of_range');
  });

  it('clamps a duration above the 300s ceiling', () => {
    const { accepted } = validatePlayBatch([{ ...valid, duration_s: 9999 }], now);
    expect(accepted[0].duration_s).toBe(300);
  });

  it('rejects a non-positive duration', () => {
    expect(validatePlayBatch([{ ...valid, duration_s: 0 }], now).rejected[0].reason).toBe('invalid_duration');
    expect(validatePlayBatch([{ ...valid, duration_s: -4 }], now).rejected[0].reason).toBe('invalid_duration');
  });

  it('defaults completed to true when absent', () => {
    const { accepted } = validatePlayBatch([{ ...valid, completed: undefined }], now);
    expect(accepted[0].completed).toBe(true);
  });

  it('drops duplicate client_play_ids within one batch, keeping the first', () => {
    const { accepted, rejected } = validatePlayBatch([valid, { ...valid, duration_s: 30 }], now);
    expect(accepted).toHaveLength(1);
    expect(accepted[0].duration_s).toBe(10);
    expect(rejected[0].reason).toBe('duplicate_in_batch');
  });

  it('truncates a batch larger than MAX_BATCH', () => {
    const big = Array.from({ length: MAX_BATCH + 10 }, (_, i) => ({ ...valid, client_play_id: `p${i}` }));
    const { accepted } = validatePlayBatch(big, now);
    expect(accepted).toHaveLength(MAX_BATCH);
  });

  it('returns empty results for a non-array input', () => {
    expect(validatePlayBatch(null, now).accepted).toHaveLength(0);
    expect(validatePlayBatch('nope', now).accepted).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test supabase/functions/_shared/playValidation.test.js`
Expected: FAIL — cannot resolve `./playValidation.ts`.

- [ ] **Step 3: Write `supabase/functions/_shared/playValidation.ts`**

```ts
// Pure validation for a batch of proof-of-play records posted by a display
// player. No Deno APIs here so the module is unit-testable under vitest.

export const MAX_BATCH = 200;
export const MAX_DURATION_S = 300;
const MAX_AGE_MS = 48 * 60 * 60 * 1000;

export interface RawPlay {
  campaign_id?: unknown;
  client_play_id?: unknown;
  played_at?: unknown;
  duration_s?: unknown;
  completed?: unknown;
}

export interface CleanPlay {
  campaign_id: string;
  client_play_id: string;
  played_at: string;
  duration_s: number;
  completed: boolean;
}

export interface RejectedPlay {
  client_play_id: string | null;
  reason: string;
}

export function validatePlayBatch(
  input: unknown,
  now: Date = new Date(),
): { accepted: CleanPlay[]; rejected: RejectedPlay[] } {
  const accepted: CleanPlay[] = [];
  const rejected: RejectedPlay[] = [];

  if (!Array.isArray(input)) return { accepted, rejected };

  const seen = new Set<string>();

  for (const raw of input as RawPlay[]) {
    if (accepted.length >= MAX_BATCH) break;

    const campaignId = typeof raw?.campaign_id === 'string' ? raw.campaign_id.trim() : '';
    const clientId   = typeof raw?.client_play_id === 'string' ? raw.client_play_id.trim() : '';

    if (!campaignId) { rejected.push({ client_play_id: clientId || null, reason: 'missing_campaign_id' }); continue; }
    if (!clientId)   { rejected.push({ client_play_id: null, reason: 'missing_client_play_id' }); continue; }
    if (seen.has(clientId)) { rejected.push({ client_play_id: clientId, reason: 'duplicate_in_batch' }); continue; }

    const t = new Date(raw.played_at as string).getTime();
    if (!Number.isFinite(t) || t > now.getTime() || t < now.getTime() - MAX_AGE_MS) {
      rejected.push({ client_play_id: clientId, reason: 'played_at_out_of_range' });
      continue;
    }

    const rawDuration = Number(raw.duration_s);
    if (!Number.isFinite(rawDuration) || rawDuration <= 0) {
      rejected.push({ client_play_id: clientId, reason: 'invalid_duration' });
      continue;
    }

    seen.add(clientId);
    accepted.push({
      campaign_id: campaignId,
      client_play_id: clientId,
      played_at: new Date(t).toISOString(),
      duration_s: Math.min(rawDuration, MAX_DURATION_S),
      completed: raw.completed === undefined ? true : Boolean(raw.completed),
    });
  }

  return { accepted, rejected };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test supabase/functions/_shared/playValidation.test.js`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/playValidation.ts supabase/functions/_shared/playValidation.test.js
git commit -m "feat: add pure validation for proof-of-play batches"
```

---

## Task 7: `ingest-plays` edge function

**Files:**
- Create: `supabase/functions/ingest-plays/index.ts`

Follows the auth and CORS pattern of `supabase/functions/ingest-impressions/index.ts` — read that file first.

- [ ] **Step 1: Write `supabase/functions/ingest-plays/index.ts`**

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validatePlayBatch } from "../_shared/playValidation.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Content-Type": "application/json",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: CORS });

  let body: { screen_token?: string; plays?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: CORS });
  }

  if (!body.screen_token) {
    return new Response(JSON.stringify({ error: "screen_token required" }), { status: 400, headers: CORS });
  }

  const { data: screen, error: screenError } = await supabase
    .from("screens")
    .select("id")
    .eq("screen_token", body.screen_token)
    .single();

  if (screenError || !screen) {
    return new Response(JSON.stringify({ error: "Invalid screen token" }), { status: 401, headers: CORS });
  }

  const { accepted, rejected } = validatePlayBatch(body.plays);

  if (accepted.length === 0) {
    return new Response(JSON.stringify({ inserted: 0, rejected }), { headers: CORS });
  }

  // Upsert on (screen_id, client_play_id) so a player retrying an unacked
  // flush cannot double-count plays.
  const { error: insertError, count } = await supabase
    .from("ad_plays")
    .upsert(
      accepted.map(p => ({ ...p, screen_id: screen.id })),
      { onConflict: "screen_id,client_play_id", ignoreDuplicates: true, count: "exact" },
    );

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), { status: 500, headers: CORS });
  }

  return new Response(JSON.stringify({ inserted: count ?? accepted.length, rejected }), { headers: CORS });
});
```

- [ ] **Step 2: Deploy the function**

Run: `pnpm dlx supabase functions deploy ingest-plays`
Expected: deploy succeeds.

- [ ] **Step 3: Verify rejection of a bad token**

Run (substituting the project ref):
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "https://<project-ref>.supabase.co/functions/v1/ingest-plays" -H "content-type: application/json" -d '{"screen_token":"00000000-0000-0000-0000-000000000000","plays":[]}'
```
Expected: `401`.

- [ ] **Step 4: Verify a real play inserts once and is idempotent**

Using a real `screen_token` and a real `bookings.id` from the dev project, POST the same body twice:
```bash
curl -s -X POST "https://<project-ref>.supabase.co/functions/v1/ingest-plays" -H "content-type: application/json" -d '{"screen_token":"<token>","plays":[{"campaign_id":"<booking-id>","client_play_id":"manual-test-1","played_at":"2026-07-24T11:00:00Z","duration_s":10,"completed":true}]}'
```
Expected: first call returns `{"inserted":1,...}`; second returns `{"inserted":0,...}`. Then confirm exactly one row:
```bash
pnpm dlx supabase db execute "select count(*) from ad_plays where client_play_id = 'manual-test-1'"
```
Expected: `1`.

- [ ] **Step 5: Clean up the manual test row**

```bash
pnpm dlx supabase db execute "delete from ad_plays where client_play_id = 'manual-test-1'"
```

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/ingest-plays/index.ts
git commit -m "feat: add ingest-plays edge function for proof-of-play batches"
```

---

## Task 8: Player emits plays

**Files:**
- Create: `src/lib/playBuffer.js`, `src/lib/playBuffer.test.js`
- Modify: `src/views/display/DisplayPlayer.jsx`

The buffer is a pure module so it can be tested without rendering the player. It survives a reload via `localStorage`, because a screen that loses connectivity must not lose its proof of play.

- [ ] **Step 1: Write the failing test at `src/lib/playBuffer.test.js`**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { createPlayBuffer, FLUSH_AT } from './playBuffer.js';

const storage = () => {
  const map = new Map();
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: k => map.delete(k),
  };
};

describe('createPlayBuffer', () => {
  let store;
  beforeEach(() => { store = storage(); });

  it('starts empty', () => {
    expect(createPlayBuffer({ storage: store }).size()).toBe(0);
  });

  it('records a play with a generated id when none is given', () => {
    const buf = createPlayBuffer({ storage: store, newId: () => 'gen-1' });
    buf.record({ campaign_id: 'c1', duration_s: 10, played_at: '2026-07-24T11:00:00Z' });
    expect(buf.pending()[0]).toEqual({
      campaign_id: 'c1',
      duration_s: 10,
      played_at: '2026-07-24T11:00:00Z',
      client_play_id: 'gen-1',
      completed: true,
    });
  });

  it('ignores a play with no campaign_id', () => {
    const buf = createPlayBuffer({ storage: store });
    buf.record({ duration_s: 10 });
    expect(buf.size()).toBe(0);
  });

  it('ignores a play with a non-positive duration', () => {
    const buf = createPlayBuffer({ storage: store });
    buf.record({ campaign_id: 'c1', duration_s: 0 });
    expect(buf.size()).toBe(0);
  });

  it('persists pending plays to storage', () => {
    const buf = createPlayBuffer({ storage: store, newId: () => 'gen-1' });
    buf.record({ campaign_id: 'c1', duration_s: 10 });
    expect(JSON.parse(store.getItem('adgrid.playBuffer'))).toHaveLength(1);
  });

  it('restores pending plays from storage on construction', () => {
    store.setItem('adgrid.playBuffer', JSON.stringify([{ campaign_id: 'c1', client_play_id: 'x', duration_s: 5, played_at: 'z', completed: true }]));
    expect(createPlayBuffer({ storage: store }).size()).toBe(1);
  });

  it('recovers from corrupt stored data instead of throwing', () => {
    store.setItem('adgrid.playBuffer', '{not json');
    expect(createPlayBuffer({ storage: store }).size()).toBe(0);
  });

  it('reports shouldFlush once FLUSH_AT plays are buffered', () => {
    const buf = createPlayBuffer({ storage: store, newId: () => Math.random().toString() });
    for (let i = 0; i < FLUSH_AT - 1; i++) buf.record({ campaign_id: 'c1', duration_s: 10 });
    expect(buf.shouldFlush()).toBe(false);
    buf.record({ campaign_id: 'c1', duration_s: 10 });
    expect(buf.shouldFlush()).toBe(true);
  });

  it('clears only the plays that were taken, keeping ones recorded mid-flush', () => {
    const ids = ['a', 'b', 'c'];
    let i = 0;
    const buf = createPlayBuffer({ storage: store, newId: () => ids[i++] });
    buf.record({ campaign_id: 'c1', duration_s: 10 }); // a
    buf.record({ campaign_id: 'c1', duration_s: 10 }); // b
    const taken = buf.take();
    buf.record({ campaign_id: 'c1', duration_s: 10 }); // c, arrives during the flush
    buf.ack(taken);
    expect(buf.pending().map(p => p.client_play_id)).toEqual(['c']);
  });

  it('restores taken plays when a flush fails', () => {
    const buf = createPlayBuffer({ storage: store, newId: () => 'a' });
    buf.record({ campaign_id: 'c1', duration_s: 10 });
    const taken = buf.take();
    buf.nack(taken);
    expect(buf.size()).toBe(1);
  });

  it('caps the buffer, dropping the oldest plays first', () => {
    const buf = createPlayBuffer({ storage: store, max: 3, newId: () => Math.random().toString() });
    for (let i = 0; i < 5; i++) buf.record({ campaign_id: `c${i}`, duration_s: 10 });
    expect(buf.size()).toBe(3);
    expect(buf.pending()[0].campaign_id).toBe('c2');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/lib/playBuffer.test.js`
Expected: FAIL — cannot resolve `./playBuffer.js`.

- [ ] **Step 3: Write `src/lib/playBuffer.js`**

```js
// Buffers proof-of-play records on the display device and survives reloads.
//
// A screen that loses connectivity must not lose its proof of play: the buffer
// persists to localStorage, and a failed flush returns the records to the queue
// rather than dropping them. take()/ack()/nack() keep plays recorded during an
// in-flight flush from being discarded when it succeeds.

const STORAGE_KEY = 'adgrid.playBuffer';
export const FLUSH_AT = 25;
export const FLUSH_INTERVAL_MS = 60_000;
const DEFAULT_MAX = 500;

export function createPlayBuffer({
  storage = typeof localStorage === 'undefined' ? null : localStorage,
  newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
  max = DEFAULT_MAX,
} = {}) {
  let queue = load();

  function load() {
    if (!storage) return [];
    try {
      const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function persist() {
    if (!storage) return;
    try { storage.setItem(STORAGE_KEY, JSON.stringify(queue)); } catch { /* quota — keep in memory */ }
  }

  return {
    record({ campaign_id, duration_s, played_at, completed = true, client_play_id }) {
      if (!campaign_id) return;
      const d = Number(duration_s);
      if (!Number.isFinite(d) || d <= 0) return;
      queue.push({
        campaign_id,
        client_play_id: client_play_id ?? newId(),
        played_at: played_at ?? new Date().toISOString(),
        duration_s: d,
        completed: Boolean(completed),
      });
      if (queue.length > max) queue = queue.slice(queue.length - max);
      persist();
    },
    pending() { return [...queue]; },
    size() { return queue.length; },
    shouldFlush() { return queue.length >= FLUSH_AT; },
    take() { return [...queue]; },
    ack(taken) {
      const done = new Set(taken.map(p => p.client_play_id));
      queue = queue.filter(p => !done.has(p.client_play_id));
      persist();
    },
    // A failed flush leaves the queue untouched — take() never removed the
    // records — so nack only has to re-persist. It accepts the taken batch for
    // symmetry with ack() and so callers cannot mix the two up.
    nack(_taken) { persist(); },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/lib/playBuffer.test.js`
Expected: PASS, 11 tests.

- [ ] **Step 5: Wire the buffer into `src/views/display/DisplayPlayer.jsx`**

Add to the imports at the top:

```js
import { createPlayBuffer, FLUSH_INTERVAL_MS } from '../../lib/playBuffer.js';
```

Inside the `DisplayPlayer` component, next to the other refs, add:

```js
  const playBufferRef = useRef(null);
  if (playBufferRef.current === null) playBufferRef.current = createPlayBuffer();
  const playStartRef = useRef(null);
```

Add this effect after the existing rotate effect. It records a play when a creative stops being shown — on rotation, on feed change, and on unmount — so `duration_s` is the time the creative was actually on the glass, not the nominal slot length:

```js
  // Record proof of play for the creative that is leaving the screen.
  // This records THAT a creative played — never who saw it. Audience data
  // comes only from the CV agent (see the note above).
  useEffect(() => {
    const current = campaigns[currentIdx];
    if (status !== 'ok' || !current || !screenId) return;

    playStartRef.current = Date.now();
    const campaignId = current.id;

    return () => {
      const startedAt = playStartRef.current;
      if (!startedAt) return;
      const durationS = (Date.now() - startedAt) / 1000;
      if (durationS <= 0) return;
      playBufferRef.current.record({
        campaign_id: campaignId,
        played_at: new Date(startedAt).toISOString(),
        duration_s: durationS,
        completed: durationS >= (ROTATE_INTERVAL_MS / 1000) * 0.9,
      });
    };
  }, [campaigns, currentIdx, status, screenId]);
```

Add the flush effect below it:

```js
  // Flush buffered plays every 60s, and whenever the buffer fills.
  useEffect(() => {
    if (!screenToken) return;

    const flush = async () => {
      const buffer = playBufferRef.current;
      const taken = buffer.take();
      if (taken.length === 0) return;
      try {
        const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/ingest-plays`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ screen_token: screenToken, plays: taken }),
        });
        if (res.ok) buffer.ack(taken);
        else buffer.nack(taken);
      } catch {
        buffer.nack(taken);
      }
    };

    const timer = setInterval(flush, FLUSH_INTERVAL_MS);
    return () => { clearInterval(timer); flush(); };
  }, [screenToken]);
```

- [ ] **Step 6: Verify against a running player**

Start the dev server via the preview tooling (not `pnpm dev` in a shell), open the display route with a valid screen token, leave it running for two rotations plus one flush interval, then check:

```bash
pnpm dlx supabase db execute "select campaign_id, duration_s, completed, played_at from ad_plays order by played_at desc limit 5"
```
Expected: one row per rotation, `duration_s` near 10 (the `ROTATE_INTERVAL_MS`), `completed = true`.

- [ ] **Step 7: Verify the full suite and the build**

Run: `pnpm test && pnpm lint && pnpm build`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/playBuffer.js src/lib/playBuffer.test.js src/views/display/DisplayPlayer.jsx
git commit -m "feat: display player records and flushes proof of play"
```

---

## Task 9: Venue footfall curves (pure module)

**Files:**
- Create: `src/lib/footfallCurves.js`, `src/lib/footfallCurves.test.js`

Used as the modelled fallback wherever camera data is too sparse, and reused by the Phase 5 forecast engine. Read `src/lib/venueTypes.js` first to use the exact `venue_category` values this codebase already stores on `screens`.

- [ ] **Step 1: Write the failing test at `src/lib/footfallCurves.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { hourlyShare, modelledPeoplePerMin, VENUE_CURVES } from './footfallCurves.js';

describe('hourlyShare', () => {
  it('returns 24 weights for a known venue category', () => {
    expect(hourlyShare('retail')).toHaveLength(24);
  });

  it('weights sum to 1 for every defined curve', () => {
    for (const key of Object.keys(VENUE_CURVES)) {
      const sum = hourlyShare(key).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 5);
    }
  });

  it('falls back to the default curve for an unknown category', () => {
    expect(hourlyShare('space-station')).toEqual(hourlyShare('default'));
  });

  it('puts transit peaks at commute hours, not at 3am', () => {
    const transit = hourlyShare('transit');
    expect(transit[8]).toBeGreaterThan(transit[3]);
    expect(transit[17]).toBeGreaterThan(transit[3]);
  });
});

describe('modelledPeoplePerMin', () => {
  it('spreads a monthly footfall estimate across the hour weights', () => {
    // 30000 people/month over 30 days = 1000/day. With 10% of the day's
    // traffic in hour 12, that hour sees 100 people over 60 minutes.
    const rate = modelledPeoplePerMin({ monthlyTraffic: 30_000, venueCategory: 'retail', hour: 12 });
    expect(rate).toBeCloseTo((1000 * hourlyShare('retail')[12]) / 60, 5);
  });

  it('returns 0 when the monthly estimate is missing or non-positive', () => {
    expect(modelledPeoplePerMin({ monthlyTraffic: null, venueCategory: 'retail', hour: 12 })).toBe(0);
    expect(modelledPeoplePerMin({ monthlyTraffic: 0, venueCategory: 'retail', hour: 12 })).toBe(0);
    expect(modelledPeoplePerMin({ monthlyTraffic: -5, venueCategory: 'retail', hour: 12 })).toBe(0);
  });

  it('returns 0 for an out-of-range hour', () => {
    expect(modelledPeoplePerMin({ monthlyTraffic: 30_000, venueCategory: 'retail', hour: 24 })).toBe(0);
    expect(modelledPeoplePerMin({ monthlyTraffic: 30_000, venueCategory: 'retail', hour: -1 })).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/lib/footfallCurves.test.js`
Expected: FAIL — cannot resolve `./footfallCurves.js`.

- [ ] **Step 3: Write `src/lib/footfallCurves.js`**

```js
// Modelled hourly footfall shapes by venue category.
//
// Used ONLY where camera data is too sparse to measure an audience. Anything
// derived from these curves must be labelled basis = 'modelled' in the UI —
// never presented as measured.

const NIGHT = 0;

// Raw relative weights per hour 0–23; normalized to sum to 1 on read.
const RAW = {
  //          0  1  2  3  4  5   6   7   8   9  10  11  12  13  14  15  16  17  18  19  20  21 22 23
  default:  [1, 1, NIGHT, NIGHT, 1, 2, 4, 6, 8, 7, 7, 8, 9, 8, 7, 7, 8, 9, 8, 6, 5, 4, 3, 2],
  transit:  [1, 1, NIGHT, NIGHT, 1, 3, 7, 12, 15, 9, 6, 6, 7, 6, 6, 7, 10, 14, 11, 7, 4, 3, 2, 1],
  retail:   [NIGHT, NIGHT, NIGHT, NIGHT, NIGHT, 1, 2, 3, 5, 7, 9, 10, 11, 10, 10, 10, 10, 9, 8, 6, 4, 2, 1, NIGHT],
  outdoor:  [1, 1, 1, 1, 1, 2, 4, 7, 9, 8, 8, 8, 9, 8, 8, 8, 9, 10, 9, 7, 5, 4, 3, 2],
  office:   [NIGHT, NIGHT, NIGHT, NIGHT, NIGHT, 1, 3, 8, 13, 11, 9, 9, 11, 10, 9, 9, 9, 8, 5, 2, 1, NIGHT, NIGHT, NIGHT],
  leisure:  [2, 1, 1, NIGHT, NIGHT, NIGHT, 1, 2, 3, 4, 5, 7, 8, 8, 8, 8, 9, 10, 11, 11, 10, 8, 6, 4],
  health:   [NIGHT, NIGHT, NIGHT, NIGHT, NIGHT, 1, 3, 6, 10, 11, 11, 10, 9, 9, 9, 8, 7, 5, 3, 2, 1, NIGHT, NIGHT, NIGHT],
};

function normalize(weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  return total === 0 ? weights.map(() => 0) : weights.map(w => w / total);
}

export const VENUE_CURVES = Object.fromEntries(
  Object.entries(RAW).map(([key, weights]) => [key, normalize(weights)]),
);

export function hourlyShare(venueCategory) {
  const key = String(venueCategory ?? '').toLowerCase();
  return VENUE_CURVES[key] ?? VENUE_CURVES.default;
}

export function modelledPeoplePerMin({ monthlyTraffic, venueCategory, hour, daysInMonth = 30 }) {
  const monthly = Number(monthlyTraffic);
  const h = Number(hour);
  if (!Number.isFinite(monthly) || monthly <= 0) return 0;
  if (!Number.isInteger(h) || h < 0 || h > 23) return 0;
  const perDay = monthly / daysInMonth;
  return (perDay * hourlyShare(venueCategory)[h]) / 60;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/lib/footfallCurves.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 5: Map the curve keys to the codebase's real venue categories**

Read `src/lib/venueTypes.js`. If `VENUE_TAXONOMY` uses different top-level keys than `transit / retail / outdoor / office / leisure / health`, add an explicit mapping object in `footfallCurves.js` from the taxonomy's keys to these curve keys, plus a test asserting every taxonomy key maps to a defined curve:

```js
import { VENUE_TAXONOMY } from './venueTypes.js';

it('maps every venue taxonomy category to a defined curve', () => {
  for (const key of Object.keys(VENUE_TAXONOMY)) {
    expect(hourlyShare(curveKeyFor(key))).not.toBe(VENUE_CURVES.default);
  }
});
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/footfallCurves.js src/lib/footfallCurves.test.js
git commit -m "feat: add modelled venue footfall curves"
```

---

## Task 10: Audience index materialized view

**Files:**
- Create: `supabase/migrations/20260724000001_screen_audience_index.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- Audience index: measured people-per-minute by screen, day-of-week and hour,
-- aggregated from the CV agent's impression_events.
--
-- This is the multiplier that converts a proof-of-play into an
-- audience-weighted impression, per the IAB DOOH definition.
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.screen_audience_index AS
SELECT
  screen_id,
  EXTRACT(dow  FROM window_start)::int AS dow,
  EXTRACT(hour FROM window_start)::int AS hour,
  avg(people_count / GREATEST(EXTRACT(EPOCH FROM (window_end - window_start)) / 60.0, 1)) AS people_per_min,
  avg(avg_dwell_seconds)   AS avg_dwell_s,
  avg(avg_attention_score) AS avg_attention,
  count(*)                 AS sample_windows
FROM public.impression_events
WHERE window_end > window_start
GROUP BY 1, 2, 3;

CREATE UNIQUE INDEX IF NOT EXISTS screen_audience_index_key
  ON public.screen_audience_index (screen_id, dow, hour);

-- A (screen, dow, hour) cell with fewer than this many sampled windows is not
-- trusted as measured; callers fall back to the modelled curve and label the
-- result accordingly.
CREATE OR REPLACE FUNCTION public.audience_min_samples() RETURNS int
  LANGUAGE sql IMMUTABLE AS $$ SELECT 20 $$;

GRANT SELECT ON public.screen_audience_index TO authenticated;

-- Refresh hourly, alongside the existing crons. CONCURRENTLY requires the
-- unique index created above.
SELECT cron.schedule(
  'refresh-screen-audience-index',
  '7 * * * *',
  $$ REFRESH MATERIALIZED VIEW CONCURRENTLY public.screen_audience_index $$
);
```

- [ ] **Step 2: Apply it**

Run: `pnpm dlx supabase db push`
Expected: applied with no errors.

- [ ] **Step 3: Verify the view returns rows for screens that have CV data**

Run:
```bash
pnpm dlx supabase db execute "select screen_id, dow, hour, round(people_per_min::numeric, 2) ppm, sample_windows from screen_audience_index order by sample_windows desc limit 10"
```
Expected: rows for any screen with `impression_events`. Zero rows is acceptable only if `impression_events` is itself empty — confirm with `select count(*) from impression_events`.

- [ ] **Step 4: Verify the refresh job is registered**

Run: `pnpm dlx supabase db execute "select jobname, schedule from cron.job where jobname = 'refresh-screen-audience-index'"`
Expected: one row, schedule `7 * * * *`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260724000001_screen_audience_index.sql
git commit -m "feat: add measured screen audience index materialized view"
```

---

## Task 11: `campaign_delivery_daily` view

**Files:**
- Create: `supabase/migrations/20260724000003_campaign_delivery_daily.sql`

Every product surface reads this view. Nothing reads `ad_plays` directly.

**Do Task 12's migration first** (or write both files before pushing) — this view depends on the `scans.is_bot` / `scans.is_duplicate` columns it creates.

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- The single delivery source of truth: one row per campaign, screen and day.
--
-- plays        — proof of play, counted from ad_plays
-- impressions  — plays weighted by measured audience where available,
--                otherwise by the modelled venue curve; `basis` says which
-- attention    — audience-weighted CV attention, only ever measured
-- ============================================================

CREATE OR REPLACE VIEW public.campaign_delivery_daily AS
WITH play_days AS (
  SELECT
    p.campaign_id,
    p.screen_id,
    (p.played_at AT TIME ZONE COALESCE(s.timezone, 'UTC'))::date AS day,
    EXTRACT(dow  FROM p.played_at AT TIME ZONE COALESCE(s.timezone, 'UTC'))::int AS dow,
    EXTRACT(hour FROM p.played_at AT TIME ZONE COALESCE(s.timezone, 'UTC'))::int AS hour,
    p.duration_s,
    p.completed,
    s.venue_category,
    s.monthly_traffic_estimate
  FROM public.ad_plays p
  JOIN public.screens s ON s.id = p.screen_id
),
weighted AS (
  SELECT
    pd.campaign_id,
    pd.screen_id,
    pd.day,
    pd.completed,
    CASE
      WHEN ai.sample_windows >= public.audience_min_samples()
        THEN ai.people_per_min * (pd.duration_s / 60.0)
      ELSE
        -- Modelled fallback: monthly estimate spread evenly across the day's
        -- 18 operating hours. The precise venue curve lives in
        -- src/lib/footfallCurves.js and is applied client-side for forecasts;
        -- this SQL fallback stays deliberately flat and conservative.
        (COALESCE(pd.monthly_traffic_estimate, 0) / 30.0 / 18.0 / 60.0) * pd.duration_s
    END AS impressions,
    CASE
      WHEN ai.sample_windows >= public.audience_min_samples() THEN 'measured'
      ELSE 'modelled'
    END AS basis,
    CASE
      WHEN ai.sample_windows >= public.audience_min_samples()
        THEN ai.people_per_min * (pd.duration_s / 60.0) * COALESCE(ai.avg_attention, 0)
      ELSE NULL
    END AS attention_weighted
  FROM play_days pd
  LEFT JOIN public.screen_audience_index ai
    ON ai.screen_id = pd.screen_id AND ai.dow = pd.dow AND ai.hour = pd.hour
),
scan_days AS (
  SELECT
    campaign_id,
    screen_id,
    (scanned_at AT TIME ZONE 'UTC')::date AS day,
    count(*) AS scans,
    count(*) FILTER (WHERE NOT is_bot AND NOT is_duplicate) AS billable_scans
  FROM public.scans
  GROUP BY 1, 2, 3
)
SELECT
  w.campaign_id,
  w.screen_id,
  w.day,
  count(*)                                   AS plays,
  count(*) FILTER (WHERE w.completed)        AS completed_plays,
  round(sum(w.impressions))::bigint          AS impressions,
  round(sum(w.attention_weighted))::bigint   AS attention_weighted_impressions,
  CASE WHEN bool_and(w.basis = 'measured') THEN 'measured'
       WHEN bool_or(w.basis = 'measured')  THEN 'mixed'
       ELSE 'modelled' END                   AS basis,
  COALESCE(sd.scans, 0)                      AS scans,
  COALESCE(sd.billable_scans, 0)             AS billable_scans
FROM weighted w
LEFT JOIN scan_days sd
  ON sd.campaign_id = w.campaign_id AND sd.screen_id = w.screen_id AND sd.day = w.day
GROUP BY w.campaign_id, w.screen_id, w.day, sd.scans, sd.billable_scans;

GRANT SELECT ON public.campaign_delivery_daily TO authenticated;
```

- [ ] **Step 2: Apply and verify**

Run: `pnpm dlx supabase db push`
Then:
```bash
pnpm dlx supabase db execute "select campaign_id, day, plays, impressions, basis, scans, billable_scans from campaign_delivery_daily order by day desc limit 10"
```
Expected: rows appear for any campaign with plays; `basis` is `measured`, `mixed`, or `modelled`; `impressions >= plays` wherever any audience is present.

- [ ] **Step 3: Verify RLS is inherited correctly**

The view is not security-definer, so the caller's RLS on `ad_plays` and `scans` applies. Confirm an advertiser sees only their own campaigns:
```bash
pnpm dlx supabase db execute "select count(distinct campaign_id) from campaign_delivery_daily"
```
Run once as service role and once under an advertiser JWT; the advertiser's count must be ≤ their own campaign count.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260724000002_campaign_delivery_daily.sql
git commit -m "feat: add campaign_delivery_daily as the single delivery source"
```

---

## Task 12: Scan quality — bot and duplicate filtering

**Files:**
- Create: `supabase/migrations/20260724000002_scan_quality.sql`, `supabase/functions/_shared/scanQuality.ts`, `supabase/functions/_shared/scanQuality.test.js`
- Modify: `supabase/functions/scan-redirect/index.ts`

- [ ] **Step 1: Write the migration**

```sql
-- Scan quality flags. Rows are always inserted so the audit trail stays
-- complete; reporting excludes flagged rows and shows the advertiser how many
-- were filtered. Filtering is disclosed, never silent.

ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS is_bot       boolean NOT NULL DEFAULT false;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS is_duplicate boolean NOT NULL DEFAULT false;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS dedup_key    text;

CREATE INDEX IF NOT EXISTS scans_dedup_lookup_idx
  ON public.scans (dedup_key, scanned_at DESC)
  WHERE dedup_key IS NOT NULL;
```

- [ ] **Step 2: Write the failing test at `supabase/functions/_shared/scanQuality.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { isBotUserAgent, dedupKey, DEDUP_WINDOW_MS } from './scanQuality.ts';

describe('isBotUserAgent', () => {
  it('flags known crawlers and link previewers', () => {
    for (const ua of [
      'facebookexternalhit/1.1',
      'Slackbot-LinkExpanding 1.0',
      'WhatsApp/2.23',
      'Mozilla/5.0 (compatible; Googlebot/2.1)',
      'curl/8.4.0',
      'Wget/1.21',
      'HeadlessChrome/120.0.0.0',
      'Twitterbot/1.0',
    ]) {
      expect(isBotUserAgent(ua)).toBe(true);
    }
  });

  it('does not flag a real phone browser', () => {
    expect(isBotUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1')).toBe(false);
  });

  it('treats a missing user agent as a bot', () => {
    expect(isBotUserAgent('')).toBe(true);
    expect(isBotUserAgent(null)).toBe(true);
  });
});

describe('dedupKey', () => {
  it('is stable for the same campaign, screen, ip and ua', async () => {
    const a = await dedupKey('c1', 's1', '1.2.3.4', 'ua');
    const b = await dedupKey('c1', 's1', '1.2.3.4', 'ua');
    expect(a).toBe(b);
  });

  it('differs when any input differs', async () => {
    const base = await dedupKey('c1', 's1', '1.2.3.4', 'ua');
    expect(await dedupKey('c2', 's1', '1.2.3.4', 'ua')).not.toBe(base);
    expect(await dedupKey('c1', 's2', '1.2.3.4', 'ua')).not.toBe(base);
    expect(await dedupKey('c1', 's1', '9.9.9.9', 'ua')).not.toBe(base);
    expect(await dedupKey('c1', 's1', '1.2.3.4', 'other')).not.toBe(base);
  });

  it('does not contain the raw ip', async () => {
    expect(await dedupKey('c1', 's1', '1.2.3.4', 'ua')).not.toContain('1.2.3.4');
  });

  it('tolerates a null screen id', async () => {
    expect(typeof await dedupKey('c1', null, '1.2.3.4', 'ua')).toBe('string');
  });

  it('uses a 30 minute window', () => {
    expect(DEDUP_WINDOW_MS).toBe(30 * 60 * 1000);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm test supabase/functions/_shared/scanQuality.test.js`
Expected: FAIL — cannot resolve `./scanQuality.ts`.

- [ ] **Step 4: Write `supabase/functions/_shared/scanQuality.ts`**

```ts
// Scan quality helpers. Pure — no Deno APIs — so vitest can run them.
// Uses Web Crypto, which exists in both Deno and Node 18+.

export const DEDUP_WINDOW_MS = 30 * 60 * 1000;

const BOT_UA = /bot|crawler|spider|preview|facebookexternalhit|slackbot|whatsapp|telegram|discord|curl|wget|python-requests|headless|lighthouse|monitoring/i;

export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua || !ua.trim()) return true; // no UA at all is not a phone camera
  return BOT_UA.test(ua);
}

// SHA-256 over the identifying tuple. The raw IP is never stored — only this
// digest — so dedup does not turn the scans table into an IP log.
export async function dedupKey(
  campaignId: string,
  screenId: string | null,
  ip: string,
  ua: string,
): Promise<string> {
  const input = [campaignId, screenId ?? '', ip, ua].join('|');
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test supabase/functions/_shared/scanQuality.test.js`
Expected: PASS, 9 tests.

- [ ] **Step 6: Wire it into `supabase/functions/scan-redirect/index.ts`**

Add the import at the top:

```ts
import { isBotUserAgent, dedupKey, DEDUP_WINDOW_MS } from "../_shared/scanQuality.ts";
```

Replace the scan insert block (the `const { data: scanRow } = await supabase.from("scans").insert({…})` call) with:

```ts
  const ip = req.headers.get("cf-connecting-ip")
    ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    ?? "";
  const is_bot = isBotUserAgent(ua);
  const key = await dedupKey(campaignId, screen_id, ip, ua);

  const { data: recent } = await supabase
    .from("scans")
    .select("id")
    .eq("dedup_key", key)
    .gte("scanned_at", new Date(Date.now() - DEDUP_WINDOW_MS).toISOString())
    .limit(1)
    .maybeSingle();

  const is_duplicate = Boolean(recent);

  const { data: scanRow } = await supabase.from("scans").insert({
    campaign_id: campaignId,
    screen_id,
    advertiser_id,
    device_type,
    country,
    utm_source: "adgrid",
    utm_medium: "ooh",
    utm_campaign: campaignId,
    is_bot,
    is_duplicate,
    dedup_key: key,
  }).select("id").single();
```

Then gate the two downstream side effects so a bot or a repeat scan cannot inflate milestones or fire a conversion pixel. Change both `if (scanRow?.id) {` guards to:

```ts
  if (scanRow?.id && !is_bot && !is_duplicate) {
```

And change the milestone count query so it counts billable scans only — replace:

```ts
        const { count } = await supabase.from("scans").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId);
```

with:

```ts
        const { count } = await supabase.from("scans")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", campaignId)
          .eq("is_bot", false)
          .eq("is_duplicate", false);
```

The redirect itself must still happen for every request, bot or not — a filtered scan is a reporting decision, not a reason to break someone's link.

- [ ] **Step 7: Deploy and verify**

Run: `pnpm dlx supabase functions deploy scan-redirect`

Then hit a live campaign's scan URL twice in quick succession with the same client, and once with `curl`:
```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://<project-ref>.supabase.co/functions/v1/scan-redirect?c=<live-campaign-id>&s=<screen-id>"
pnpm dlx supabase db execute "select is_bot, is_duplicate, count(*) from scans where campaign_id = '<live-campaign-id>' group by 1,2"
```
Expected: the `curl` hit is `is_bot = true`; the second browser hit within 30 minutes is `is_duplicate = true`; all requests still returned `302`.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260724000002_scan_quality.sql supabase/functions/_shared/scanQuality.ts supabase/functions/_shared/scanQuality.test.js supabase/functions/scan-redirect/index.ts
git commit -m "feat: filter bot and duplicate QR scans from reported counts"
```

---

## Task 13: Surface the three metrics in the advertiser dashboard

**Files:**
- Modify: `src/views/advertiser/AdvDashboard.jsx`

- [ ] **Step 1: Load delivery from the new view**

Add to the imports:

```js
import { periodDelta, splitByPeriod } from '../../lib/periodDelta.js';
```

Add a second effect alongside the existing `fetchCampaignScreens` effect:

```js
  const [delivery, setDelivery] = useState([]);

  useEffect(() => {
    const fetchDelivery = async () => {
      const myCampaignIds = campaigns
        .filter(c => c.advertiser_id === advertiserId)
        .map(c => c.id);
      if (myCampaignIds.length === 0) { setDelivery([]); return; }

      const { data, error } = await supabase
        .from('campaign_delivery_daily')
        .select('campaign_id, day, plays, impressions, attention_weighted_impressions, basis, scans, billable_scans')
        .in('campaign_id', myCampaignIds);

      if (!error && data) setDelivery(data);
    };
    fetchDelivery();
  }, [campaigns, advertiserId]);
```

- [ ] **Step 2: Derive the totals and the honest labels**

Replace the four `total*` consts with:

```js
  const myCampaigns = campaigns.filter(c => c.advertiser_id === advertiserId);
  const totalSpend  = myCampaigns.reduce((a, c) => a + c.budget, 0);
  const totalSpent  = myCampaigns.reduce((a, c) => a + c.spent, 0);

  const sum = (key) => delivery.reduce((a, r) => a + (Number(r[key]) || 0), 0);
  const totalPlays    = sum('plays');
  const totalImpr     = sum('impressions');
  const totalScans    = sum('scans');
  const billableScans = sum('billable_scans');
  const filteredScans = totalScans - billableScans;

  // Any modelled row makes the whole figure partly modelled — say so.
  const allMeasured = delivery.length > 0 && delivery.every(r => r.basis === 'measured');
  const imprBasisLabel = delivery.length === 0
    ? 'no delivery yet'
    : allMeasured ? 'measured by camera' : 'part measured, part modelled';

  const imprPeriods = splitByPeriod(delivery, 'day', 'impressions', 30);
  const imprTrend   = periodDelta(imprPeriods.current, imprPeriods.prior);
```

- [ ] **Step 3: Replace the KPI row with the three-metric version**

```jsx
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        <KPI label="Spent to Date" value={`$${totalSpent.toLocaleString()}`} sub={`${totalSpend > 0 ? Math.round((totalSpent / totalSpend) * 100) : 0}% of $${totalSpend.toLocaleString()} budget`} color={C.blue} />
        <KPI label="Plays"         value={totalPlays.toLocaleString()}       sub="verified proof of play" />
        <KPI label="Impressions"   value={`${(totalImpr / 1000).toFixed(1)}K`} sub={imprBasisLabel} color={C.purple} trend={imprTrend} trendLabel="vs prior 30 days" />
        <KPI label="QR Scans"      value={billableScans.toLocaleString()}
             sub={filteredScans > 0 ? `${filteredScans} filtered as bot/duplicate` : 'leads captured'}
             color={C.green} icon="📲" />
      </div>
```

- [ ] **Step 4: Verify in the running app**

Open the advertiser dashboard for an account with a campaign that has plays. Confirm: Plays shows a whole number, Impressions is labelled measured or mixed, QR Scans shows the billable count with the filtered count disclosed underneath, and no trend arrow appears where there is no prior-period data.

- [ ] **Step 5: Run the full suite, lint and build**

Run: `pnpm test && pnpm lint && pnpm build`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/views/advertiser/AdvDashboard.jsx
git commit -m "feat: advertiser dashboard reports plays, impressions and scans separately"
```

---

## Task 14: Phase 1 verification pass

**Files:** none created; this is the acceptance gate before Phase 2.

- [ ] **Step 1: No fabricated values remain**

Run: `grep -rnE "trend=\{[0-9]" src/`
Expected: no output.

- [ ] **Step 2: Full test suite passes**

Run: `pnpm test`
Expected: all suites pass. Record the count.

- [ ] **Step 3: Lint and build pass**

Run: `pnpm lint && pnpm build`
Expected: both exit 0.

- [ ] **Step 4: End-to-end delivery check against the dev project**

```bash
pnpm dlx supabase db execute "select count(*) as plays from ad_plays"
pnpm dlx supabase db execute "select basis, count(*) from campaign_delivery_daily group by 1"
pnpm dlx supabase db execute "select is_bot, is_duplicate, count(*) from scans group by 1,2"
```
Expected: plays > 0 after the player has run; delivery rows carry a basis; scan flags are populated on rows created since Task 12 deployed.

- [ ] **Step 5: Confirm the acceptance criteria from the spec**

- A play on a real screen produces exactly one `ad_plays` row, and a retried flush produces none.
- Advertiser-facing impressions come from `campaign_delivery_daily`, never a direct write.
- A repeated QR scan within 30 minutes increments total scans but not billable scans, and the advertiser is told how many were filtered.
- No hardcoded trend value remains anywhere in `src/`.
- Nothing modelled is presented as measured.

- [ ] **Step 6: Commit the checked-off plan**

```bash
git add docs/superpowers/plans/2026-07-24-phase1-measurement-foundation.md
git commit -m "docs: mark phase 1 measurement foundation complete"
```
