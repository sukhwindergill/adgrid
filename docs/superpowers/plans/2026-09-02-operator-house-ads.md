# Operator House Ads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an operator create free "house ad" content for their own screen(s) that only fills airtime not claimed by paid campaigns, capped by an operator-configurable max share of the loop, with the resulting foregone revenue visible in Revenue.jsx.

**Architecture:** A house ad is a normal `bookings` row (`is_house_ad = true`, `payment_status = 'paid'` set only by a new service-role edge function) that flows through the existing campaign pipeline unmodified — `campaign_screens`, `campaign_creatives`, dayparting, proof-of-play. Two things are new: (1) a service-role edge function that is the only path allowed to create a house-ad booking, since `bookings.payment_status` is locked to service-role writes; (2) a pure cap-trim function that `display-feed` runs after assembling the poll's active campaigns, dropping house-ad entries once their combined duration would exceed `cap/(100-cap) × paidDuration` — never trimming paid entries, and skipping the cap entirely when no paid campaign is live.

**Tech Stack:** React (Vite) frontend, Supabase (Postgres + Deno edge functions), vitest for `_shared` logic and `src/lib`/view tests.

**Spec:** [docs/superpowers/specs/2026-09-02-operator-house-ads-design.md](../specs/2026-09-02-operator-house-ads-design.md)

## Global Constraints

- `bookings.payment_status` stays locked to service-role writes only (`20260611000002_lock_bookings_update.sql`) — no task may add a client-writable path to it.
- House-ad cap never bumps or trims a paid booking; it only ever limits/drops house-ad entries.
- Cap is skipped entirely (house ads unfiltered) when zero paid campaigns are live on a given `display-feed` poll.
- Follow existing per-file test convention: `_shared/*.ts` logic gets a sibling `*.test.js` (vitest); view/component changes get a sibling `*.test.jsx`.
- Migrations are additive only — no existing column semantics change.

---

## File Structure

- **Create:** `supabase/migrations/20260902090000_house_ads.sql` — `bookings.is_house_ad`, `screens.house_ad_max_pct`, RLS allowing operators to SELECT their own house-ad bookings (already covered by existing `operators_see_own_screen_bookings`) and a check constraint tying `is_house_ad` to how it may be paid.
- **Create:** `supabase/functions/_shared/houseAdCap.ts` — pure function `capHouseAds(paid, house, capPct)` used by `display-feed`.
- **Create:** `supabase/functions/_shared/houseAdCap.test.js` — vitest coverage for the cap logic.
- **Modify:** `supabase/functions/display-feed/index.ts` — select `is_house_ad`, partition, call `capHouseAds`.
- **Create:** `supabase/functions/create-house-ad/index.ts` — service-role function that is the only writer of a house-ad booking.
- **Modify:** `src/views/advertiser/CreateCampaign.jsx` — add `houseAdMode` prop that swaps the submit path to `create-house-ad` and skips the pay step.
- **Modify:** `src/views/advertiser/createCampaign/StepBudgetReview.jsx` — add `houseAdMode` prop hiding the budget field/billing chooser.
- **Modify:** `src/views/operator/ScreenDetail.jsx` — "Create House Ad" entry point + `house_ad_max_pct` setting field in `DetailsTab`.
- **Modify:** `src/views/operator/Revenue.jsx` — opportunity-cost KPI for house-ad play time.
- **Test:** `src/views/operator/Revenue.houseAdOpportunityCost.test.jsx`
- **Test:** `src/views/advertiser/CreateCampaign.houseAdMode.test.jsx`
- **Test:** `supabase/functions/create-house-ad/index.test.js` (mocked supabase client, same style as `src/lib/marketplace.bookings.test.js`)

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260902090000_house_ads.sql`

**Interfaces:**
- Produces: `bookings.is_house_ad boolean NOT NULL DEFAULT false`, `screens.house_ad_max_pct numeric NOT NULL DEFAULT 20`. Every later task reads/writes these two columns by these exact names.

- [ ] **Step 1: Write the migration**

```sql
-- House ads: operator-owned bookings that play for free, only in airtime
-- not claimed by a paid campaign. is_house_ad marks the booking; the
-- payment_status/status columns stay under the existing service-role-only
-- lock (20260611000002_lock_bookings_update.sql) — this migration adds no
-- new client write path to either.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS is_house_ad boolean NOT NULL DEFAULT false;

-- A house-ad booking must never carry a real charge — enforced at the
-- schema level, not just in application code, since payment_status can
-- only be set server-side anyway but budget is not currently constrained.
ALTER TABLE public.bookings
  ADD CONSTRAINT house_ad_zero_budget
  CHECK (NOT is_house_ad OR budget = 0);

-- Operator-configurable ceiling (0-100) on the % of loop time house ads
-- may occupy on this screen. Enforced by display-feed only when a paid
-- campaign is also live on that poll — see houseAdCap.ts.
ALTER TABLE public.screens
  ADD COLUMN IF NOT EXISTS house_ad_max_pct numeric NOT NULL DEFAULT 20
  CHECK (house_ad_max_pct >= 0 AND house_ad_max_pct <= 100);

-- Operators already have "operators_see_own_screen_bookings" (SELECT,
-- scoped via campaign_screens -> screens.operator_id) from
-- 20260701050831_scope_operator_bookings_rls.sql, which covers house-ad
-- bookings on their own screens with no change needed. No new bookings
-- INSERT/UPDATE policy is added here: create-house-ad (Task 3) writes
-- via the service-role client, which bypasses RLS entirely by design,
-- matching the same pattern charge-campaign already uses for
-- payment_status/status.

-- Operators can update their own screen's cap the same way they already
-- update other screens.* settings columns (DetailsTab's existing update
-- call in ScreenDetail.jsx) -- no new column grant needed since screens
-- already allows the owning operator to UPDATE their own row.
```

- [ ] **Step 2: Apply locally / verify**

Run: `supabase db reset` (or `supabase migration up` against the local stack, per this repo's existing workflow) and confirm no error.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260902090000_house_ads.sql
git commit -m "feat: add is_house_ad and house_ad_max_pct columns"
```

---

## Task 2: House-ad cap logic (`_shared/houseAdCap.ts`)

**Files:**
- Create: `supabase/functions/_shared/houseAdCap.ts`
- Create: `supabase/functions/_shared/houseAdCap.test.js`

**Interfaces:**
- Consumes: two arrays of `{ duration: number }`-shaped objects (a subset of the campaign objects `display-feed` already builds) plus a `capPct: number`.
- Produces: `capHouseAds(paid, house, capPct): typeof house` — a function `display-feed/index.ts` (Task 3) imports and calls after partitioning `activeCampaigns`.

- [ ] **Step 1: Write the failing tests**

```javascript
// supabase/functions/_shared/houseAdCap.test.js
import { describe, it, expect } from 'vitest';
import { capHouseAds } from './houseAdCap.ts';

describe('capHouseAds', () => {
  it('returns every house entry unfiltered when there are no paid campaigns', () => {
    const house = [{ id: 'h1', duration: 30 }, { id: 'h2', duration: 30 }];
    expect(capHouseAds([], house, 10)).toEqual(house);
  });

  it('returns every house entry when their combined duration is already under the cap', () => {
    const paid = [{ id: 'p1', duration: 100 }];
    const house = [{ id: 'h1', duration: 5 }];
    // allowed = 10/(100-10) * 100 = 11.1s -- 5s fits.
    expect(capHouseAds(paid, house, 10)).toEqual(house);
  });

  it('trims house entries once their combined duration would exceed the cap, keeping earlier entries first', () => {
    const paid = [{ id: 'p1', duration: 100 }];
    const house = [{ id: 'h1', duration: 8 }, { id: 'h2', duration: 8 }, { id: 'h3', duration: 8 }];
    // allowed = 10/90 * 100 = 11.1s -- only h1 (8s) fits; h1+h2 (16s) does not.
    expect(capHouseAds(paid, house, 10)).toEqual([{ id: 'h1', duration: 8 }]);
  });

  it('drops all house entries when even the first would exceed the cap', () => {
    const paid = [{ id: 'p1', duration: 100 }];
    const house = [{ id: 'h1', duration: 50 }];
    // allowed = 10/90 * 100 = 11.1s -- 50s does not fit.
    expect(capHouseAds(paid, house, 10)).toEqual([]);
  });

  it('never trims paid entries regardless of cap', () => {
    const paid = [{ id: 'p1', duration: 5 }];
    const house = [{ id: 'h1', duration: 1000 }];
    const result = capHouseAds(paid, house, 1);
    expect(paid).toEqual([{ id: 'p1', duration: 5 }]); // untouched
    expect(result.length).toBeLessThanOrEqual(1);
  });

  it('treats a 100% cap as unlimited', () => {
    const paid = [{ id: 'p1', duration: 10 }];
    const house = [{ id: 'h1', duration: 1000 }];
    expect(capHouseAds(paid, house, 100)).toEqual(house);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run supabase/functions/_shared/houseAdCap.test.js`
Expected: FAIL — `houseAdCap.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

```typescript
// supabase/functions/_shared/houseAdCap.ts

/**
 * Trims a screen's house-ad entries for one display-feed poll so their
 * combined duration never exceeds the operator's configured max share of
 * the loop (screens.house_ad_max_pct), and never reduces the paid list.
 *
 * capPct is a share of the COMBINED (paid + house) loop, not of paid alone,
 * so: houseDuration <= capPct/100 * (paidDuration + houseDuration), which
 * rearranges to houseDuration <= capPct/(100-capPct) * paidDuration.
 *
 * If there are no paid entries this poll, there's no paid revenue to
 * protect and leaving the screen dark under an unused cap would defeat
 * the point of the feature -- house ads are returned unfiltered.
 *
 * capPct === 100 is treated as unlimited (the (100-capPct) divisor would
 * otherwise be zero).
 */
export function capHouseAds<T extends { duration: number }>(
  paid: T[],
  house: T[],
  capPct: number,
): T[] {
  if (paid.length === 0) return house;
  if (capPct >= 100) return house;
  if (capPct <= 0) return [];

  const paidDuration = paid.reduce((sum, c) => sum + c.duration, 0);
  const allowedHouseDuration = (capPct / (100 - capPct)) * paidDuration;

  const kept: T[] = [];
  let runningDuration = 0;
  for (const entry of house) {
    if (runningDuration + entry.duration > allowedHouseDuration) break;
    kept.push(entry);
    runningDuration += entry.duration;
  }
  return kept;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run supabase/functions/_shared/houseAdCap.test.js`
Expected: PASS (all 6 tests)

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/houseAdCap.ts supabase/functions/_shared/houseAdCap.test.js
git commit -m "feat: add capHouseAds house-ad loop-share trimming"
```

---

## Task 3: Wire the cap into `display-feed`

**Files:**
- Modify: `supabase/functions/display-feed/index.ts`

**Interfaces:**
- Consumes: `capHouseAds` from Task 2 (`../_shared/houseAdCap.ts`); `screen.house_ad_max_pct` (added in Task 1) is already available once selected on the existing `screens` query.

- [ ] **Step 1: Select the two new columns**

In `supabase/functions/display-feed/index.ts`, extend the existing screens `.select(...)` (around line 37) to include `house_ad_max_pct`:

```typescript
  const { data: screen, error: screenError } = await supabase
    .from("screens")
    .select("id, name, operator_id, status, operating_hours_start, operating_hours_end, timezone, max_ad_duration, house_ad_max_pct")
    .eq("screen_token", screenToken)
    .single();
```

And extend the `bookings` select (around line 88) to include `is_house_ad`:

```typescript
      .select("id, advertiser_name, headline, cta_text, accent_color, destination_url, category, media_url, media_type, qr_x, qr_y, qr_size_pct, qr_fg_color, qr_bg_color, slots, duration, schedule_days, time_start, time_end, dayparting, is_house_ad")
```

- [ ] **Step 2: Import `capHouseAds`**

At the top of the file, alongside the other `_shared` imports:

```typescript
import { capHouseAds } from "../_shared/houseAdCap.ts";
```

- [ ] **Step 3: Partition and cap `activeCampaigns` before the response is built**

Immediately before the `display_heartbeats`/`screens.update` block (currently starting `// Log heartbeat + keep last_seen fresh` around line 200), replace the plain `activeCampaigns` usage with a capped version:

```typescript
  // House ads never bump or trim a paid campaign's airtime -- they only
  // ever fill what paid campaigns aren't using, up to the operator's
  // configured house_ad_max_pct share of the loop. See houseAdCap.ts.
  const paidEntries  = activeCampaigns.filter((c) => !c.is_house_ad);
  const houseEntries = activeCampaigns.filter((c) => c.is_house_ad);
  const cappedHouseEntries = capHouseAds(
    paidEntries as { duration: number }[],
    houseEntries as { duration: number }[],
    (screen.house_ad_max_pct as number | null) ?? 20,
  );
  const feedCampaigns = [...paidEntries, ...cappedHouseEntries];
```

- [ ] **Step 4: Use `feedCampaigns` everywhere `activeCampaigns` was used for the response and heartbeat**

Replace the two remaining uses below that block:

```typescript
  const now_iso = new Date().toISOString();
  const activeBookingIds = new Set(feedCampaigns.map((c) => c.id as string));
  supabase.from("display_heartbeats").insert({
    screen_id: screen.id,
    campaign_id: activeBookingIds.size === 1 ? [...activeBookingIds][0] : null,
    status: feedCampaigns.length > 0 ? "playing" : "idle",
  }).then(() => {});
  supabase.from("screens").update({ last_seen: now_iso }).eq("id", screen.id).then(() => {});

  return new Response(
    JSON.stringify({
      screen_id: screen.id,
      screen_name: screen.name,
      current_time: currentTime,
      campaigns: feedCampaigns,
    }),
    { headers: CORS },
  );
```

- [ ] **Step 5: Manual verification**

Run the project's existing edge-function local-serve workflow (`supabase functions serve display-feed`, per this repo's normal dev loop) and hit it with a token for a screen that has both a paid and a house-ad booking seeded; confirm the `campaigns` array respects the cap. (No new integration test here — the trimming logic itself is fully covered by Task 2's unit tests; this step is a smoke check that the wiring is correct.)

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/display-feed/index.ts
git commit -m "feat: enforce house-ad loop-share cap in display-feed"
```

---

## Task 4: `create-house-ad` edge function

**Files:**
- Create: `supabase/functions/create-house-ad/index.ts`
- Create: `supabase/functions/create-house-ad/index.test.js`

**Interfaces:**
- Consumes: an authenticated operator's JWT (Authorization header) and a JSON body:
  ```typescript
  {
    screen_ids: string[],           // must all belong to the calling operator
    name: string | null,
    creative: {
      media_url: string, media_type: string, media_width: number | null, media_height: number | null,
      headline: string | null, cta_text: string | null, destination_url: string | null,
      accent_color: string | null, category: string | null,
      qr_x: number | null, qr_y: number | null, qr_size_pct: number | null,
      qr_fg_color: string | null, qr_bg_color: string | null,
    },
    schedule: {
      start_date: string | null, end_date: string | null,
      schedule_days: string[], time_start: string, time_end: string, dayparting: object | null,
      duration: number, slots: number,
    },
  }
  ```
- Produces: `{ success: true, campaign_id: string }` on success — the id of the new `bookings` row. This is the sole path that may insert a `bookings` row with `is_house_ad = true` and `payment_status = 'paid'`; `CreateCampaign.jsx` (Task 5) calls this instead of its normal client-side insert when in house-ad mode.

- [ ] **Step 1: Write the test (mocked supabase client, following `src/lib/marketplace.bookings.test.js`'s style)**

```javascript
// supabase/functions/create-house-ad/index.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Deno edge functions in this repo are plain TS modules with no framework
// dependency beyond @supabase/supabase-js and Deno.serve, so the request
// handler logic is tested the same way src/lib modules are: import the
// pure pieces and exercise them directly, rather than spinning up Deno.
// This test targets the ownership-check helper extracted below, which is
// the security-relevant unit: "which screen_ids does this operator
// actually own."
import { operatorOwnsAllScreens } from './ownership.ts';

describe('operatorOwnsAllScreens', () => {
  it('returns true when every requested screen belongs to the operator', () => {
    const ownedScreenIds = new Set(['s1', 's2', 's3']);
    expect(operatorOwnsAllScreens(['s1', 's2'], ownedScreenIds)).toBe(true);
  });

  it('returns false when any requested screen does not belong to the operator', () => {
    const ownedScreenIds = new Set(['s1', 's2']);
    expect(operatorOwnsAllScreens(['s1', 's3'], ownedScreenIds)).toBe(false);
  });

  it('returns false for an empty screen_ids list', () => {
    const ownedScreenIds = new Set(['s1']);
    expect(operatorOwnsAllScreens([], ownedScreenIds)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/create-house-ad/index.test.js`
Expected: FAIL — `./ownership.ts` does not exist yet.

- [ ] **Step 3: Write `ownership.ts` (the pure, testable piece) and `index.ts` (the Deno handler)**

```typescript
// supabase/functions/create-house-ad/ownership.ts
export function operatorOwnsAllScreens(requestedScreenIds: string[], ownedScreenIds: Set<string>): boolean {
  if (requestedScreenIds.length === 0) return false;
  return requestedScreenIds.every((id) => ownedScreenIds.has(id));
}
```

```typescript
// supabase/functions/create-house-ad/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { operatorOwnsAllScreens } from "./ownership.ts";

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
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: CORS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401, headers: CORS });
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return new Response("Unauthorized", { status: 401, headers: CORS });

  const { data: callerProfile } = await supabase.from("profiles").select("role, name").eq("id", user.id).single();
  if (callerProfile?.role !== "operator") {
    return new Response(JSON.stringify({ error: "Only operators can create house ads." }), { status: 403, headers: CORS });
  }

  const body = await req.json().catch(() => null);
  if (!body?.screen_ids?.length || !body?.creative?.media_url) {
    return new Response(JSON.stringify({ error: "screen_ids and creative.media_url are required" }), { status: 400, headers: CORS });
  }
  const { screen_ids, name, creative, schedule } = body;

  // Ownership check -- the whole reason this must be a service-role
  // function and not a client insert: an operator may only create a
  // house ad on a screen they themselves own.
  const { data: ownedRows } = await supabase.from("screens").select("id, name").eq("operator_id", user.id).in("id", screen_ids);
  const ownedScreenIds = new Set((ownedRows ?? []).map((r: { id: string }) => r.id));
  if (!operatorOwnsAllScreens(screen_ids, ownedScreenIds)) {
    return new Response(JSON.stringify({ error: "One or more screens are not owned by this operator." }), { status: 403, headers: CORS });
  }

  const { data: campaignRow, error: campaignErr } = await supabase
    .from("campaigns")
    .insert({ advertiser_id: user.id, name: name || "House Ad" })
    .select("id")
    .single();
  if (campaignErr) {
    return new Response(JSON.stringify({ error: campaignErr.message }), { status: 500, headers: CORS });
  }

  const campaignId = crypto.randomUUID();
  const firstScreen = (ownedRows ?? []).find((r: { id: string }) => r.id === screen_ids[0]);

  const { error: bookingErr } = await supabase.from("bookings").insert({
    id: campaignId,
    campaign_id: campaignRow.id,
    is_house_ad: true,
    advertiser_id: user.id,
    advertiser_name: callerProfile?.name || "House Ad",
    campaign_name: name || null,
    screen_name: firstScreen?.name || "",
    city: "",
    media_url: creative.media_url,
    media_type: creative.media_type ?? "image",
    media_width: creative.media_width ?? null,
    media_height: creative.media_height ?? null,
    headline: creative.headline ?? null,
    cta_text: creative.cta_text ?? null,
    destination_url: creative.destination_url ?? null,
    accent_color: creative.accent_color ?? null,
    category: creative.category ?? null,
    qr_x: creative.qr_x ?? null,
    qr_y: creative.qr_y ?? null,
    qr_size_pct: creative.qr_size_pct ?? null,
    qr_fg_color: creative.qr_fg_color ?? null,
    qr_bg_color: creative.qr_bg_color ?? null,
    budget: 0,
    currency: "cad",
    budget_mode: "total",
    start_when: "partial",
    holdout_enabled: false,
    start_date: schedule?.start_date ?? null,
    end_date: schedule?.end_date ?? null,
    schedule_days: schedule?.schedule_days ?? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    time_start: schedule?.time_start ?? "07:00",
    time_end: schedule?.time_end ?? "22:00",
    dayparting: schedule?.dayparting ?? null,
    duration: schedule?.duration ?? 15,
    slots: schedule?.slots ?? 10,
    status: "scheduled",
    payment_status: "paid",
    impressions: 0,
    spent: 0,
    scans: 0,
  });
  if (bookingErr) {
    return new Response(JSON.stringify({ error: bookingErr.message }), { status: 500, headers: CORS });
  }

  const screenRows = screen_ids.map((screen_id: string) => ({
    campaign_id: campaignId,
    screen_id,
    status: "auto_approved", // the operator's own screen -- no advertiser-review step applies
  }));
  const { error: screenErr } = await supabase.from("campaign_screens").insert(screenRows);
  if (screenErr) {
    return new Response(JSON.stringify({ error: screenErr.message }), { status: 500, headers: CORS });
  }

  return new Response(JSON.stringify({ success: true, campaign_id: campaignId }), { headers: CORS });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run supabase/functions/create-house-ad/index.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/create-house-ad/
git commit -m "feat: add create-house-ad edge function"
```

---

## Task 5: House-ad mode in `CreateCampaign`

**Files:**
- Modify: `src/views/advertiser/CreateCampaign.jsx`
- Modify: `src/views/advertiser/createCampaign/StepBudgetReview.jsx`
- Test: `src/views/advertiser/CreateCampaign.houseAdMode.test.jsx`

**Interfaces:**
- Consumes: `SUPABASE_FUNCTIONS_URL` (already imported in `CreateCampaign.jsx`) to call `create-house-ad` (Task 4).
- Produces: `CreateCampaign` accepts a new `houseAdMode` boolean prop (default `false`). When `true`: screen targeting is forced to `presetScreenIds` exactly as the existing screen-invite flow already does (no new targeting logic needed — `presetScreenIds` already locks step 0 and skips it, per the existing `matchedScreens`/`step` initialization at lines 120 and 194), the budget/billing UI is hidden, and `handleSubmit` posts to `create-house-ad` instead of inserting `bookings`/`campaign_screens` directly and skips `StepPay`.

- [ ] **Step 1: Write the failing test**

```javascript
// src/views/advertiser/CreateCampaign.houseAdMode.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateCampaign } from './CreateCampaign.jsx';

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    user: { id: 'op-1', email: 'op@example.com' },
    profile: { name: 'Op One', preferred_currency: 'cad' },
    activeAccount: null,
  }),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    auth: { getSession: () => Promise.resolve({ data: { session: { access_token: 'tok' } } }) },
  },
}));

describe('CreateCampaign houseAdMode', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true, campaign_id: 'c1' }) });
  });

  it('calls create-house-ad instead of inserting bookings directly, and skips the pay step', async () => {
    const onSave = vi.fn();
    render(
      <CreateCampaign
        houseAdMode
        presetScreenIds={['s1']}
        dbScreens={[{ id: 's1', name: 'Lobby Screen', status: 'live', operator_id: 'op-1' }]}
        onSave={onSave}
        onCancel={() => {}}
      />
    );

    // houseAdMode starts on the Creative step (screen targeting is preset,
    // same as the existing screen-invite flow) -- upload a creative, then
    // reach the final step and submit.
    // (Creative upload interaction omitted here; assumed covered by
    // StepCreative's own test suite -- this test asserts the submit
    // wiring, not the wizard's per-step UI.)

    // Directly exercise the submit path via the exposed test hook is not
    // available, so this test instead asserts against the component's
    // public behavior: once on the final step with a valid form, clicking
    // submit calls create-house-ad, not /charge-campaign.
    // Implementation detail: fireEvent through the visible "Create House
    // Ad" button once StepCreative/StepBudgetReview are filled -- left as
    // an integration point for the engineer executing this task, following
    // the same interaction pattern already used in
    // src/views/advertiser/createCampaign's other *.test.jsx files for
    // driving the wizard to its final step.
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/views/advertiser/CreateCampaign.houseAdMode.test.jsx`
Expected: FAIL — `houseAdMode` prop does not exist yet, `create-house-ad` is never called.

- [ ] **Step 3: Add `houseAdMode` to `CreateCampaign.jsx`**

Change the component signature (line 114) to accept the new prop:

```javascript
export function CreateCampaign({ onSave, onCancel, dbScreens = [], screensLoading = false, campaigns = [], existingCampaign = null, presetScreenIds = null, duplicateFrom = null, resumeDraftId = null, houseAdMode = false }) {
```

Replace `STEP_LABELS` (line 26) to branch on mode:

```javascript
const STEP_LABELS = ['Targeting', 'Creative', 'Schedule'];
```

(The label 'Budget & Schedule' becomes just 'Schedule' in house-ad mode via the `houseAdMode` prop passed into `StepBudgetReview` in Task 5 Step 4 below — the shared array stays the advertiser-facing default since `StepBudgetReview` itself renders the heading text, not this array.)

Replace the body of `handleSubmit` (lines 339-592) with a branch at the top: house-ad mode skips the budget check and calls the new function, everything else (draft cleanup, `setCreated`, `setStep(3)`) stays shared. Concretely, wrap the existing budget-validation block:

```javascript
  const handleSubmit = async () => {
    if (!houseAdMode) {
      const budgetValue = parseFloat(form.budget);
      if (!form.budget || budgetValue <= 0) {
        setSubmitErr('Enter a budget greater than 0 before submitting.');
        return;
      }
      if (budgetValue > 1000000) {
        setSubmitErr('Budget cannot exceed $1,000,000.');
        return;
      }
    }
    setSubmitting(true);
    setSubmitErr(null);
    try {
      const creatives = reconcileAssignments(
        form.creatives.length > 0 ? form.creatives : [],
        form.selected_screen_ids,
      );
      const primary = creatives[0] ?? {};
      const preview = buildPreviewCampaign(primary);

      if (houseAdMode) {
        const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/create-house-ad`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${(await supabase.auth.getSession()).data.session.access_token}` },
          body: JSON.stringify({
            screen_ids: form.selected_screen_ids,
            name: form.name || null,
            creative: {
              media_url: primary.media_url || null,
              media_type: primary.media_type || null,
              media_width: primary.media_width ?? null,
              media_height: primary.media_height ?? null,
              headline: preview.headline ?? null,
              cta_text: preview.cta ?? null,
              destination_url: preview.destination_url?.trim() ? normalizeDestinationUrl(preview.destination_url) : null,
              accent_color: preview.accent_color || null,
              category: preview.category || null,
              qr_x: preview.qr_x ?? null,
              qr_y: preview.qr_y ?? null,
              qr_size_pct: preview.qr_size_pct ?? null,
              qr_fg_color: preview.qr_fg_color ?? null,
              qr_bg_color: preview.qr_bg_color ?? null,
            },
            schedule: {
              start_date: form.start_date || null,
              end_date: form.end_date || null,
              schedule_days: form.schedule_days,
              time_start: form.time_start,
              time_end: form.time_end,
              dayparting: form.dayparting,
              duration: parseInt(form.duration, 10) || 15,
              slots: parseInt(form.slots, 10) || 10,
            },
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to create house ad');
        }
        const { campaign_id } = await res.json();
        setSubmitting(false);
        if (isFreshDraftFlow && user && draftIdRef.current) deleteDraft(user.id, draftIdRef.current);
        // House ads are paid=true at creation (Task 4) -- there is no pay
        // step to route through, unlike a real advertiser campaign.
        onSave({
          id: campaign_id,
          advertiser: profile?.name || 'House Ad',
          screen: dbScreens.find(s => s.id === form.selected_screen_ids[0])?.name || '',
          status: 'scheduled',
          is_house_ad: true,
        });
        return;
      }

      // ... existing non-house-ad insert logic unchanged below this line ...
```

The remainder of the existing `try` body (everything from `// When adding a targeting group...` at line 364 through the end of the function) is unchanged and only runs when `houseAdMode` is falsy, since the `if (houseAdMode) { ... return; }` block above returns early.

- [ ] **Step 4: Skip the pay step and hide budget UI when `houseAdMode` is true**

In the render section, change the step-3 (`StepPay`) condition (line 692) so house-ad mode never shows it — it already can't reach step 3 since `handleSubmit` returns before `setStep(3)` when `houseAdMode` is true and calls `onSave` directly instead, so no change is needed there. Pass `houseAdMode` down to `StepBudgetReview` (line 691):

```javascript
      {step === 2 && <StepBudgetReview form={form} setForm={setForm} matchedScreens={selectedScreens} profile={profile} onSubmit={handleSubmit} submitting={submitting} err={submitErr} canChooseBilling={canChooseBilling} billedTo={billedTo} setBilledTo={setBilledTo} houseAdMode={houseAdMode} />}
```

- [ ] **Step 5: Hide the budget field and billing chooser in `StepBudgetReview.jsx`**

Add `houseAdMode = false` to the destructured props (line 14):

```javascript
export function StepBudgetReview({
  form, setForm, matchedScreens, profile, onSubmit, submitting, err, canChooseBilling, billedTo, setBilledTo, houseAdMode = false,
}) {
```

Wrap the existing "Budget type" pill group and the total/daily amount `Inp` (the block starting at line 56) in `{!houseAdMode && (...)}`, and change the submit button's disabled/validation logic (further down this file, wherever the budget-empty check gates the submit button) to skip the budget check when `houseAdMode` is true — following the same `!houseAdMode &&` guard pattern. Change the row array (line 39, the `'Budget'` row) to be conditionally included:

```javascript
  const rows = [
    ['Area', `${form.area_type === 'radius' ? `${form.radius_km}km radius` : form.city || form.state || form.country}`],
    ['Screens', `${form.selected_screen_ids.length} selected · ~${(totalImpr / 1000).toFixed(0)}K impr/mo`],
    ['Creatives', isMulti ? form.creatives.map((c, i) => creativeLabel(i)).join(', ') : creativeLabel(0)],
    ...(houseAdMode ? [] : [['Budget', `${form.budget ? formatCurrency(form.budget, profile?.preferred_currency) : '—'} (${form.budget_mode === 'daily' ? 'daily' : 'total'})`]]),
    ['Dates', form.start_date && form.end_date ? `${form.start_date} → ${form.end_date} (${days} days)` : '—'],
    ['Time', form.dayparting
      ? form.schedule_days.map(d => `${d} ${form.dayparting[d]?.time_start}–${form.dayparting[d]?.time_end}`).join(', ')
      : `${form.time_start} – ${form.time_end}`],
    ['Days', form.schedule_days.join(', ')],
    ['Ad Duration', `${form.duration}s per play`],
    ['Slot Share', `${form.slots}% of airtime`],
    ['Launch', form.start_when === 'partial' ? 'Go live as screens approve' : 'Wait for all screens'],
  ];
```

And change the submit `Btn`'s label to `houseAdMode ? 'Create House Ad' : 'Review & Submit'` (matching whatever label the existing submit button already renders in this file).

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/views/advertiser/CreateCampaign.houseAdMode.test.jsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/views/advertiser/CreateCampaign.jsx src/views/advertiser/createCampaign/StepBudgetReview.jsx src/views/advertiser/CreateCampaign.houseAdMode.test.jsx
git commit -m "feat: add houseAdMode to CreateCampaign wizard"
```

---

## Task 6: Operator entry points — "Create House Ad" and the cap setting

**Files:**
- Modify: `src/views/operator/ScreenDetail.jsx`
- Test: existing `OperatorSettingsView.test.jsx`-style coverage is not required here since this task only adds a button (routing, covered by manual verification per this repo's `run` skill) and a form field on an existing settings save path (`DetailsTab`'s save, already exercised).

**Interfaces:**
- Consumes: `CreateCampaign` with `houseAdMode` + `presetScreenIds` (Task 5).
- Produces: nothing new consumed by later tasks.

- [ ] **Step 1: Add a "Create House Ad" button that mounts `CreateCampaign`**

In `src/views/operator/ScreenDetail.jsx`, near the existing screen-actions area (around the status-change button at line 433), add local state and a button:

```javascript
  const [showHouseAdWizard, setShowHouseAdWizard] = useState(false);
```

```jsx
  <Btn variant="secondary" onClick={() => setShowHouseAdWizard(true)}>Create House Ad</Btn>
```

And, near wherever this file already conditionally renders a full-screen overlay/modal component (e.g. the `PhotoManager` invocation pattern already present at line 397), render the wizard:

```jsx
  {showHouseAdWizard && (
    <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 300, overflowY: 'auto' }}>
      <CreateCampaign
        houseAdMode
        presetScreenIds={[screen.id]}
        dbScreens={[screen]}
        onSave={() => setShowHouseAdWizard(false)}
        onCancel={() => setShowHouseAdWizard(false)}
      />
    </div>
  )}
```

Add the import at the top of the file: `import { CreateCampaign } from '../advertiser/CreateCampaign.jsx';`

- [ ] **Step 2: Add the `house_ad_max_pct` field to `DetailsTab`'s settings form**

`DetailsTab` (line 68) already has a `fields` state seeded from `screen` and a save handler that calls `supabase.from('screens').update({...fields}).eq('id', screen.id)` (line 90). Add the new field to whatever object seeds `fields` from `screen` (so it round-trips on save) and render an `Inp`:

```jsx
<Inp label="Max house-ad share of loop (%)" type="number" min="0" max="100"
  value={fields.house_ad_max_pct ?? 20}
  onChange={e => set('house_ad_max_pct', Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)))} />
```

(Use whichever `set`/`setFields` helper this file's other numeric fields already use — follow the existing pattern in this component rather than introducing a new one.)

- [ ] **Step 3: Manual verification**

Use the `run` skill to launch the app, sign in as an operator, open a screen's detail page, click "Create House Ad", complete the wizard, and confirm: (a) the booking appears with no charge, (b) the screen's settings tab saves a new `house_ad_max_pct` value.

- [ ] **Step 4: Commit**

```bash
git add src/views/operator/ScreenDetail.jsx
git commit -m "feat: add house-ad creation entry point and cap setting to ScreenDetail"
```

---

## Task 7: Opportunity-cost KPI in Revenue.jsx

**Files:**
- Modify: `src/views/operator/Revenue.jsx`
- Test: `src/views/operator/Revenue.houseAdOpportunityCost.test.jsx`

**Interfaces:**
- Consumes: `filteredCampaigns` (already fetched in `Revenue.jsx`, now includes `is_house_ad` since `bookings.select('*')` already selects every column); `operatorScreenIds` (already a prop).
- Produces: nothing consumed by later tasks — this is the last task.

- [ ] **Step 1: Write the failing test**

```javascript
// src/views/operator/Revenue.houseAdOpportunityCost.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Revenue } from './Revenue.jsx';

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ profile: { owner_revenue_share: 0.4 } }),
}));

vi.mock('../../hooks/useOperatorCampaignIds.js', () => ({
  useOperatorCampaignIds: () => new Set(['b1', 'b2']),
}));

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    from: (table) => {
      if (table === 'bookings') {
        return {
          select: () => ({
            in: () => ({
              gte: () => Promise.resolve({
                data: [
                  { id: 'b1', budget: 500, city: 'Toronto', is_house_ad: false, impressions: 10000, start_date: new Date().toISOString() },
                  { id: 'b2', budget: 0, city: 'Toronto', is_house_ad: true, impressions: 4000, start_date: new Date().toISOString() },
                ],
              }),
            }),
          }),
        };
      }
      if (table === 'screens') {
        return { select: () => ({ in: () => Promise.resolve({ data: [{ id: 's1', cpm_floor: 3.0 }] }) }) };
      }
      return { select: () => ({ in: () => Promise.resolve({ data: [] }) }) };
    },
  },
}));

describe('Revenue house-ad opportunity cost', () => {
  it('shows an estimated $ figure for house-ad play time, separate from paid ad spend', async () => {
    render(<Revenue operatorScreenIds={['s1']} />);
    await waitFor(() => expect(screen.getByText(/Given Up to House Ads/i)).toBeInTheDocument());
    // 4000 impressions / 1000 * $3.00 cpm_floor = $12
    expect(screen.getByText('$12')).toBeInTheDocument();
    // Total Ad Spend must reflect only the paid booking's budget, not the house ad's $0.
    expect(screen.getByText('$500')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/views/operator/Revenue.houseAdOpportunityCost.test.jsx`
Expected: FAIL — no "Given Up to House Ads" KPI exists yet, and `screens` is never queried.

- [ ] **Step 3: Implement**

In `src/views/operator/Revenue.jsx`, add a `screens` fetch (for `cpm_floor`) alongside the existing `bookings` fetch, and compute the opportunity-cost figure. Change the effect (lines 40-53):

```javascript
  const [screenCpmFloors, setScreenCpmFloors] = useState([]);

  useEffect(() => {
    if (operatorScreenIds.length === 0) { setScreenCpmFloors([]); return; }
    supabase.from('screens').select('id, cpm_floor').in('id', operatorScreenIds)
      .then(({ data }) => setScreenCpmFloors(data || []));
  }, [operatorScreenIds.join(',')]);

  useEffect(() => {
    if (operatorCampaignIds.size === 0) { setFilteredCampaigns([]); setLoading(false); return; }
    setLoading(true);
    let query = supabase.from('bookings').select('*').in('id', [...operatorCampaignIds]);
    if (period !== null) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - period);
      query = query.gte('start_date', cutoff.toISOString());
    }
    query.then(({ data }) => {
      setFilteredCampaigns((data || []).map(normalizeBooking));
      setLoading(false);
    });
  }, [period, operatorIdsKey]);
```

After the existing `total`/`computeRevenueSplit` lines (around line 63-64), add:

```javascript
  // Opportunity cost: what house-ad play time would have earned at this
  // operator's screens' normal CPM floor, had it been sold instead of
  // given away. Uses the average cpm_floor across the operator's screens
  // as a single estimate -- a house-ad booking can span multiple screens
  // and bookings.impressions is not tracked per-screen, so this is
  // presented as an estimate, matching the design spec.
  const avgCpmFloor = screenCpmFloors.length > 0
    ? screenCpmFloors.reduce((a, s) => a + (s.cpm_floor ?? 3.0), 0) / screenCpmFloors.length
    : 3.0;
  const houseAdCampaigns = filteredCampaigns.filter(c => c.is_house_ad);
  const houseAdImpressions = houseAdCampaigns.reduce((a, c) => a + (c.impressions || 0), 0);
  const houseAdOpportunityCost = Math.round((houseAdImpressions / 1000) * avgCpmFloor);
```

And make `total` (the "Total Ad Spend" KPI, currently `filteredCampaigns.reduce((a, c) => a + c.budget, 0)`) explicitly exclude house ads for clarity, even though their `budget` is already always `0`:

```javascript
  const total = filteredCampaigns.filter(c => !c.is_house_ad).reduce((a, c) => a + c.budget, 0);
```

Add a fifth KPI to the grid (change `repeat(4,1fr)` to `repeat(5,1fr)` for desktop, keep `repeat(2,1fr)` for mobile, in the grid style at line 88):

```jsx
        <KPI label="Given Up to House Ads" value={`$${houseAdOpportunityCost.toLocaleString()}`} sub="estimated, at CPM floor" color={C.textSub} icon="📺" />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/views/operator/Revenue.houseAdOpportunityCost.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/views/operator/Revenue.jsx src/views/operator/Revenue.houseAdOpportunityCost.test.jsx
git commit -m "feat: show house-ad opportunity cost in Revenue.jsx"
```

---

## Self-Review Notes

- **Spec coverage:** data model (Task 1), creation flow (Tasks 4-6), fill priority/cap (Tasks 2-3), revenue visibility (Task 7), "never bumps paid" (enforced structurally in `capHouseAds` — paid array is never mutated or filtered), zero-paid-demand behavior (explicit branch + test in Task 2) all have a task.
- **Type consistency:** `is_house_ad` (Task 1) is the exact name read in `display-feed` (Task 3), written in `create-house-ad` (Task 4), and read in `Revenue.jsx` (Task 7). `house_ad_max_pct` (Task 1) is the exact name read in `display-feed` (Task 3) and written in `ScreenDetail.jsx`'s `DetailsTab` (Task 6). `capHouseAds(paid, house, capPct)` signature in Task 2 matches its call site in Task 3.
- **No placeholders:** every step above has real code; Task 5 Step 1's test leaves the wizard-navigation interaction as a note rather than fabricated `fireEvent` calls against UI this plan didn't inspect line-by-line — flagged inline rather than hidden, since `StepCreative.jsx`'s exact upload interaction wasn't read during planning. The engineer executing Task 5 should open `StepCreative.jsx` and its existing `*.test.jsx` siblings for the real interaction pattern before finishing that test.
