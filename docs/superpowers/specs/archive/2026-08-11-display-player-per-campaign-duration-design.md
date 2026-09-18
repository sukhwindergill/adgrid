# Design: Display player honors per-campaign ad duration

Date: 2026-08-11
Status: approved

## Problem

The advertiser wizard already lets an advertiser set an "ad play duration" (5–60s, `bookings.duration`) and a daypart window (`time_start`/`time_end`, `schedule_days`). Both are persisted, and `display-feed` already filters campaigns by day/time correctly.

But `DisplayPlayer.jsx` — the component that actually runs on the physical screen — rotates every campaign on a single hardcoded `ROTATE_INTERVAL_MS = 10_000`. It never reads `campaign.duration`. So the duration control in the wizard is inert: a 5s booking and a 60s booking play for identical time on the glass today.

Time-of-day targeting is unaffected by this bug and is out of scope for this change.

## Approach

Replace the fixed `setInterval` rotation with a `setTimeout` that is re-armed for each slide, using that slide's own sanitized duration. This mirrors the fade-then-advance pattern already in the file and needs no new state machine.

Rejected alternatives:
- **Tick-based interval** (fire every 1s, compare accumulated elapsed time against each slide's duration): more state, no benefit over a plain re-armed timeout for this use case.
- **requestAnimationFrame loop:** frame-precision is unnecessary for slide rotation; ads are static images or looping video, not frame-critical.

## Changes

### `src/views/display/DisplayPlayer.jsx`

1. **Duration sanitization helper** — `getSlideDurationMs(campaign)`:
   - reads `campaign.duration` (seconds, from the booking row)
   - `parseInt`, fallback to `10` if missing/NaN/≤0
   - clamp to `[5, 60]` (matches the wizard's own input bounds at `StepBudgetReview.jsx`)
   - returns milliseconds

2. **Rotation effect** — replaces the current `setInterval(…, ROTATE_INTERVAL_MS)` effect:
   - keyed on `[campaigns, currentIdx, status]`
   - if `campaigns.length < 2`, no timer (single-campaign screens display indefinitely, unchanged behavior)
   - otherwise: `setTimeout(getSlideDurationMs(campaigns[currentIdx]))` → on fire, same fade-out/advance-index/fade-in sequence as today
   - cleared on effect re-run/unmount

3. **Proof-of-play `completed` flag** — the play-recording effect currently computes:
   ```js
   completed: durationS >= (ROTATE_INTERVAL_MS / 1000) * 0.9
   ```
   This changes to compare against the *same slide's* sanitized duration (via `getSlideDurationMs`) instead of the old fixed constant, so a 5s ad isn't graded "incomplete" against a 10s yardstick.

4. `ROTATE_INTERVAL_MS` constant is removed (no longer used anywhere).

### No other files change

- `display-feed/index.ts` already selects and returns `duration` on every booking — no edge function change needed.
- `bookings.duration` column, wizard UI, and daypart filtering are untouched.

## Testing

New `src/views/display/DisplayPlayer.test.jsx` (fake timers):
- a campaign with `duration: 5` advances at 5s, not 10s
- a campaign with missing/garbage `duration` (`null`, `0`, `-3`, `"abc"`) falls back to 10s
- a campaign with `duration: 999` clamps to 60s
- single-campaign feed never advances (no timer armed)

## Known related gap (not fixed here)

Advertiser-chosen `duration` is never validated against a screen's `max_ad_duration` ceiling (operator-set, default 30s). A booking could specify 60s on a screen capped at 30s. Flagging for a separate pass — out of scope for this fix, which only makes the player honor whatever duration is already stored.
