# Display Player Per-Campaign Duration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the physical-screen player (`DisplayPlayer.jsx`) rotate each ad for the duration the advertiser actually chose (`bookings.duration`, already stored and already sent by `display-feed`), instead of a hardcoded 10-second interval shared by every campaign.

**Architecture:** Extract a pure, testable `getSlideDurationMs(campaign)` helper (parses/sanitizes/clamps `campaign.duration` to `[5s, 60s]`, defaulting to `10s`) into its own lib module, matching the existing `src/lib/getCreativeRenderPlan.js` pattern. Wire it into `DisplayPlayer.jsx`'s rotation effect (replace the shared `setInterval` with a `setTimeout` re-armed per slide) and into the proof-of-play `completed` calculation.

**Tech Stack:** React 18, Vitest, `@testing-library/react`. No backend/schema changes — `duration` already flows `bookings` → `display-feed` → `campaigns[]`.

---

## Reference: spec

Design doc: `docs/superpowers/specs/2026-08-11-display-player-per-campaign-duration-design.md`

## Reference: current file (before this plan touches it)

`src/views/display/DisplayPlayer.jsx` today:
- Line 11: `const ROTATE_INTERVAL_MS = 10_000;`
- Lines ~214-228: rotation effect using `setInterval(fn, ROTATE_INTERVAL_MS)`
- Lines ~239-260: play-recording effect, `completed: durationS >= (ROTATE_INTERVAL_MS / 1000) * 0.9`

---

### Task 1: `getSlideDurationMs` helper

**Files:**
- Create: `src/lib/getSlideDuration.js`
- Test: `src/lib/getSlideDuration.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/getSlideDuration.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { getSlideDurationMs } from './getSlideDuration.js';

describe('getSlideDurationMs', () => {
  it('converts a valid duration in seconds to milliseconds', () => {
    expect(getSlideDurationMs({ duration: 5 })).toBe(5000);
    expect(getSlideDurationMs({ duration: 20 })).toBe(20000);
    expect(getSlideDurationMs({ duration: 60 })).toBe(60000);
  });

  it('clamps a duration above 60s down to 60s', () => {
    expect(getSlideDurationMs({ duration: 999 })).toBe(60000);
  });

  it('clamps a duration below 5s up to 5s', () => {
    expect(getSlideDurationMs({ duration: 3 })).toBe(5000);
  });

  it('falls back to 10s when duration is missing', () => {
    expect(getSlideDurationMs({})).toBe(10000);
    expect(getSlideDurationMs(undefined)).toBe(10000);
  });

  it('falls back to 10s when duration is null, zero, negative, or non-numeric', () => {
    expect(getSlideDurationMs({ duration: null })).toBe(10000);
    expect(getSlideDurationMs({ duration: 0 })).toBe(10000);
    expect(getSlideDurationMs({ duration: -5 })).toBe(10000);
    expect(getSlideDurationMs({ duration: 'abc' })).toBe(10000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/getSlideDuration.test.js`
Expected: FAIL — `Failed to resolve import "./getSlideDuration.js"` (module does not exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/getSlideDuration.js`:

```js
// src/lib/getSlideDuration.js
/**
 * How long a campaign's slide should stay on the physical screen.
 *
 * campaign.duration comes straight from bookings.duration (seconds), set by
 * the advertiser in the wizard's Budget & Schedule step (StepBudgetReview.jsx,
 * 5-60s input) and passed through unmodified by display-feed. This is the
 * single place that turns that advertiser-chosen number into a safe
 * milliseconds value for DisplayPlayer.jsx's rotation timer — sanitizing
 * missing/zero/negative/non-numeric values to a 10s default, and clamping
 * the result to [5s, 60s] so a bad row can never freeze or flicker a
 * physical display.
 */
export function getSlideDurationMs(campaign, { defaultS = 10, minS = 5, maxS = 60 } = {}) {
  const raw = parseInt(campaign?.duration, 10);
  const seconds = Number.isFinite(raw) && raw > 0 ? raw : defaultS;
  const clamped = Math.min(maxS, Math.max(minS, seconds));
  return clamped * 1000;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/getSlideDuration.test.js`
Expected: PASS — 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/getSlideDuration.js src/lib/getSlideDuration.test.js
git commit -m "feat: add getSlideDurationMs helper for per-campaign ad rotation timing"
```

---

### Task 2: Wire per-campaign duration into `DisplayPlayer.jsx`

**Files:**
- Modify: `src/views/display/DisplayPlayer.jsx`
- Test: `src/views/display/DisplayPlayer.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `src/views/display/DisplayPlayer.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { DisplayPlayer } from './DisplayPlayer.jsx';

function campaign(id, duration, headline) {
  return { id, duration, headline, destination_url: '', category: '', accent_color: '#7c3aed' };
}

function mockFeed(campaigns) {
  global.fetch = vi.fn((url) => {
    const u = String(url);
    if (u.includes('/display-feed')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ screen_id: 'scr-1', screen_name: 'Test Screen', campaigns }),
      });
    }
    // ingest-plays and anything else — accepted no-op.
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

describe('DisplayPlayer rotation timing', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('advances each slide after its own duration, not a fixed 10s', async () => {
    mockFeed([campaign('b1', 5, 'Slide A'), campaign('b2', 20, 'Slide B')]);
    render(<DisplayPlayer screenToken="tok" />);

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(await screen.findByText('Slide A')).toBeInTheDocument();

    // Just before the 5s duration elapses, still on slide A.
    await act(async () => { await vi.advanceTimersByTimeAsync(4999); });
    expect(screen.getByText('Slide A')).toBeInTheDocument();

    // Past 5s + the 400ms fade swap, slide B is showing.
    await act(async () => { await vi.advanceTimersByTimeAsync(2 + 400); });
    expect(await screen.findByText('Slide B')).toBeInTheDocument();
  });

  it('falls back to 10s for a campaign with no duration set', async () => {
    mockFeed([campaign('b1', null, 'Slide A'), campaign('b2', 15, 'Slide B')]);
    render(<DisplayPlayer screenToken="tok" />);

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(await screen.findByText('Slide A')).toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(9999); });
    expect(screen.getByText('Slide A')).toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(2 + 400); });
    expect(await screen.findByText('Slide B')).toBeInTheDocument();
  });

  it('never advances when only one campaign is on the feed', async () => {
    mockFeed([campaign('b1', 5, 'Only Slide')]);
    render(<DisplayPlayer screenToken="tok" />);

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(await screen.findByText('Only Slide')).toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(screen.getByText('Only Slide')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/views/display/DisplayPlayer.test.jsx`
Expected: FAIL on the first test — slide A holds for the fixed 10s interval, so it is still "Slide A" at the point the test expects "Slide B" (asserted after only ~5.4s).

- [ ] **Step 3: Modify the rotation effect and completed calculation**

In `src/views/display/DisplayPlayer.jsx`:

Add the import alongside the other lib imports (top of file):

```js
import { getSlideDurationMs } from '../../lib/getSlideDuration.js';
```

Delete the now-unused constant:

```js
const ROTATE_INTERVAL_MS = 10_000;
```

Replace the rotation effect (`// Rotate campaigns` block) with:

```js
  // Rotate campaigns — each slide gets its own duration (campaign.duration,
  // sanitized/clamped by getSlideDurationMs) instead of one fixed interval
  // shared by every campaign on the screen.
  useEffect(() => {
    if (campaigns.length < 2) return;
    const current = campaigns[currentIdx];
    const timeoutId = setTimeout(() => {
      setFadeIn(false);
      rotateRef.current = setTimeout(() => {
        setCurrentIdx(i => {
          const next = (i + 1) % campaigns.length;
          currentIdxRef.current = next;
          return next;
        });
        setFadeIn(true);
      }, 400);
    }, getSlideDurationMs(current));
    return () => { clearTimeout(timeoutId); clearTimeout(rotateRef.current); };
  }, [campaigns, currentIdx]);
```

Replace the play-recording effect's body (`// Record proof of play` block) with:

```js
  // Record proof of play for the creative that is leaving the screen — on
  // rotation, on feed change, and on unmount — so duration_s is the time the
  // creative was actually on the glass, not the nominal slot length.
  //
  // This records THAT a creative played, never who saw it. Audience data comes
  // only from the CV agent (see the note above).
  useEffect(() => {
    const current = campaigns[currentIdx];
    if (status !== 'ok' || !current || !screenId) return;

    playStartRef.current = Date.now();
    const campaignId = current.id;
    const creativeId = current.creative_id ?? null;
    const slotMs = getSlideDurationMs(current);

    return () => {
      const startedAt = playStartRef.current;
      if (!startedAt) return;
      const durationS = (Date.now() - startedAt) / 1000;
      if (durationS <= 0) return;
      playBufferRef.current.record({
        campaign_id: campaignId,
        creative_id: creativeId,
        played_at: new Date(startedAt).toISOString(),
        duration_s: durationS,
        completed: durationS >= (slotMs / 1000) * 0.9,
      });
    };
  }, [campaigns, currentIdx, status, screenId]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/views/display/DisplayPlayer.test.jsx`
Expected: PASS — 3 tests passing.

- [ ] **Step 5: Run the full test suite to check for regressions**

Run: `npx vitest run`
Expected: PASS — no other test references `ROTATE_INTERVAL_MS` or the old rotation timing (confirmed during planning: only `DisplayPlayer.jsx` itself referenced the constant).

- [ ] **Step 6: Commit**

```bash
git add src/views/display/DisplayPlayer.jsx src/views/display/DisplayPlayer.test.jsx
git commit -m "fix(display): rotate each campaign for its own configured duration

DisplayPlayer previously rotated every campaign on a fixed 10s timer,
ignoring bookings.duration entirely -- the advertiser's 5-60s ad-length
choice in the wizard had no effect on the physical screen. Extract
getSlideDurationMs to sanitize/clamp the stored duration and use it to
re-arm the rotation timeout per slide, and to grade proof-of-play
completion against the real slot length instead of the old constant."
```

---

## Self-review notes

- **Spec coverage:** sanitization helper (Task 1), rotation effect replacement (Task 2 step 3), `completed` flag fix (Task 2 step 3), `ROTATE_INTERVAL_MS` removal (Task 2 step 3), tests for fallback/clamp (Task 1) and end-to-end timing/single-campaign (Task 2) — all covered. Daypart filtering and the `max_ad_duration` cross-check are explicitly out of scope per the design doc; no task needed.
- **Type consistency:** `getSlideDurationMs(campaign, options?)` signature is identical everywhere it's called (Task 2 step 3, twice) and in every test (Task 1). `campaign.duration` is read the same way (`campaign?.duration`) in the helper as it is stored (`bookings.duration`, integer seconds) and shipped by `display-feed` (`select(..., duration, ...)`).
- **No placeholders:** every step has literal code to write and an exact command with its expected result.
