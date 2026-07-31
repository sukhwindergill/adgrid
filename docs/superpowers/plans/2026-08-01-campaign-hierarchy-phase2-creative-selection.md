# Campaign Hierarchy — Phase 2: Creative Selection & Serving Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `display-feed` actually serve multiple creatives per screen when a campaign has them assigned via Phase 1's `campaign_creative_screens`, weighted per the advertiser's static split, with zero changes to the production `DisplayPlayer` rotation loop — and wire `creative_id` through proof-of-play and scan attribution so per-creative reporting has real data to read later.

**Architecture:** One new pure module (`supabase/functions/_shared/creativeSelection.ts`) expands a screen's weighted creative assignments into a small ordered, interleaved list of creative IDs; `display-feed` uses it to push one array entry per slot instead of one per campaign. Because `DisplayPlayer.jsx` already round-robins evenly through whatever array `display-feed` returns (confirmed by reading `src/views/display/DisplayPlayer.jsx:200-215` — it has no concept of "campaign" vs "creative", it just cycles the array on a flat timer), pushing pre-expanded, repeated entries achieves weighted rotation with **no changes to the player's rotation, fade, or indicator-dot logic at all.**

**Tech Stack:** Deno edge functions (TypeScript), vitest for the shared pure module (this codebase already tests `supabase/functions/_shared/*.ts` under vitest — see `playValidation.test.js`), React for the two small `DisplayPlayer.jsx`/`playBuffer.js` attribution changes.

**Correction to the design spec while planning this:** the design doc named this module `src/lib/creativeSelection.js`. It actually belongs in `supabase/functions/_shared/creativeSelection.ts` — it's consumed only by the `display-feed` edge function (a Deno runtime, separate from the Vite/React app), matching exactly where `playValidation.ts` and `scanQuality.ts` already live for the same reason.

---

### Task 1: `creativeSelection.ts` — weighted expansion, pure and tested

**Files:**
- Create: `supabase/functions/_shared/creativeSelection.ts`
- Create: `supabase/functions/_shared/creativeSelection.test.js`

- [ ] **Step 1: Write the failing test**

```js
// supabase/functions/_shared/creativeSelection.test.js
import { describe, it, expect } from 'vitest';
import { CREATIVE_ROTATION_SLOTS, expandCreativeAssignments } from './creativeSelection.ts';

describe('expandCreativeAssignments', () => {
  it('returns empty for no assignments', () => {
    expect(expandCreativeAssignments([])).toEqual([]);
  });

  it('returns a single-entry list for one assignment, regardless of weight', () => {
    expect(expandCreativeAssignments([{ creative_id: 'a', weight: 37 }])).toEqual(['a']);
  });

  it('splits two equal weights into an even, interleaved rotation', () => {
    const result = expandCreativeAssignments([
      { creative_id: 'a', weight: 50 },
      { creative_id: 'b', weight: 50 },
    ]);
    expect(result).toHaveLength(CREATIVE_ROTATION_SLOTS);
    expect(result.filter(id => id === 'a')).toHaveLength(CREATIVE_ROTATION_SLOTS / 2);
    expect(result.filter(id => id === 'b')).toHaveLength(CREATIVE_ROTATION_SLOTS / 2);
    // interleaved, not block-repeated
    expect(result).toEqual(['a', 'b', 'a', 'b', 'a', 'b', 'a', 'b', 'a', 'b']);
  });

  it('produces exact proportional counts for a 70/30 split', () => {
    const result = expandCreativeAssignments([
      { creative_id: 'a', weight: 70 },
      { creative_id: 'b', weight: 30 },
    ]);
    expect(result.filter(id => id === 'a')).toHaveLength(7);
    expect(result.filter(id => id === 'b')).toHaveLength(3);
  });

  it('guarantees every assignment appears at least once even when weights round to zero slots', () => {
    const result = expandCreativeAssignments([
      { creative_id: 'a', weight: 95 },
      { creative_id: 'b', weight: 1 },
    ]);
    expect(result.filter(id => id === 'b').length).toBeGreaterThanOrEqual(1);
  });

  it('distributes rounding remainder to the largest fractional share, keeping the total at 10', () => {
    // 33/33/34 -> shares 3.3/3.3/3.4 -> floors 3/3/3 = 9, +1 remainder goes to the 3.4 share
    const result = expandCreativeAssignments([
      { creative_id: 'a', weight: 33 },
      { creative_id: 'b', weight: 33 },
      { creative_id: 'c', weight: 34 },
    ]);
    expect(result).toHaveLength(10);
    expect(result.filter(id => id === 'c')).toHaveLength(4);
    expect(result.filter(id => id === 'a')).toHaveLength(3);
    expect(result.filter(id => id === 'b')).toHaveLength(3);
  });

  it('ignores assignments with zero, negative, or non-finite weight', () => {
    const result = expandCreativeAssignments([
      { creative_id: 'a', weight: 100 },
      { creative_id: 'b', weight: 0 },
      { creative_id: 'c', weight: -5 },
      { creative_id: 'd', weight: NaN },
    ]);
    expect(result).toEqual(['a']);
  });

  it('ignores assignments with no creative_id', () => {
    const result = expandCreativeAssignments([{ creative_id: null, weight: 100 }]);
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
npx vitest run supabase/functions/_shared/creativeSelection.test.js
```
Expected: FAIL — `Cannot find module './creativeSelection.ts'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```ts
// supabase/functions/_shared/creativeSelection.ts
//
// Pure expansion of a screen's weighted creative assignments into an
// ordered, interleaved list of creative IDs. display-feed pushes one array
// entry per returned ID; DisplayPlayer already round-robins evenly through
// whatever array it's given (see src/views/display/DisplayPlayer.jsx), so
// repeating a creative_id proportionally more often is enough to achieve a
// weighted rotation with zero changes to the player itself.
//
// Weights are advertiser-set and static — this module never reads play or
// scan history, and nothing here adjusts a weight automatically.

export const CREATIVE_ROTATION_SLOTS = 10;

export interface CreativeAssignment {
  creative_id: string | null | undefined;
  weight: number;
}

export function expandCreativeAssignments(assignments: CreativeAssignment[]): string[] {
  const valid = assignments.filter(
    (a): a is { creative_id: string; weight: number } =>
      typeof a.creative_id === 'string' && a.creative_id.length > 0 &&
      Number.isFinite(a.weight) && a.weight > 0,
  );

  if (valid.length === 0) return [];
  if (valid.length === 1) return [valid[0].creative_id];

  const totalWeight = valid.reduce((sum, a) => sum + a.weight, 0);

  // Largest-remainder method: every assignment gets at least one slot no
  // matter how skewed the weights are, and the total stays at
  // CREATIVE_ROTATION_SLOTS regardless of how many assignments there are.
  const shares = valid.map(a => (a.weight / totalWeight) * CREATIVE_ROTATION_SLOTS);
  const counts = shares.map(s => Math.max(1, Math.floor(s)));
  let allocated = counts.reduce((a, b) => a + b, 0);

  const remainders = shares
    .map((s, i) => ({ i, r: s - Math.floor(s) }))
    .sort((a, b) => b.r - a.r);

  let idx = 0;
  while (allocated < CREATIVE_ROTATION_SLOTS && idx < remainders.length) {
    counts[remainders[idx].i] += 1;
    allocated += 1;
    idx += 1;
  }

  // Interleave round-robin rather than repeating one creative in a block,
  // so consecutive plays don't stack the same creative several times in a row.
  const slots: string[] = [];
  const remaining = [...counts];
  while (remaining.some(c => c > 0)) {
    for (let i = 0; i < valid.length; i++) {
      if (remaining[i] > 0) {
        slots.push(valid[i].creative_id);
        remaining[i] -= 1;
      }
    }
  }
  return slots;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
npx vitest run supabase/functions/_shared/creativeSelection.test.js
```
Expected: PASS — 8 tests.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/creativeSelection.ts supabase/functions/_shared/creativeSelection.test.js
git commit -m "feat: add pure weighted creative-expansion module for display-feed"
```

---

### Task 2: `display-feed` serves per-creative entries

**Files:**
- Modify: `supabase/functions/display-feed/index.ts:61-104`

Today, lines 61-104 build one `activeCampaigns` entry per matched, approved `campaign_screens` row, applying that row's own per-screen override fields. This task adds a lookup of any `campaign_creative_screens` assignments for this screen, and — only when at least one exists for a given booking — replaces that single entry with the weighted-expanded set of per-creative entries instead. A booking with no assignment rows (every campaign today) is completely unaffected: same single entry, same fields, `creative_id: null`.

- [ ] **Step 1: Write the replacement block**

Replace `supabase/functions/display-feed/index.ts` lines 1-2 (add the import) and lines 61-104 (the whole per-screen/per-booking assembly) with:

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { expandCreativeAssignments } from "../_shared/creativeSelection.ts";
```

```ts
  // Step 1: find approved campaign_screens for this screen (includes per-screen creative overrides)
  const { data: csRows } = await supabase
    .from("campaign_screens")
    .select("campaign_id, status, headline, cta_text, accent_color, destination_url, media_url, media_type")
    .eq("screen_id", screen.id)
    .in("status", ["approved", "auto_approved"]);

  const activeCampaigns: Record<string, unknown>[] = [];

  if (csRows && csRows.length > 0) {
    const campaignIds = csRows.map((r) => r.campaign_id);

    // Step 2: fetch bookings for those campaigns filtered by date and live status
    const { data: bookings } = await supabase
      .from("bookings")
      .select("id, advertiser_name, headline, cta_text, accent_color, destination_url, category, media_url, media_type, slots, duration, schedule_days, time_start, time_end")
      .in("id", campaignIds)
      .in("status", ["scheduled", "active"])
      .eq("payment_status", "paid")
      .lte("start_date", today)
      .gte("end_date", today);

    // Step 3: this screen's explicit creative assignments (Phase 1 schema),
    // grouped by which targeting group (booking) they belong to. A booking
    // with no rows here falls all the way through to its own single
    // creative fields, unchanged from today.
    const { data: ccsRows } = await supabase
      .from("campaign_creative_screens")
      .select("creative_id, weight")
      .eq("screen_id", screen.id);

    const creativesByTargeting = new Map<string, { creative_id: string; weight: number; media_url: string | null; media_type: string | null; headline: string | null; cta_text: string | null; destination_url: string | null; accent_color: string | null }[]>();

    if (ccsRows && ccsRows.length > 0) {
      const creativeIds = ccsRows.map((r) => r.creative_id);
      const { data: creatives } = await supabase
        .from("campaign_creatives")
        .select("id, targeting_id, status, media_url, media_type, headline, cta_text, destination_url, accent_color")
        .in("id", creativeIds)
        .eq("status", "active");

      const weightById = new Map(ccsRows.map((r) => [r.creative_id, r.weight as number]));
      for (const cr of creatives ?? []) {
        const list = creativesByTargeting.get(cr.targeting_id as string) ?? [];
        list.push({
          creative_id: cr.id as string,
          weight: weightById.get(cr.id as string) ?? 100,
          media_url: cr.media_url as string | null,
          media_type: cr.media_type as string | null,
          headline: cr.headline as string | null,
          cta_text: cr.cta_text as string | null,
          destination_url: cr.destination_url as string | null,
          accent_color: cr.accent_color as string | null,
        });
        creativesByTargeting.set(cr.targeting_id as string, list);
      }
    }

    if (bookings) {
      const csMap = new Map(csRows.map((r) => [r.campaign_id, r]));

      for (const b of bookings) {
        const cs = csMap.get(b.id);
        const days: string[] = (b.schedule_days as string[]) ?? [];
        const inDay = days.length === 0 || days.includes(currentDay);
        const inTime = currentTime >= ((b.time_start as string) ?? "00:00") && currentTime <= ((b.time_end as string) ?? "23:59");
        if (!inDay || !inTime) continue;

        const assignments = creativesByTargeting.get(b.id as string) ?? [];

        if (assignments.length === 0) {
          // Unchanged from today: per-screen override falls back to the booking's own fields.
          activeCampaigns.push({
            ...b,
            creative_id: null,
            cta: cs?.cta_text || b.cta_text,
            headline: cs?.headline || b.headline,
            accent_color: cs?.accent_color || b.accent_color,
            destination_url: cs?.destination_url || b.destination_url,
            media_url: cs?.media_url || b.media_url,
            media_type: cs?.media_type || b.media_type,
          });
          continue;
        }

        // One or more creatives explicitly assigned to this screen — expand by
        // weight and push one array entry per slot. The legacy per-screen
        // override columns on campaign_screens are not consulted here; the
        // new campaign_creatives fields are the sole source once they exist.
        const creativeById = new Map(assignments.map((a) => [a.creative_id, a]));
        const order = expandCreativeAssignments(assignments.map((a) => ({ creative_id: a.creative_id, weight: a.weight })));

        for (const creativeId of order) {
          const cr = creativeById.get(creativeId)!;
          activeCampaigns.push({
            ...b,
            creative_id: creativeId,
            cta: cr.cta_text || b.cta_text,
            headline: cr.headline || b.headline,
            accent_color: cr.accent_color || b.accent_color,
            destination_url: cr.destination_url || b.destination_url,
            media_url: cr.media_url || b.media_url,
            media_type: cr.media_type || b.media_type,
          });
        }
      }
    }
  }
```

- [ ] **Step 2: Apply the edit**

Open `supabase/functions/display-feed/index.ts`, add the import at the top (after the existing `createClient` import), and replace lines 61-104 (the block starting `// Step 1: find approved campaign_screens...` through the closing of the `if (csRows && csRows.length > 0)` block) with the code above.

- [ ] **Step 3: Deploy and verify manually**

Run:
```bash
supabase functions deploy display-feed
```

Verify the no-assignment (unchanged) path first — hit the feed for a screen with an active, approved, single-creative campaign and confirm the response is identical in shape to before this change, plus a new `"creative_id": null` field:
```bash
curl "https://<project-ref>.supabase.co/functions/v1/display-feed?token=<a-real-screen_token>"
```
Expected: `campaigns` array unchanged in content, each entry now also has `"creative_id": null`.

Then insert a test `campaign_creatives` row + two `campaign_creative_screens` rows (weights 50/50) for that same screen and campaign (using the same test pattern as Phase 1 Task 2), hit the feed again:
Expected: `campaigns` array now has 10 entries instead of 1, alternating between the two creatives' `creative_id`s, each carrying that creative's own `headline`/`media_url`/etc. Clean up the test rows afterward.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/display-feed/index.ts
git commit -m "feat: display-feed serves weighted multi-creative rotation per screen"
```

---

### Task 3: Proof-of-play attribution (`ad_plays.creative_id`)

**Files:**
- Modify: `src/lib/playBuffer.js:36-49`
- Modify: `src/lib/playBuffer.test.js:21-31`
- Modify: `supabase/functions/_shared/playValidation.ts`
- Modify: `supabase/functions/_shared/playValidation.test.js`
- Modify: `src/views/display/DisplayPlayer.jsx:226-245`

- [ ] **Step 1: Update the failing test for `playBuffer.record()`**

In `src/lib/playBuffer.test.js`, replace the existing `'records a play with a generated id when none is given'` test (lines 21-31) with:

```js
  it('records a play with a generated id when none is given', () => {
    const buf = createPlayBuffer({ storage: store, newId: () => 'gen-1' });
    buf.record({ campaign_id: 'c1', duration_s: 10, played_at: '2026-07-24T11:00:00Z' });
    expect(buf.pending()[0]).toEqual({
      campaign_id: 'c1',
      creative_id: null,
      duration_s: 10,
      played_at: '2026-07-24T11:00:00Z',
      client_play_id: 'gen-1',
      completed: true,
    });
  });

  it('records the creative_id when the played slide has one', () => {
    const buf = createPlayBuffer({ storage: store, newId: () => 'gen-1' });
    buf.record({ campaign_id: 'c1', creative_id: 'cr-9', duration_s: 10, played_at: '2026-07-24T11:00:00Z' });
    expect(buf.pending()[0].creative_id).toBe('cr-9');
  });
```

- [ ] **Step 2: Run to verify the new assertion fails**

Run:
```bash
npx vitest run src/lib/playBuffer.test.js
```
Expected: FAIL on the first test — actual object has no `creative_id` key.

- [ ] **Step 3: Update `playBuffer.js` to accept and store `creative_id`**

In `src/lib/playBuffer.js`, replace the `record()` method (lines 36-49):

```js
    record({ campaign_id, creative_id = null, duration_s, played_at, completed = true, client_play_id }) {
      if (!campaign_id) return;
      const d = Number(duration_s);
      if (!Number.isFinite(d) || d <= 0) return;
      queue.push({
        campaign_id,
        creative_id,
        client_play_id: client_play_id ?? newId(),
        played_at: played_at ?? new Date().toISOString(),
        duration_s: d,
        completed: Boolean(completed),
      });
      if (queue.length > max) queue = queue.slice(queue.length - max);
      persist();
    },
```

- [ ] **Step 4: Run to verify both tests pass**

Run:
```bash
npx vitest run src/lib/playBuffer.test.js
```
Expected: PASS — all tests including the two touched above.

- [ ] **Step 5: Add a failing test for `validatePlayBatch` passing `creative_id` through**

In `supabase/functions/_shared/playValidation.test.js`, add:

```js
  it('passes creative_id through when present, and defaults to null when absent', () => {
    const { accepted } = validatePlayBatch([
      { ...valid, client_play_id: 'p2', creative_id: 'cr-1' },
      { ...valid, client_play_id: 'p3' },
    ], now);
    expect(accepted[0].creative_id).toBe('cr-1');
    expect(accepted[1].creative_id).toBeNull();
  });
```

- [ ] **Step 6: Run to verify it fails**

Run:
```bash
npx vitest run supabase/functions/_shared/playValidation.test.js
```
Expected: FAIL — `accepted[0].creative_id` is `undefined`, not `'cr-1'`.

- [ ] **Step 7: Update `playValidation.ts`**

In `supabase/functions/_shared/playValidation.ts`:

Add `creative_id?: unknown;` to the `RawPlay` interface, and `creative_id: string | null;` to `CleanPlay`. In the `validatePlayBatch` loop, right before `seen.add(clientId);`, add:

```ts
    const creativeId = typeof raw?.creative_id === 'string' && raw.creative_id.trim() ? raw.creative_id.trim() : null;
```

And add `creative_id: creativeId,` to the object pushed into `accepted`.

- [ ] **Step 8: Run to verify it passes**

Run:
```bash
npx vitest run supabase/functions/_shared/playValidation.test.js
```
Expected: PASS.

**No change needed in `supabase/functions/ingest-plays/index.ts`.** It already does `.upsert(accepted.map(p => ({ ...p, screen_id: screen.id })), ...)` — since `accepted` items are the `CleanPlay` objects from `validatePlayBatch` and now include `creative_id`, the spread carries it straight into the `ad_plays` insert, whose `creative_id` column already exists from Phase 1.

- [ ] **Step 9: Wire `DisplayPlayer.jsx` to pass the played slide's `creative_id`**

In `src/views/display/DisplayPlayer.jsx`, in the proof-of-play `useEffect` (lines 226-245), change:

```js
    playStartRef.current = Date.now();
    const campaignId = current.id;
```
to:
```js
    playStartRef.current = Date.now();
    const campaignId = current.id;
    const creativeId = current.creative_id ?? null;
```

and change the `record(...)` call to include it:
```js
      playBufferRef.current.record({
        campaign_id: campaignId,
        creative_id: creativeId,
        played_at: new Date(startedAt).toISOString(),
        duration_s: durationS,
        completed: durationS >= (ROTATE_INTERVAL_MS / 1000) * 0.9,
      });
```

- [ ] **Step 10: Run the full test suite to confirm nothing else broke**

Run:
```bash
npm test
```
Expected: PASS, all suites green.

- [ ] **Step 11: Commit**

```bash
git add src/lib/playBuffer.js src/lib/playBuffer.test.js supabase/functions/_shared/playValidation.ts supabase/functions/_shared/playValidation.test.js src/views/display/DisplayPlayer.jsx
git commit -m "feat: attribute recorded plays to the specific creative that played"
```

---

### Task 4: Scan attribution (`scans.creative_id`)

**Files:**
- Modify: `src/views/display/DisplayPlayer.jsx:12-22`
- Modify: `supabase/functions/scan-redirect/index.ts`

- [ ] **Step 1: Add `creative_id` to the QR redirect URL**

In `src/views/display/DisplayPlayer.jsx`, change `buildQrUrl` (lines 12-18):

```js
function buildQrUrl(destinationUrl, screenId, campaignId, creativeId) {
  if (!SUPABASE_FUNCTIONS_URL || !campaignId) return destinationUrl;
  const u = new URL(`${SUPABASE_FUNCTIONS_URL}/scan-redirect`);
  u.searchParams.set('c', campaignId);
  if (screenId) u.searchParams.set('s', screenId);
  if (creativeId) u.searchParams.set('cr', creativeId);
  return u.toString();
}
```

And its call site inside `CreativeSlide` (line 22):
```js
  const qrUrl = buildQrUrl(campaign.destination_url || 'https://adgrid.io', screenId, campaign.id, campaign.creative_id);
```

- [ ] **Step 2: Read `cr` and record it in `scan-redirect`**

In `supabase/functions/scan-redirect/index.ts`, after the existing `campaignId` read near the top:

```ts
  const campaignId = url.searchParams.get("c");
  const creativeId = url.searchParams.get("cr");
```

And add `creative_id: creativeId,` to the `.from("scans").insert({...})` call — the full insert object becomes:

```ts
  const { data: scanRow } = await supabase.from("scans").insert({
    campaign_id: campaignId,
    creative_id: creativeId,
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

- [ ] **Step 3: Deploy and verify manually**

Run:
```bash
supabase functions deploy scan-redirect
```

Hit a QR URL built with a `cr` param (or construct one by hand) and confirm the resulting `scans` row has `creative_id` set:
```bash
curl -I "https://<project-ref>.supabase.co/functions/v1/scan-redirect?c=<real-campaign-id>&s=<real-screen-id>&cr=<real-creative-id>"
```
```sql
SELECT campaign_id, screen_id, creative_id FROM scans ORDER BY scanned_at DESC LIMIT 1;
```
Expected: `creative_id` matches the `cr` param passed above. Then confirm the existing no-`cr`-param path still works (a campaign with no assigned creatives):
```bash
curl -I "https://<project-ref>.supabase.co/functions/v1/scan-redirect?c=<real-campaign-id>&s=<real-screen-id>"
```
Expected: 302 redirect, unchanged from before this change; the inserted scan row has `creative_id: null`.

- [ ] **Step 4: Commit**

```bash
git add src/views/display/DisplayPlayer.jsx supabase/functions/scan-redirect/index.ts
git commit -m "feat: attribute QR scans to the specific creative that was on screen"
```

---

## Phase 2 exit criteria

- [ ] `creativeSelection.ts` unit tests pass (8 cases: empty, single, even split, skewed split, minimum-one guarantee, remainder distribution, invalid weights, missing creative_id).
- [ ] A campaign with no `campaign_creative_screens` rows serves and records identically to before this phase (verified manually against a real screen).
- [ ] A campaign with two weighted creative assignments serves a proportionally-expanded, interleaved rotation through the existing, **unmodified** `DisplayPlayer` rotation loop.
- [ ] `ad_plays.creative_id` and `scans.creative_id` populate correctly for both the assigned-creative and fallback (null) paths.
- [ ] Full `npm test` suite passes.

Phase 3 (wizard rewrite: Targeting → Creative → Budget & Schedule, the screen-assignment UI, and the campaign-name/backfill-aware submit handler) can build on top of a schema and a serving path that are both already live.
