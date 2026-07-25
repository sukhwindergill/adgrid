# Phase 3C: Reach & Frequency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop overstating audience. AdGrid currently sums impressions across screens, so a 14-screen downtown buy counts the same commuter once per screen. Report unique **reach** and **average frequency** instead, and let an advertiser cap frequency rather than pay for the same person twelve times.

**Architecture:** Reach is impressions discounted by an overlap factor. Two screens close together see substantially the same people; two screens in different cities do not. A pure module computes the discount from pairwise distance, and a frequency cap in the wizard trims screen density instead of raising spend.

**Tech Stack:** Supabase Postgres, React 19 (JS), vitest.

**Depends on:** Phase 1 (`screen_audience_index`, `campaign_delivery_daily`) — **and on screen coordinates, which do not currently exist.** Read the blocker below before starting.

---

## 🚧 Blocker: no screen has coordinates

**Verified against production on 2026-07-25: `select count(*) from screens where lat is not null and lon is not null` returns `0` — out of 12 screens.**

`lat` / `lon` columns exist and `ScreenOnboard` can collect them, but only behind an optional `showLatLng` toggle ([ScreenOnboard.jsx:122](../../../src/views/operator/ScreenOnboard.jsx:122)), and no operator has filled them in. Without coordinates there is no distance, and without distance there is no overlap model — the core of this phase.

**This has a second consequence outside Phase 3, worth fixing regardless:** the campaign wizard's radius targeting filters on `s.lat != null && s.lon != null` ([CreateCampaign.jsx](../../../src/views/advertiser/CreateCampaign.jsx)), so **radius targeting currently matches zero screens in production**. An advertiser who picks "Radius" sees an empty map and no inventory.

Task 1 fixes the root cause. Do not skip it and do not fake coordinates — a reach number computed from invented positions is worse than no reach number.

---

## Context an engineer needs before starting

**Verified against production on 2026-07-25.**

- **IDs are `text`:** `bookings.id`, `screens.id`. `screens.operator_id` is `uuid`.
- **`screens`** has `lat double precision`, `lon double precision` (both null everywhere today), `city`, `state`, `country`, `location`, `venue_category`, `monthly_traffic_estimate`.
- **`screen_audience_index`** (Phase 1) gives measured `people_per_min` by `(screen_id, dow, hour)` with `sample_windows`. Production has **2 rows total** from 2 `impression_events`, so measured audience is effectively unavailable and reach will be modelled — label it accordingly, exactly as `campaign_delivery_daily` does with its `basis` column.
- **A haversine implementation already exists** in [CreateCampaign.jsx:39](../../../src/views/advertiser/CreateCampaign.jsx:39) but is local to that file and untested. Task 2 extracts it to `src/lib/geo.js` so reach and radius targeting share one tested implementation.
- Run `pnpm test`. `pnpm lint` is not a usable gate; lint only files you touched against a `git stash` baseline.

---

## File Structure

**Created:**
| Path | Responsibility |
|---|---|
| `src/lib/geo.js` | Pure: haversine distance |
| `src/lib/geo.test.js` | Tests for the above |
| `src/lib/reach.js` | Pure: overlap discount, reach, frequency |
| `src/lib/reach.test.js` | Tests for the above |
| `supabase/migrations/20260726000020_screen_coordinates.sql` | Make coordinates required for live screens |

**Modified:**
| Path | Change |
|---|---|
| `src/views/operator/ScreenOnboard.jsx` | Collect coordinates as a required field |
| `src/views/advertiser/CreateCampaign.jsx` | Use shared geo; show reach/frequency; frequency cap |
| `src/views/advertiser/AdvDashboard.jsx` | Report reach and average frequency |

---

## Task 1: Make screen coordinates real

**Files:**
- Create: `supabase/migrations/20260726000020_screen_coordinates.sql`
- Modify: `src/views/operator/ScreenOnboard.jsx`

Coordinates stop being optional. Existing screens are backfilled by the operator, not guessed.

- [ ] **Step 1: Write the migration**

```sql
-- Coordinates are required for a screen to be bookable. They drive radius
-- targeting (which silently matches nothing without them) and the reach
-- overlap model.
--
-- Deliberately NOT backfilled with guessed positions: a fabricated coordinate
-- produces a confident, wrong reach number and mis-targets radius buys. Screens
-- without coordinates are flagged so operators can be prompted to supply them.

ALTER TABLE public.screens
  ADD COLUMN IF NOT EXISTS coordinates_missing boolean
  GENERATED ALWAYS AS (lat IS NULL OR lon IS NULL) STORED;

CREATE INDEX IF NOT EXISTS screens_coordinates_missing_idx
  ON public.screens (coordinates_missing)
  WHERE coordinates_missing;
```

- [ ] **Step 2: Apply via the Supabase MCP `apply_migration` (project `hkqiuwnppxkkztacwicj`, name `screen_coordinates`)**

- [ ] **Step 3: Confirm the scale of the gap**

```sql
select coordinates_missing, count(*) from public.screens group by 1;
```
Expected today: `true → 12`. Record this number; Step 6 checks it goes down.

- [ ] **Step 4: Make the field required in `src/views/operator/ScreenOnboard.jsx`**

The form currently hides lat/lng behind `showLatLng` and omits them from the completeness check at line 141. Remove the toggle, always render the two inputs, and add them to the validation:

```js
  const stepValid =
    // …existing conditions…
    Number(form.monthly_traffic_estimate) > 0 &&
    Number.isFinite(parseFloat(form.lat)) &&
    Number.isFinite(parseFloat(form.lng));
```

Add helper text under the inputs so operators know why it is required and how to get the values:

```jsx
  <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 4 }}>
    Right-click your screen's location in Google Maps and copy the two numbers.
    Advertisers use this to find your screen by radius — without it, your screen
    will not appear in location-based searches.
  </div>
```

Use this file's actual token imports and field names.

- [ ] **Step 5: Surface a prompt for existing screens**

In `src/views/operator/Screens.jsx`, show a banner when the operator has screens missing coordinates, linking to the edit modal (which already has lat/lon fields):

```jsx
{screens.some(s => s.lat == null || s.lon == null) && (
  <Card style={{ padding: 16, marginBottom: 16, borderLeft: `3px solid ${C.amber}` }}>
    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.sans }}>
      Some screens are missing coordinates
    </div>
    <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginTop: 4 }}>
      Advertisers searching by radius cannot find these screens. Add coordinates from each screen's settings.
    </div>
  </Card>
)}
```

- [ ] **Step 6: Verify**

Run: `pnpm test && pnpm build`
Expected: both pass.

Onboard a test screen through the wizard and confirm it cannot be completed without coordinates. Then re-run the Step 3 query and confirm the missing count reflects the new screen correctly.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260726000020_screen_coordinates.sql src/views/operator/ScreenOnboard.jsx src/views/operator/Screens.jsx
git commit -m "feat: require screen coordinates and flag screens missing them"
```

---

## Task 2: Shared geo module

**Files:**
- Create: `src/lib/geo.js`, `src/lib/geo.test.js`
- Modify: `src/views/advertiser/CreateCampaign.jsx`

- [ ] **Step 1: Write the failing test at `src/lib/geo.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { haversineKm } from './geo.js';

const TORONTO = [43.6532, -79.3832];
const MONTREAL = [45.5017, -73.5673];

describe('haversineKm', () => {
  it('is 0 for the same point', () => {
    expect(haversineKm(...TORONTO, ...TORONTO)).toBe(0);
  });

  it('matches the known Toronto–Montreal distance', () => {
    // ~504 km great-circle
    expect(haversineKm(...TORONTO, ...MONTREAL)).toBeGreaterThan(495);
    expect(haversineKm(...TORONTO, ...MONTREAL)).toBeLessThan(515);
  });

  it('is symmetric', () => {
    expect(haversineKm(...TORONTO, ...MONTREAL)).toBeCloseTo(haversineKm(...MONTREAL, ...TORONTO), 6);
  });

  it('handles short distances in metres accurately', () => {
    // 0.001 degrees of latitude is ~111 m
    expect(haversineKm(43.6532, -79.3832, 43.6542, -79.3832)).toBeCloseTo(0.111, 2);
  });

  it('returns null when any coordinate is missing', () => {
    expect(haversineKm(null, -79.3832, 45.5, -73.5)).toBeNull();
    expect(haversineKm(43.6532, undefined, 45.5, -73.5)).toBeNull();
    expect(haversineKm(43.6532, -79.3832, NaN, -73.5)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/lib/geo.test.js`
Expected: FAIL — cannot resolve `./geo.js`.

- [ ] **Step 3: Write `src/lib/geo.js`**

```js
// Great-circle distance. Extracted from CreateCampaign so radius targeting and
// the reach overlap model share one tested implementation.
//
// Returns null rather than NaN for missing coordinates: callers must decide
// what an unknown distance means, and NaN silently poisons comparisons.

const EARTH_RADIUS_KM = 6371;

export function haversineKm(lat1, lon1, lat2, lon2) {
  const a1 = Number(lat1), o1 = Number(lon1), a2 = Number(lat2), o2 = Number(lon2);
  if (![a1, o1, a2, o2].every(Number.isFinite)) return null;

  const dLat = (a2 - a1) * Math.PI / 180;
  const dLon = (o2 - o1) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(a1 * Math.PI / 180) * Math.cos(a2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/lib/geo.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Replace the local haversine in `src/views/advertiser/CreateCampaign.jsx`**

Delete the local `function haversine(...)` at line 39 and import the shared one, updating its two call sites:

```js
import { haversineKm } from '../../lib/geo.js';
```

The local version returns a number for missing coordinates; the shared one returns `null`. Update the radius filter so a screen with unknown coordinates is **excluded** rather than treated as distance zero:

```js
const d = haversineKm(center[0], center[1], s.lat, s.lon);
const inRadius = d !== null && d <= radius;
```

- [ ] **Step 6: Verify and commit**

Run: `pnpm test && pnpm build`
Expected: both pass.

```bash
git add src/lib/geo.js src/lib/geo.test.js src/views/advertiser/CreateCampaign.jsx
git commit -m "feat: extract shared haversine and exclude uncoordinated screens from radius"
```

---

## Task 3: Reach and frequency model (pure)

**Files:**
- Create: `src/lib/reach.js`, `src/lib/reach.test.js`

Model: each screen contributes its own impressions, discounted by how much its audience overlaps screens already counted. Overlap falls with distance — near-total under 100 m, negligible past 2 km.

- [ ] **Step 1: Write the failing test at `src/lib/reach.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { overlapFactor, estimateReach, averageFrequency, OVERLAP_FULL_KM, OVERLAP_NONE_KM } from './reach.js';

describe('overlapFactor', () => {
  it('is near total for screens in the same doorway', () => {
    expect(overlapFactor(0)).toBe(1);
    expect(overlapFactor(OVERLAP_FULL_KM)).toBe(1);
  });

  it('is zero beyond the far threshold', () => {
    expect(overlapFactor(OVERLAP_NONE_KM)).toBe(0);
    expect(overlapFactor(50)).toBe(0);
  });

  it('falls off between the thresholds', () => {
    const mid = overlapFactor((OVERLAP_FULL_KM + OVERLAP_NONE_KM) / 2);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });

  it('decreases monotonically with distance', () => {
    expect(overlapFactor(0.5)).toBeGreaterThan(overlapFactor(1.5));
  });

  it('treats an unknown distance as no overlap rather than full overlap', () => {
    // Unknown must not collapse reach to a single screen.
    expect(overlapFactor(null)).toBe(0);
  });
});

describe('estimateReach', () => {
  const far = [
    { screen_id: 'a', impressions: 1000, lat: 43.65, lon: -79.38 },
    { screen_id: 'b', impressions: 1000, lat: 45.50, lon: -73.57 },
  ];

  it('sums impressions when screens do not overlap', () => {
    expect(estimateReach(far).reach).toBe(2000);
  });

  it('discounts heavily when screens are on top of each other', () => {
    const near = [
      { screen_id: 'a', impressions: 1000, lat: 43.6532, lon: -79.3832 },
      { screen_id: 'b', impressions: 1000, lat: 43.6533, lon: -79.3833 },
    ];
    const r = estimateReach(near).reach;
    expect(r).toBeGreaterThan(1000);
    expect(r).toBeLessThan(1600);
  });

  it('returns the single screen impressions for one screen', () => {
    expect(estimateReach([far[0]]).reach).toBe(1000);
  });

  it('returns 0 reach for no screens', () => {
    expect(estimateReach([]).reach).toBe(0);
    expect(estimateReach(null).reach).toBe(0);
  });

  it('never reports reach above total impressions', () => {
    const r = estimateReach(far);
    expect(r.reach).toBeLessThanOrEqual(r.impressions);
  });

  it('counts screens with unknown coordinates without collapsing them together', () => {
    const unknown = [
      { screen_id: 'a', impressions: 1000, lat: null, lon: null },
      { screen_id: 'b', impressions: 1000, lat: null, lon: null },
    ];
    expect(estimateReach(unknown).reach).toBe(2000);
  });

  it('flags whether any coordinate was missing so the UI can caveat it', () => {
    expect(estimateReach([{ screen_id: 'a', impressions: 10, lat: null, lon: null }]).hasUnknownPositions).toBe(true);
    expect(estimateReach(far).hasUnknownPositions).toBe(false);
  });
});

describe('averageFrequency', () => {
  it('is impressions divided by reach', () => {
    expect(averageFrequency(3000, 1000)).toBe(3);
  });

  it('is null when reach is zero', () => {
    expect(averageFrequency(3000, 0)).toBeNull();
  });

  it('is null for non-numeric input', () => {
    expect(averageFrequency(null, 1000)).toBeNull();
  });

  it('rounds to one decimal', () => {
    expect(averageFrequency(1000, 300)).toBe(3.3);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/lib/reach.test.js`
Expected: FAIL — cannot resolve `./reach.js`.

- [ ] **Step 3: Write `src/lib/reach.js`**

```js
// Unique reach and average frequency.
//
// Summing impressions across screens double-counts anyone who passes several
// of them — the reason a 14-screen downtown buy overstates the people reached.
// Each screen is discounted by its overlap with screens already counted.
//
// The overlap curve is a modelled approximation, not a measurement. Anything
// derived from it must be labelled as an estimate.

import { haversineKm } from './geo.js';

export const OVERLAP_FULL_KM = 0.1;  // same block: essentially the same people
export const OVERLAP_NONE_KM = 2.0;  // beyond this: treat as distinct audiences

export function overlapFactor(distanceKm) {
  // Unknown distance means unknown overlap. Assume none: collapsing two
  // uncoordinated screens into one would understate reach dramatically.
  if (distanceKm === null || distanceKm === undefined) return 0;
  const d = Number(distanceKm);
  if (!Number.isFinite(d)) return 0;
  if (d <= OVERLAP_FULL_KM) return 1;
  if (d >= OVERLAP_NONE_KM) return 0;
  return (OVERLAP_NONE_KM - d) / (OVERLAP_NONE_KM - OVERLAP_FULL_KM);
}

export function estimateReach(screens) {
  const list = Array.isArray(screens) ? screens : [];
  const impressions = list.reduce((a, s) => a + (Number(s.impressions) || 0), 0);
  const hasUnknownPositions = list.some(s => !Number.isFinite(Number(s.lat)) || !Number.isFinite(Number(s.lon)));

  if (list.length === 0) return { reach: 0, impressions: 0, hasUnknownPositions: false };

  // Greedy: each screen contributes what it adds beyond the screens already
  // counted, discounted by its strongest overlap with any of them.
  const counted = [];
  let reach = 0;

  for (const s of list) {
    const own = Number(s.impressions) || 0;
    let strongestOverlap = 0;
    for (const prev of counted) {
      const factor = overlapFactor(haversineKm(s.lat, s.lon, prev.lat, prev.lon));
      if (factor > strongestOverlap) strongestOverlap = factor;
    }
    reach += own * (1 - strongestOverlap);
    counted.push(s);
  }

  return { reach: Math.round(reach), impressions, hasUnknownPositions };
}

export function averageFrequency(impressions, reach) {
  const i = Number(impressions);
  const r = Number(reach);
  if (impressions === null || impressions === undefined) return null;
  if (!Number.isFinite(i) || !Number.isFinite(r) || r <= 0) return null;
  return Math.round((i / r) * 10) / 10;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/lib/reach.test.js`
Expected: PASS, 16 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reach.js src/lib/reach.test.js
git commit -m "feat: add reach and frequency estimation with distance-based overlap"
```

---

## Task 4: Report reach and frequency

**Files:**
- Modify: `src/views/advertiser/AdvDashboard.jsx`, `src/views/advertiser/CreateCampaign.jsx`

- [ ] **Step 1: Report measured reach on the dashboard**

`AdvDashboard` already loads per-screen delivery rows. Group them by screen, join coordinates from `advertiser_screens` (the view `authenticated` may read — `screens` itself is not selectable), and derive:

```js
import { estimateReach, averageFrequency } from '../../lib/reach.js';
```
```js
  const perScreen = Object.values(
    delivery.reduce((acc, r) => {
      const key = r.screen_id;
      acc[key] = acc[key] ?? { screen_id: key, impressions: 0, lat: null, lon: null };
      acc[key].impressions += Number(r.impressions) || 0;
      return acc;
    }, {})
  ).map(s => ({ ...s, ...(screenCoords[s.screen_id] ?? {}) }));

  const { reach, hasUnknownPositions } = estimateReach(perScreen);
  const frequency = averageFrequency(totalImpr, reach);
```

Fetch `screenCoords` in the same effect that already loads screen names, selecting `id, name, lat, lon` from `advertiser_screens`.

- [ ] **Step 2: Render them, labelled as estimates**

```jsx
  <KPI
    label="Estimated reach"
    value={reach.toLocaleString()}
    sub={hasUnknownPositions ? 'some screens missing coordinates' : 'unique people, overlap-adjusted'}
  />
  <KPI
    label="Avg frequency"
    value={frequency === null ? '—' : `${frequency}×`}
    sub="times each person saw it"
  />
```

Never present these as measured — the overlap curve is a model.

- [ ] **Step 3: Show projected reach in the campaign wizard**

In `StepScreens`, once screens are selected, show projected reach beneath the existing reach summary using the same two functions, driven by each screen's `monthly_traffic_estimate` prorated over the flight. Label it "estimated".

- [ ] **Step 4: Add a frequency-cap control in Step 4**

Add a target-frequency input to the Budget & Schedule step. When the projected frequency exceeds the target, warn and suggest removing the most-overlapping screens rather than raising budget:

```jsx
{frequency !== null && Number(form.frequency_cap) > 0 && frequency > Number(form.frequency_cap) && (
  <div style={{ fontSize: 12, color: C.amber, fontFamily: F.sans, marginTop: 8 }}>
    Projected frequency is {frequency}× against your {form.frequency_cap}× target.
    Removing closely-clustered screens will reach more distinct people for the same spend.
  </div>
)}
```

Persist the target on the booking only if a column is added for it; otherwise keep it as a planning aid in the wizard and say so in the copy. **Do not silently drop a value the advertiser typed** — if it is not persisted, the label must not imply it will be enforced during delivery.

- [ ] **Step 5: Verify**

Run: `pnpm test && pnpm build`
Expected: both pass.

Run: `pnpm exec eslint src/views/advertiser/AdvDashboard.jsx src/views/advertiser/CreateCampaign.jsx`
Expected: no new errors versus a `git stash` baseline.

- [ ] **Step 6: Commit**

```bash
git add src/views/advertiser/AdvDashboard.jsx src/views/advertiser/CreateCampaign.jsx
git commit -m "feat: report overlap-adjusted reach and average frequency"
```

---

## Task 5: Phase 3C verification pass

- [ ] **Step 1: Full test suite**

Run: `pnpm test`
Expected: all pass, including `geo` (5) and `reach` (16).

- [ ] **Step 2: Build**

Run: `pnpm build`
Expected: exits 0.

- [ ] **Step 3: Reach never exceeds impressions**

Confirm on the dashboard that estimated reach is less than or equal to total impressions for every account with delivery. Reach above impressions means the overlap discount is inverted.

- [ ] **Step 4: Coordinates are actually being collected**

```sql
select coordinates_missing, count(*) from public.screens group by 1;
```
Expected: the `true` count is no higher than at Task 1 Step 3, and any screen onboarded since is `false`.

- [ ] **Step 5: Radius targeting works again**

In the campaign wizard, choose Radius around a city with a coordinated screen and confirm the screen appears on the map and in the selectable list. Before Task 1 this returned nothing.

- [ ] **Step 6: Confirm the acceptance criteria**

- Reach is never reported above total impressions.
- Two screens metres apart report far less combined reach than two in different cities.
- Screens with unknown coordinates are counted as distinct rather than collapsed, and the UI says coordinates are missing.
- Reach and frequency are labelled as estimates, never as measured.
- A frequency target that is not persisted is never presented as if it will be enforced.

- [ ] **Step 7: Commit the checked-off plan**

```bash
git add docs/superpowers/plans/2026-07-25-phase3c-reach-and-frequency.md
git commit -m "docs: mark phase 3C reach and frequency complete"
```
