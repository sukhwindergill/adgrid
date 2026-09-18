# Design: Enforce screens' max_ad_duration ceiling

Date: 2026-08-12
Status: approved

## Problem

Screens carry an operator-set `max_ad_duration` ceiling (collected in `ScreenOnboard`, default 30s, mentioned in the creative-spec-validation design as "reused for video max duration") but it is never actually enforced anywhere. An advertiser's booking has a single `duration` field (5-60s, "ad play duration") applied across every screen they select — nothing stops them from choosing 60s for a booking that includes a screen capped at 15s, and nothing clamps it at playback. The screen would simply play the ad for 60s regardless of the operator's configured ceiling.

This was flagged as a known, separate gap during the [display-player-per-campaign-duration](2026-08-11-display-player-per-campaign-duration-design.md) fix and deferred to this pass.

## Approach

Two independent, complementary pieces:

1. **Serve-time clamp** — the actual enforcement, at the one place that already knows both the booking's chosen duration and the specific screen serving it.
2. **Wizard advisory** — a non-blocking warning so the advertiser knows before submitting, rather than discovering a shorter-than-expected play time after paying. Matches this codebase's established advisory-only pattern for screen-fit mismatches (`creativeFit.js` / the creative-spec-validation feature): informational, never blocks submission, silent for screens with an unknown/null spec.

Rejected alternative: hard-blocking submission until duration fits every selected screen. Departs from the existing advisory-only precedent for this exact class of problem (screen constraint vs. advertiser choice) and would force awkward per-screen duration overrides the schema doesn't support today.

## Changes

### 1. `supabase/functions/_shared/adDuration.ts` (new) + `display-feed/index.ts` — serve-time clamp

No existing edge function's `index.ts` handler is unit-tested directly in this codebase — every function-level test (`deliveryExpectation.test.js`, `approvalSla.test.js`, etc.) targets a small pure module under `_shared/`. Follow that convention rather than being the first to break it:

- New `supabase/functions/_shared/adDuration.ts`:
  ```ts
  export function clampDurationToScreen(
    bookingDurationS: number,
    screenMaxAdDurationS: number | null | undefined,
  ): number {
    if (screenMaxAdDurationS == null) return bookingDurationS;
    return Math.min(bookingDurationS, screenMaxAdDurationS);
  }
  ```
- `display-feed/index.ts`:
  - Add `max_ad_duration` to the screen row's `select(...)` (currently: `id, name, operator_id, status, operating_hours_start, operating_hours_end, timezone`).
  - Import `clampDurationToScreen` and, in both branches that push onto `activeCampaigns` (the no-creative-override branch and the weighted-creative-assignment branch), override the spread booking's `duration` field: `duration: clampDurationToScreen(b.duration, screen.max_ad_duration)`.
- Null `max_ad_duration` (the common case — existing screens start with every spec field unset) means no clamp applied, consistent with "unknown spec never blocks" elsewhere in the codebase.
- No schema changes — `screens.max_ad_duration` already exists and is already collected in onboarding.

This is the only enforcement point that matters: `DisplayPlayer.jsx` already reads `campaign.duration` via `getSlideDurationMs` (from the prior fix) with no further changes needed — it will simply receive an already-clamped value.

### 2. `src/views/advertiser/createCampaign/StepBudgetReview.jsx` — wizard advisory

- New derived value, computed the same way `tooLow` (the existing budget warning) is computed — from props already in hand, no new fetch:
  ```js
  const overCapScreens = matchedScreens.filter(s =>
    typeof s.max_ad_duration === 'number' && form.duration > s.max_ad_duration
  );
  ```
- When `overCapScreens.length > 0`, render a banner (same visual treatment as the existing `tooLow` amber banner, placed near the duration input): `"N of M selected screens cap ad duration below Xs — your ad will play shorter there."` followed by up to 3 screen names (`s.name`), then `"and N more"` if more remain.
- Purely advisory. The Submit button's existing `disabled` logic is untouched.
- `matchedScreens` (passed into `StepBudgetReview` as `selectedScreens` from `CreateCampaign.jsx`) already carries `max_ad_duration` — it's spread straight from the `advertiser_screens` DB row in `App.jsx`'s `dbScreens` mapping (`...s`, alongside the existing `maxDuration` alias). No new data plumbing required.

## Known limitation (accepted, not fixed here)

`getSlideDurationMs` (from the prior fix) floors any duration to a 5s minimum for playback safety, matching the wizard's own 5-60s input bounds. If an operator ever configures `max_ad_duration` below 5s, the serve-time clamp in this change would compute e.g. 3s, but `DisplayPlayer.jsx`'s existing floor would round that back up to 5s — the operator's sub-5s ceiling would not be fully honored end-to-end. Realistic operator-configured ceilings are 15-60s; a sub-5s ceiling is not a real-world case this pass optimizes for. Documented here as a conscious scope decision, not an oversight.

## Testing approach

- `supabase/functions/_shared/adDuration.test.js` (new, following the sibling `_shared/*.test.js` pattern): booking duration below screen's max (no clamp), above (clamped to screen's max), screen `max_ad_duration` null/undefined (no clamp), booking duration exactly equal to the max (no clamp, boundary case).
- `StepBudgetReview.jsx`: extend the existing smoke test file with cases for the new banner — appears when duration exceeds a selected screen's max, silent when all selected screens have null/unset max_ad_duration or duration fits all of them, correctly lists screen names and the "and N more" overflow case.
- Manual/integration note: `clampDurationToScreen` is applied per-screen inside `display-feed`, so a single booking spanning multiple screens with different ceilings gets independently clamped per screen's own feed response — not a single global clamp across the booking. No dedicated test for this multi-screen interaction beyond the pure function's own unit tests, since `index.ts` itself isn't unit-tested anywhere in this codebase (see above).
