# Max Ad Duration Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A screen's operator-configured `max_ad_duration` ceiling actually gets enforced — `display-feed` clamps each booking's chosen duration to the serving screen's ceiling — and the advertiser wizard shows a non-blocking warning when their chosen duration exceeds a selected screen's ceiling.

**Architecture:** A tiny pure clamp function (`clampDurationToScreen`) in `supabase/functions/_shared/`, matching the codebase's existing pattern of pure, independently-tested logic modules feeding edge functions. `display-feed/index.ts` calls it per screen when building each campaign's feed entry. `StepBudgetReview.jsx` gets a derived warning banner computed from props it already receives — no new data plumbing.

**Tech Stack:** Deno edge functions (TypeScript), React, Vitest. No schema changes — `screens.max_ad_duration` already exists.

---

## Reference: spec

Design doc: `docs/superpowers/specs/2026-08-12-max-ad-duration-enforcement-design.md`

## Reference: current files (before this plan touches them)

- `supabase/functions/display-feed/index.ts` — screen select at line 27 (no `max_ad_duration`); two `activeCampaigns.push({...b, ...})` call sites at lines ~139 and ~161, neither overrides `duration`.
- `src/views/advertiser/createCampaign/StepBudgetReview.jsx` — has an existing `tooLow` budget-warning banner (lines 24-25 compute it, lines 95-99 render it) to match the visual style of the new banner. Duration input is at line 117-119. `matchedScreens` prop (from `CreateCampaign.jsx`'s `selectedScreens`) already carries `max_ad_duration`, spread from the DB row in `App.jsx`.

---

### Task 1: `clampDurationToScreen` pure helper

**Files:**
- Create: `supabase/functions/_shared/adDuration.ts`
- Test: `supabase/functions/_shared/adDuration.test.js`

- [ ] **Step 1: Write the failing test**

Create `supabase/functions/_shared/adDuration.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { clampDurationToScreen } from './adDuration.ts';

describe('clampDurationToScreen', () => {
  it('passes the booking duration through unchanged when it is below the screen max', () => {
    expect(clampDurationToScreen(15, 30)).toBe(15);
  });

  it('clamps the booking duration down to the screen max when it exceeds it', () => {
    expect(clampDurationToScreen(60, 30)).toBe(30);
  });

  it('passes the booking duration through unchanged when it exactly equals the screen max', () => {
    expect(clampDurationToScreen(30, 30)).toBe(30);
  });

  it('passes the booking duration through unchanged when the screen has no configured max', () => {
    expect(clampDurationToScreen(60, null)).toBe(60);
    expect(clampDurationToScreen(60, undefined)).toBe(60);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/_shared/adDuration.test.js`
Expected: FAIL — `Failed to resolve import "./adDuration.ts"` (module does not exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `supabase/functions/_shared/adDuration.ts`:

```ts
// supabase/functions/_shared/adDuration.ts
/**
 * Clamps a booking's chosen ad-play duration (bookings.duration, 5-60s,
 * set by the advertiser in the campaign wizard) to the specific screen's
 * operator-configured max_ad_duration ceiling. Used by display-feed so a
 * screen never plays an ad longer than its operator allows, regardless of
 * what the advertiser picked.
 *
 * A null/undefined screenMaxAdDurationS means the screen has no configured
 * ceiling -- the common case, since existing screens start with every spec
 * field unset -- and the booking's duration passes through unclamped,
 * matching the "unknown spec never blocks" pattern used elsewhere in this
 * codebase (see creativeFit.js).
 */
export function clampDurationToScreen(
  bookingDurationS: number,
  screenMaxAdDurationS: number | null | undefined,
): number {
  if (screenMaxAdDurationS == null) return bookingDurationS;
  return Math.min(bookingDurationS, screenMaxAdDurationS);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run supabase/functions/_shared/adDuration.test.js`
Expected: PASS — 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/adDuration.ts supabase/functions/_shared/adDuration.test.js
git commit -m "feat: add clampDurationToScreen helper for max_ad_duration enforcement"
```

---

### Task 2: Wire the clamp into `display-feed`

**Files:**
- Modify: `supabase/functions/display-feed/index.ts`

This edge function has no direct unit test in this codebase (every existing test targets a `_shared/*.ts` pure module, never an `index.ts` handler) — Task 1's test is the coverage for the logic; this task is pure wiring, verified by reading the diff and by the full test suite staying green (nothing here is JS/TS reachable from a Vitest test, since `index.ts` itself isn't imported by any test file).

- [ ] **Step 1: Add `max_ad_duration` to the screen select**

In `supabase/functions/display-feed/index.ts`, change:

```ts
  const { data: screen, error: screenError } = await supabase
    .from("screens")
    .select("id, name, operator_id, status, operating_hours_start, operating_hours_end, timezone")
    .eq("screen_token", screenToken)
    .single();
```

to:

```ts
  const { data: screen, error: screenError } = await supabase
    .from("screens")
    .select("id, name, operator_id, status, operating_hours_start, operating_hours_end, timezone, max_ad_duration")
    .eq("screen_token", screenToken)
    .single();
```

- [ ] **Step 2: Import the clamp helper**

At the top of the file, alongside the existing import:

```ts
import { expandCreativeAssignments } from "../_shared/creativeSelection.ts";
```

add:

```ts
import { clampDurationToScreen } from "../_shared/adDuration.ts";
```

- [ ] **Step 3: Apply the clamp in both `activeCampaigns.push` call sites**

First call site (the no-creative-override branch):

```ts
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
```

becomes:

```ts
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
            duration: clampDurationToScreen(b.duration as number, screen.max_ad_duration as number | null),
          });
          continue;
        }
```

Second call site (the weighted-creative-assignment branch):

```ts
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
            qr_x: cr.qr_x ?? b.qr_x,
            qr_y: cr.qr_y ?? b.qr_y,
            qr_size_pct: cr.qr_size_pct ?? b.qr_size_pct,
            qr_fg_color: cr.qr_fg_color ?? b.qr_fg_color,
            qr_bg_color: cr.qr_bg_color ?? b.qr_bg_color,
          });
        }
```

becomes:

```ts
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
            qr_x: cr.qr_x ?? b.qr_x,
            qr_y: cr.qr_y ?? b.qr_y,
            qr_size_pct: cr.qr_size_pct ?? b.qr_size_pct,
            qr_fg_color: cr.qr_fg_color ?? b.qr_fg_color,
            qr_bg_color: cr.qr_bg_color ?? b.qr_bg_color,
            duration: clampDurationToScreen(b.duration as number, screen.max_ad_duration as number | null),
          });
        }
```

- [ ] **Step 4: Run the full test suite to check for regressions**

Run: `npx vitest run`
Expected: PASS — same count as baseline (no test imports `display-feed/index.ts` directly, so this step confirms nothing else broke, not this file's own logic — that's covered by Task 1).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/display-feed/index.ts
git commit -m "fix(display-feed): clamp booking duration to each screen's max_ad_duration

A screen's operator-configured max_ad_duration ceiling was collected at
onboarding but never enforced anywhere -- an advertiser's chosen ad-play
duration (5-60s) was sent to every selected screen unclamped, regardless
of that screen's own ceiling. Apply clampDurationToScreen per screen when
building its feed response, so a screen never plays an ad longer than its
operator allows. Null max_ad_duration (spec unknown, the common case)
passes the booking's duration through unchanged."
```

---

### Task 3: Wizard advisory banner

**Files:**
- Modify: `src/views/advertiser/createCampaign/StepBudgetReview.jsx`
- Test: `src/views/advertiser/createCampaign/StepBudgetReview.smoke.test.jsx`

- [ ] **Step 1: Write the failing test**

In `src/views/advertiser/createCampaign/StepBudgetReview.smoke.test.jsx`, add two new screen fixtures and a new `describe`/`it` block. First, add near the top (after the existing `SCREEN_A`/`SCREEN_B` fixtures):

```jsx
const SCREEN_CAPPED = {
  id: 'scr-3', name: 'Subway Platform — King St', city: 'London', environment: 'indoor',
  impressions: 50000, max_ad_duration: 15,
};
```

Then add this test inside the existing `describe('StepBudgetReview', () => { ... })` block, after the last existing `it(...)`:

```jsx
  it('warns when the chosen duration exceeds a selected screen\'s max_ad_duration', () => {
    const form = { ...baseForm, duration: 30 };
    render(
      <StepBudgetReview
        form={form}
        setForm={() => {}}
        matchedScreens={[SCREEN_A, SCREEN_CAPPED]}
        profile={null}
        onSubmit={() => {}}
        submitting={false}
        err={null}
        canChooseBilling={false}
        billedTo="client"
        setBilledTo={() => {}}
      />
    );
    expect(screen.getByText(/1 of 2 selected screens cap ad duration below 30s/)).toBeInTheDocument();
    expect(screen.getByText(/Subway Platform — King St/)).toBeInTheDocument();
  });

  it('does not warn when every selected screen has no configured max_ad_duration', () => {
    const form = { ...baseForm, duration: 30 };
    render(
      <StepBudgetReview
        form={form}
        setForm={() => {}}
        matchedScreens={[SCREEN_A, SCREEN_B]}
        profile={null}
        onSubmit={() => {}}
        submitting={false}
        err={null}
        canChooseBilling={false}
        billedTo="client"
        setBilledTo={() => {}}
      />
    );
    expect(screen.queryByText(/cap ad duration/)).not.toBeInTheDocument();
  });

  it('does not warn when the chosen duration fits every selected screen\'s max_ad_duration', () => {
    const form = { ...baseForm, duration: 10 };
    render(
      <StepBudgetReview
        form={form}
        setForm={() => {}}
        matchedScreens={[SCREEN_A, SCREEN_CAPPED]}
        profile={null}
        onSubmit={() => {}}
        submitting={false}
        err={null}
        canChooseBilling={false}
        billedTo="client"
        setBilledTo={() => {}}
      />
    );
    expect(screen.queryByText(/cap ad duration/)).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/views/advertiser/createCampaign/StepBudgetReview.smoke.test.jsx`
Expected: FAIL on the first new test — no banner exists yet, so `getByText(/1 of 2 selected screens.../)` finds nothing.

- [ ] **Step 3: Add the derived warning and render it**

In `src/views/advertiser/createCampaign/StepBudgetReview.jsx`, find the existing `tooLow` computation:

```js
  const tooLow = budget > 0 && matchedScreens.length > 0 && days > 0
    && (budget / matchedScreens.length / days) < 0.50;
```

Add immediately after it:

```js
  const overCapScreens = matchedScreens.filter(s =>
    typeof s.max_ad_duration === 'number' && Number(form.duration) > s.max_ad_duration
  );
```

Find the existing `tooLow` banner render block:

```jsx
          {tooLow && (
            <div style={{ padding: '10px 14px', background: C.amberSoft, border: `1px solid ${C.amberBorder}`, borderRadius: 8, fontSize: 12, color: C.amber, fontFamily: F.sans }}>
              ⚠ Budget may be too low to run consistently across all selected screens. Consider increasing your budget or reducing screen count.
            </div>
          )}
```

Add immediately after it:

```jsx
          {overCapScreens.length > 0 && (
            <div style={{ padding: '10px 14px', background: C.amberSoft, border: `1px solid ${C.amberBorder}`, borderRadius: 8, fontSize: 12, color: C.amber, fontFamily: F.sans }}>
              ⚠ {overCapScreens.length} of {matchedScreens.length} selected screens cap ad duration below {form.duration}s — your ad will play shorter there: {overCapScreens.slice(0, 3).map(s => s.name).join(', ')}{overCapScreens.length > 3 ? ` and ${overCapScreens.length - 3} more` : ''}.
            </div>
          )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/views/advertiser/createCampaign/StepBudgetReview.smoke.test.jsx`
Expected: PASS — 7 tests passing (4 original + 3 new).

- [ ] **Step 5: Run the full test suite to check for regressions**

Run: `npx vitest run`
Expected: PASS — no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/views/advertiser/createCampaign/StepBudgetReview.jsx src/views/advertiser/createCampaign/StepBudgetReview.smoke.test.jsx
git commit -m "feat(wizard): warn when ad duration exceeds a selected screen's max_ad_duration

Non-blocking advisory, matching the existing tooLow-budget banner pattern
and this codebase's advisory-only precedent for screen-fit mismatches
(creativeFit.js). Screens with no configured max_ad_duration are silently
skipped -- unknown spec never blocks, same as elsewhere. Actual enforcement
happens server-side in display-feed (see the prior commit); this banner
only tells the advertiser about it before they submit."
```

---

## Self-review notes

- **Spec coverage:** serve-time clamp (Task 1 + Task 2), wizard advisory (Task 3), null-max_ad_duration passthrough (tested in Task 1, applies automatically in Task 2 since the helper is reused, and explicitly tested in Task 3's second new test) — all covered. The documented known limitation (sub-5s ceilings not fully honored by `getSlideDurationMs`'s existing floor) is an accepted scope decision per the spec, not something a task needs to address.
- **Type consistency:** `clampDurationToScreen(bookingDurationS, screenMaxAdDurationS)` signature is identical everywhere it's referenced (Task 1's implementation and tests, Task 2's two call sites). `max_ad_duration` is the field name used consistently (DB column, `display-feed`'s select, `StepBudgetReview`'s `overCapScreens` filter, and the test fixture `SCREEN_CAPPED`).
- **No placeholders:** every step has literal code and an exact command with its expected result.
