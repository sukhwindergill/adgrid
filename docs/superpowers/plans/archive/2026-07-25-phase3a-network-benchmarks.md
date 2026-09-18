# Phase 3A: Network Benchmarks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tell an advertiser whether their scan rate is good — "0.42%, median is 0.31% for Fitness on Retail-Indoor" — and tell an operator whether their CPM floor is under market. This is the feature marketers consistently name as decisive in Klaviyo, and it compounds: every campaign makes it more accurate, and a new entrant cannot fake it.

**Architecture:** A materialized view computes percentiles per `(venue_category, environment, campaign_category)` from `campaign_delivery_daily`, published only for groups that clear a k-anonymity floor. A pure module turns a value plus a percentile row into a human comparison. The UI states plainly when a group has too little data rather than rendering an empty chart.

**Tech Stack:** Supabase Postgres (materialized view + pg_cron), React 19 (JS), vitest.

**Depends on:** Phase 1 (`campaign_delivery_daily`).

---

## ⚠️ Read this before deciding to build it

**Benchmarks will publish nothing on today's data, and that is the correct behaviour.** Verified against production on 2026-07-25:

| | Count |
|---|---|
| Campaigns | 5 |
| Distinct advertisers | 3 |
| Distinct campaign categories | 5 |
| Screens | 12 |
| Distinct venue categories | 1 |

With a k-anonymity floor of ≥5 campaigns **and** ≥3 advertisers per group, and 5 campaigns spread across 5 categories, **every group has roughly one campaign — so zero groups qualify.** The materialized view will be empty and every surface will show "not enough comparable campaigns yet".

That is not a bug and the plan must not be "fixed" by lowering the floor. A benchmark computed from one other advertiser's campaign both misleads the viewer and leaks that advertiser's performance. **Build this when the network has volume; build [Phase 3B](2026-07-25-phase3b-reports-and-sharing.md) first.** Task 6 exists specifically to prove the empty state is reached honestly.

---

## Context an engineer needs before starting

**Verified against production on 2026-07-25.**

- **IDs are `text`:** `bookings.id`, `screens.id`, `campaign_screens.campaign_id/screen_id`. `bookings.advertiser_id` and `screens.operator_id` are `uuid`.
- **Grouping keys:** `bookings.category` (campaign side) and `screens.venue_category` + `screens.environment` (supply side). `venue_category` values match `VENUE_TAXONOMY` keys in `src/lib/venueTypes.js` (`food_drink`, `fitness`, `retail`, `transport`, `healthcare`, `hospitality`, `education`, `entertainment`, `other`).
- **`campaign_delivery_daily`** gives `campaign_id, screen_id, day, plays, impressions, basis, scans, billable_scans`. Always use `billable_scans` — raw `scans` includes bots and duplicates.
- **A materialized view does not enforce RLS.** Whatever is granted is readable in full. That is acceptable here **only because** the view contains no per-campaign or per-advertiser rows — just aggregates over groups that already cleared the k-anonymity floor. Any change that adds an identifying column to this view is a data leak; do not add `campaign_id`, `advertiser_id`, or `screen_id`.
- **Refresh pattern to copy:** `screen_audience_index` (Phase 1) — unique index, `REFRESH MATERIALIZED VIEW CONCURRENTLY`, pg_cron job.
- Run `pnpm test`. `pnpm lint` is not a usable gate; lint only files you touched against a `git stash` baseline.

---

## File Structure

**Created:**
| Path | Responsibility |
|---|---|
| `src/lib/benchmark.js` | Pure: compare a value against a percentile row |
| `src/lib/benchmark.test.js` | Tests for the above |
| `supabase/migrations/20260726000010_benchmark_stats.sql` | Materialized view + k-anonymity + refresh cron |
| `src/components/shared/BenchmarkRow.jsx` | "You vs. network median" line |
| `src/components/shared/BenchmarkRow.test.jsx` | Tests for the above |

**Modified:**
| Path | Change |
|---|---|
| `src/views/operator/Analytics.jsx` | Show the benchmark comparison for scan rate |

---

## Task 1: Benchmark comparison (pure)

**Files:**
- Create: `src/lib/benchmark.js`, `src/lib/benchmark.test.js`

- [ ] **Step 1: Write the failing test at `src/lib/benchmark.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { compareToBenchmark, MIN_CAMPAIGNS, MIN_ADVERTISERS } from './benchmark.js';

const stats = { p25: 0.2, p50: 0.31, p75: 0.5, campaign_count: 12, advertiser_count: 6 };

describe('compareToBenchmark', () => {
  it('reports a value above the median', () => {
    const r = compareToBenchmark(0.42, stats);
    expect(r.available).toBe(true);
    expect(r.position).toBe('above_median');
    expect(r.median).toBe(0.31);
  });

  it('reports a value below the median', () => {
    expect(compareToBenchmark(0.25, stats).position).toBe('below_median');
  });

  it('reports top quartile', () => {
    expect(compareToBenchmark(0.6, stats).position).toBe('top_quartile');
  });

  it('reports bottom quartile', () => {
    expect(compareToBenchmark(0.1, stats).position).toBe('bottom_quartile');
  });

  it('treats a value exactly at the median as at_median', () => {
    expect(compareToBenchmark(0.31, stats).position).toBe('at_median');
  });

  it('computes the percent difference from the median', () => {
    // 0.42 vs 0.31 median -> +35%
    expect(compareToBenchmark(0.42, stats).pctVsMedian).toBe(35);
  });

  it('reports unavailable when there is no stats row', () => {
    const r = compareToBenchmark(0.42, null);
    expect(r.available).toBe(false);
    expect(r.reason).toBe('no_data');
  });

  it('reports unavailable below the campaign floor', () => {
    const r = compareToBenchmark(0.42, { ...stats, campaign_count: MIN_CAMPAIGNS - 1 });
    expect(r.available).toBe(false);
    expect(r.reason).toBe('insufficient_sample');
  });

  it('reports unavailable below the advertiser floor, even with many campaigns', () => {
    // One advertiser running 50 campaigns is not a benchmark — publishing it
    // would expose that single advertiser's performance.
    const r = compareToBenchmark(0.42, { ...stats, campaign_count: 50, advertiser_count: MIN_ADVERTISERS - 1 });
    expect(r.available).toBe(false);
    expect(r.reason).toBe('insufficient_sample');
  });

  it('reports unavailable for a non-numeric value', () => {
    expect(compareToBenchmark(null, stats).reason).toBe('no_value');
    expect(compareToBenchmark(NaN, stats).reason).toBe('no_value');
  });

  it('does not divide by a zero median', () => {
    const r = compareToBenchmark(0.4, { ...stats, p50: 0 });
    expect(r.pctVsMedian).toBeNull();
  });

  it('enforces a k-anonymity floor of at least 5 campaigns and 3 advertisers', () => {
    expect(MIN_CAMPAIGNS).toBeGreaterThanOrEqual(5);
    expect(MIN_ADVERTISERS).toBeGreaterThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/lib/benchmark.test.js`
Expected: FAIL — cannot resolve `./benchmark.js`.

- [ ] **Step 3: Write `src/lib/benchmark.js`**

```js
// Comparing one campaign against the network.
//
// Every path fails to "unavailable" rather than to a number. A benchmark drawn
// from too few campaigns is worse than none: it misleads the viewer AND leaks
// the performance of the handful of advertisers it was computed from.

export const MIN_CAMPAIGNS = 5;
export const MIN_ADVERTISERS = 3;

export function compareToBenchmark(value, stats) {
  const v = Number(value);
  if (value === null || value === undefined || !Number.isFinite(v)) {
    return { available: false, reason: 'no_value' };
  }
  if (!stats) return { available: false, reason: 'no_data' };

  const campaigns = Number(stats.campaign_count) || 0;
  const advertisers = Number(stats.advertiser_count) || 0;
  if (campaigns < MIN_CAMPAIGNS || advertisers < MIN_ADVERTISERS) {
    return { available: false, reason: 'insufficient_sample' };
  }

  const p25 = Number(stats.p25);
  const p50 = Number(stats.p50);
  const p75 = Number(stats.p75);

  let position;
  if (v >= p75) position = 'top_quartile';
  else if (v <= p25) position = 'bottom_quartile';
  else if (v > p50) position = 'above_median';
  else if (v < p50) position = 'below_median';
  else position = 'at_median';

  const pctVsMedian = Number.isFinite(p50) && p50 !== 0
    ? Math.round(((v - p50) / p50) * 100)
    : null;

  return { available: true, reason: null, position, median: p50, p25, p75, pctVsMedian };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/lib/benchmark.test.js`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/benchmark.js src/lib/benchmark.test.js
git commit -m "feat: add network benchmark comparison with k-anonymity floor"
```

---

## Task 2: `benchmark_stats` materialized view

**Files:**
- Create: `supabase/migrations/20260726000010_benchmark_stats.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- Network benchmarks by (venue_category, environment, campaign_category).
--
-- PUBLISHED ONLY above a k-anonymity floor: at least 5 distinct campaigns AND
-- 3 distinct advertisers per group. Below that, the group is omitted entirely
-- rather than published with a small-sample caveat — a percentile over two
-- campaigns is a description of those two advertisers, not a benchmark.
--
-- A materialized view does not enforce RLS, so this view must never carry an
-- identifying column. Do not add campaign_id, advertiser_id or screen_id.
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.benchmark_stats AS
WITH per_campaign AS (
  SELECT
    s.venue_category,
    s.environment,
    b.category                       AS campaign_category,
    d.campaign_id,
    b.advertiser_id,
    sum(d.impressions)               AS impressions,
    sum(d.billable_scans)            AS billable_scans,
    sum(d.plays)                     AS plays
  FROM public.campaign_delivery_daily d
  JOIN public.bookings b ON b.id = d.campaign_id
  JOIN public.screens  s ON s.id = d.screen_id
  GROUP BY 1, 2, 3, 4, 5
),
rated AS (
  SELECT
    venue_category,
    environment,
    campaign_category,
    campaign_id,
    advertiser_id,
    CASE WHEN impressions > 0
         THEN billable_scans::numeric / impressions * 100
         ELSE NULL END AS scan_rate_pct
  FROM per_campaign
)
SELECT
  venue_category,
  environment,
  campaign_category,
  count(DISTINCT campaign_id)                                              AS campaign_count,
  count(DISTINCT advertiser_id)                                            AS advertiser_count,
  percentile_cont(0.25) WITHIN GROUP (ORDER BY scan_rate_pct)              AS scan_rate_p25,
  percentile_cont(0.50) WITHIN GROUP (ORDER BY scan_rate_pct)              AS scan_rate_p50,
  percentile_cont(0.75) WITHIN GROUP (ORDER BY scan_rate_pct)              AS scan_rate_p75
FROM rated
WHERE scan_rate_pct IS NOT NULL
GROUP BY 1, 2, 3
HAVING count(DISTINCT campaign_id) >= 5
   AND count(DISTINCT advertiser_id) >= 3;

-- Required for REFRESH ... CONCURRENTLY.
CREATE UNIQUE INDEX IF NOT EXISTS benchmark_stats_key
  ON public.benchmark_stats (venue_category, environment, campaign_category);

GRANT SELECT ON public.benchmark_stats TO authenticated;

SELECT cron.unschedule('refresh-benchmark-stats')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-benchmark-stats');

SELECT cron.schedule(
  'refresh-benchmark-stats',
  '23 5 * * *',
  $$ REFRESH MATERIALIZED VIEW CONCURRENTLY public.benchmark_stats $$
);
```

> `campaign_delivery_daily` is owner-executed with a `current_user IN ('postgres','supabase_admin','service_role')` branch, so the matview — refreshed as `postgres` by cron — sees all rows. That is intended: it is aggregating the network. The k-anonymity floor, not row visibility, is what protects individual advertisers here.

- [ ] **Step 2: Apply via the Supabase MCP `apply_migration` (project `hkqiuwnppxkkztacwicj`, name `benchmark_stats`)**

- [ ] **Step 3: Verify it is empty, and that this is for the right reason**

```sql
select count(*) as published_groups from public.benchmark_stats;
```
Expected today: `0`.

Then confirm the cause is the floor, not a broken join:
```sql
select s.venue_category, s.environment, b.category,
       count(distinct d.campaign_id) as campaigns,
       count(distinct b.advertiser_id) as advertisers
from public.campaign_delivery_daily d
join public.bookings b on b.id = d.campaign_id
join public.screens  s on s.id = d.screen_id
group by 1,2,3 order by campaigns desc;
```
Expected: a handful of groups, each with 1–2 campaigns. If this query returns **no rows at all**, the join is broken (or `ad_plays` is still empty) — investigate before assuming the floor did its job.

- [ ] **Step 4: Verify the refresh job registered**

```sql
select jobname, schedule from cron.job where jobname = 'refresh-benchmark-stats';
```
Expected: one row, `23 5 * * *`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260726000010_benchmark_stats.sql
git commit -m "feat: add network benchmark stats with k-anonymity floor"
```

---

## Task 3: Benchmark comparison row

**Files:**
- Create: `src/components/shared/BenchmarkRow.jsx`, `src/components/shared/BenchmarkRow.test.jsx`

- [ ] **Step 1: Write the failing test at `src/components/shared/BenchmarkRow.test.jsx`**

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BenchmarkRow } from './BenchmarkRow.jsx';

const stats = { p25: 0.2, p50: 0.31, p75: 0.5, campaign_count: 12, advertiser_count: 6 };

describe('BenchmarkRow', () => {
  it('shows the comparison against the network median', () => {
    render(<BenchmarkRow label="Scan rate" value={0.42} stats={stats} format={v => `${v}%`} />);
    expect(screen.getByText(/network median 0.31%/i)).toBeInTheDocument();
  });

  it('says there is not enough data rather than showing a number', () => {
    render(<BenchmarkRow label="Scan rate" value={0.42} stats={{ ...stats, campaign_count: 2 }} format={v => `${v}%`} />);
    expect(screen.getByText(/Not enough comparable campaigns yet/i)).toBeInTheDocument();
  });

  it('says there is not enough data when no stats row exists at all', () => {
    render(<BenchmarkRow label="Scan rate" value={0.42} stats={null} format={v => `${v}%`} />);
    expect(screen.getByText(/Not enough comparable campaigns yet/i)).toBeInTheDocument();
  });

  it('renders nothing at all when the campaign has no value yet', () => {
    const { container } = render(<BenchmarkRow label="Scan rate" value={null} stats={stats} format={v => `${v}%`} />);
    expect(container.textContent).toBe('');
  });

  it('never claims a percentile when the sample is too small', () => {
    const { container } = render(<BenchmarkRow label="Scan rate" value={0.42} stats={{ ...stats, advertiser_count: 1 }} format={v => `${v}%`} />);
    expect(container.textContent).not.toMatch(/median/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/components/shared/BenchmarkRow.test.jsx`
Expected: FAIL — cannot resolve `./BenchmarkRow.jsx`.

- [ ] **Step 3: Write `src/components/shared/BenchmarkRow.jsx`**

```jsx
import { C, F } from '../../design/tokens.js';
import { compareToBenchmark } from '../../lib/benchmark.js';

const POSITION_LABEL = {
  top_quartile:    'top quartile',
  above_median:    'above median',
  at_median:       'at median',
  below_median:    'below median',
  bottom_quartile: 'bottom quartile',
};

const POSITION_COLOR = {
  top_quartile:    C.green,
  above_median:    C.green,
  at_median:       C.textSub,
  below_median:    C.amber,
  bottom_quartile: C.red,
};

// Renders nothing when the campaign has no value of its own, and says so
// plainly when the network has too little data to compare against. It never
// shows a percentile it cannot stand behind.
export function BenchmarkRow({ label, value, stats, format = v => String(v) }) {
  const result = compareToBenchmark(value, stats);

  if (!result.available && result.reason === 'no_value') return null;

  if (!result.available) {
    return (
      <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 4 }}>
        Not enough comparable campaigns yet to benchmark {label.toLowerCase()}.
      </div>
    );
  }

  return (
    <div style={{ fontSize: 11, fontFamily: F.sans, marginTop: 4, color: C.textMuted }}>
      <span style={{ color: POSITION_COLOR[result.position], fontWeight: 500 }}>
        {POSITION_LABEL[result.position]}
      </span>
      {' · '}network median {format(result.median)}
      {result.pctVsMedian !== null && ` (${result.pctVsMedian >= 0 ? '+' : ''}${result.pctVsMedian}%)`}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/components/shared/BenchmarkRow.test.jsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/BenchmarkRow.jsx src/components/shared/BenchmarkRow.test.jsx
git commit -m "feat: add benchmark comparison row with explicit empty state"
```

---

## Task 4: Surface benchmarks in Analytics

**Files:**
- Modify: `src/views/operator/Analytics.jsx`

- [ ] **Step 1: Fetch the matching benchmark group**

Add near the other data fetches:

```js
  const [benchmark, setBenchmark] = useState(null);

  useEffect(() => {
    const fetchBenchmark = async () => {
      // Match on the venue mix this account actually runs on. With one
      // dominant venue category today this is a single lookup; when the
      // network diversifies, look up per campaign instead.
      const { data } = await supabase
        .from('benchmark_stats')
        .select('venue_category, environment, campaign_category, campaign_count, advertiser_count, scan_rate_p25, scan_rate_p50, scan_rate_p75')
        .limit(1)
        .maybeSingle();
      setBenchmark(data ?? null);
    };
    fetchBenchmark();
  }, []);
```

- [ ] **Step 2: Render it under the scan-rate KPI**

Map the column names onto what `compareToBenchmark` expects, then render:

```jsx
import { BenchmarkRow } from '../../components/shared/BenchmarkRow.jsx';
```
```jsx
      <BenchmarkRow
        label="Scan rate"
        value={Number(scanRate)}
        stats={benchmark && {
          p25: benchmark.scan_rate_p25,
          p50: benchmark.scan_rate_p50,
          p75: benchmark.scan_rate_p75,
          campaign_count: benchmark.campaign_count,
          advertiser_count: benchmark.advertiser_count,
        }}
        format={v => `${Number(v).toFixed(2)}%`}
      />
```

Place it directly beneath the KPI grid so the comparison sits next to the number it describes.

- [ ] **Step 3: Verify**

Run: `pnpm test && pnpm build`
Expected: both pass.

Run: `pnpm exec eslint src/views/operator/Analytics.jsx`
Expected: no new errors versus a `git stash` baseline.

In the browser, confirm the row reads "Not enough comparable campaigns yet to benchmark scan rate." — that is the correct output on today's data.

- [ ] **Step 4: Commit**

```bash
git add src/views/operator/Analytics.jsx
git commit -m "feat: show network benchmark alongside scan rate"
```

---

## Task 5: Phase 3A verification pass

- [ ] **Step 1: Full test suite**

Run: `pnpm test`
Expected: all pass, including `benchmark` (12) and `BenchmarkRow` (5).

- [ ] **Step 2: Build**

Run: `pnpm build`
Expected: exits 0.

- [ ] **Step 3: No group below the floor is ever published**

```sql
select count(*) as leaky_groups
from public.benchmark_stats
where campaign_count < 5 or advertiser_count < 3;
```
Expected: `0`. This is the privacy invariant — a non-zero result means individual advertisers' performance is being published.

- [ ] **Step 4: The view carries no identifying column**

```sql
select column_name from information_schema.columns
where table_name = 'benchmark_stats';
```
Expected: only `venue_category`, `environment`, `campaign_category`, `campaign_count`, `advertiser_count`, and the three `scan_rate_*` percentiles. Any `*_id` column is a leak.

- [ ] **Step 5: The empty state is honest, not accidental**

Confirm `benchmark_stats` is empty **and** that the diagnostic query in Task 2 Step 3 returns groups with 1–2 campaigns each. Empty view + empty diagnostic means the pipeline is broken, not that the floor is working.

- [ ] **Step 6: Confirm the acceptance criteria**

- No group with fewer than 5 campaigns or 3 advertisers is ever published.
- The UI says "not enough comparable campaigns yet" rather than rendering a blank or zero benchmark.
- A campaign with no scan rate of its own renders nothing at all.
- The view contains no per-campaign, per-advertiser or per-screen identifier.

- [ ] **Step 7: Commit the checked-off plan**

```bash
git add docs/superpowers/plans/2026-07-25-phase3a-network-benchmarks.md
git commit -m "docs: mark phase 3A network benchmarks complete"
```
