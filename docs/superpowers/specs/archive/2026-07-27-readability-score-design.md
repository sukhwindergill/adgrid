# Readability Score — Design

**Date:** 2026-07-27
**Status:** Approved for planning
**Part of:** Phase 4 (Creative Pipeline) — second of four independent sub-projects (specs+validation ✅ shipped, readability, creative studio/templates, variant testing). Each ships and is specced separately.

## Problem

OOH creative lives or dies on the "3–5 second rule": a viewer glances at a screen for a few seconds while walking, riding, or driving past. Too many words, text that gets cut off, or a call-to-action that's hard to read against its background all silently fail — the advertiser never finds out until the campaign underperforms, if they find out at all. No self-serve platform in this space enforces any of this in-product.

AdGrid's ad creative is one of two things: an uploaded image/video, or a generated card built entirely from platform-controlled fields (`headline`, `cta_text`, `accent_color`). `CreativePreview` (`src/components/shared/CreativePreview.jsx`) renders the headline at a **fixed 13px, clamped to 2 lines** (`WebkitLineClamp: 2`) — advertisers choose the text, never the size. Nothing today checks whether that text actually fits, whether it's readable in the time the ad plays, or whether the CTA's color reads against its background.

## Goal

Score the platform-controlled creative fields against the campaign's actual play duration and the fixed rendering rules `CreativePreview` already enforces, surface a 0–100 score with concrete, actionable fixes, and show a blurred preview simulating how the ad reads from a realistic viewing distance for the selected screens. Advisory only, exactly like the creative-fit check shipped in the prior sub-project — never blocks the wizard.

## Non-goals (explicitly out of scope for this pass)

- **Reading text baked into an uploaded creative image.** That would require OCR (e.g. Tesseract.js or a cloud API) — a heavy, unreliable dependency for what the original gap analysis explicitly calls a "P1, high perceived value, **cheap**" feature. The score only ever looks at `headline`, `cta_text`, and `accent_color` — fields the platform already controls and renders itself. An advertiser who uploads a fully custom design with its own baked-in text gets the blur-test preview (which shows the whole frame, uploaded media included) but not a text-based score for that image's own text.
- **`subline`.** A `bookings.subline` column exists but is never read by any frontend file today — nothing renders it, so nothing needs scoring. Out of scope until it's actually wired into a preview.
- **Auto-editing or auto-shortening copy.** The score names the problem ("14 words — a 10s play gives time to read about 8"); the advertiser edits their own headline. No AI rewrite, no auto-truncation-with-ellipsis-insertion.
- **Per-screen blur previews.** Screens are bucketed into at most two viewing-distance tiers (near/far); one preview renders per distinct tier actually represented among selected screens, not one per screen.
- **True physical viewing-distance modelling.** `screens.display_size` is free text and unparsed; there's no reliable physical screen size or measured foot-traffic viewing angle to build real distance math on. The near/far tier is a simple heuristic off `environment` (outdoor → far, indoor → close), not physics.

## Design

### 1. Scope & architecture

A new pure module, `src/lib/creativeReadability.js`, mirrors the shape and philosophy of `src/lib/creativeFit.js`: no DOM, no network, no OCR — takes already-known strings/numbers and returns a verdict. It is shared between the advertiser wizard and the operator's approval queue, exactly like `checkCreativeFit` is today.

The blur-test preview is a separate, purely visual affordance with no scoring math of its own — it reuses `CreativePreview`'s existing prop-extension pattern (the `aspectRatio` prop added for creative-fit) by adding a new `blurPx` prop.

### 2. The score

```js
checkReadability(
  { headline, ctaText, accentColor, durationSeconds }
) → { score: number /* 0-100 */, issues: [{ type, message }] }
```

Three independent checks, each a deduction from a starting score of 100, floored at 0:

**a. Read-time fit.** Word count of `headline` + `ctaText` against how many words a viewer can actually read in `durationSeconds`, using a documented OOH rule-of-thumb reading rate (~2.5 words/second — a citeable, conservative estimate for a glance-read, not a careful read). If word count exceeds the readable count, deduct proportionally to the overage and report a concrete message, e.g. *"14 words — a 10s play gives time to read about 8."* `durationSeconds` comes from the campaign's existing `duration` field (already collected in the wizard's Budget & Schedule step, defaulted to 15s from the moment the wizard opens — so it's always available, even while the advertiser is still on the earlier Creative step).

**b. Truncation risk.** `CreativePreview` renders the headline at a fixed 13px with `WebkitLineClamp: 2` inside a frame region of known proportions (`left: 14, right: 60` relative to the preview width). A character-count heuristic (average glyph width for a 13px bold Georgia serif, not a canvas/DOM text measurement — keeping the module pure) estimates whether the headline would exceed two lines at that width. If so, deduct a fixed penalty and report *"Headline likely truncates past 2 lines at this length."* This is deliberately a heuristic estimate, not a pixel-perfect render check — advisory tools don't need to be exact, they need to catch the obvious case.

**c. CTA contrast.** The headline is always rendered white-on-dark with a drop shadow — already safe, never checked. The CTA is the only text using a variable color (`accent_color`, the campaign's chosen accent). Compute the WCAG contrast ratio of `accentColor` against `#050a10` — the darkest stop of `CreativePreview`'s background gradient (`linear-gradient(160deg, #050a10 0%, #0d1520 60%, ${bg}22 100%)`), used as the reference since the CTA sits near the bottom-left of the frame where that stop dominates. If under 4.5:1 (WCAG AA for normal text), deduct and report the actual ratio, e.g. *"CTA color has weak contrast against the background (2.1:1, needs 4.5:1)."*

The score is advisory only — it never disables the wizard's Next/Submit button, identical to how `checkCreativeFit` never blocks today.

### 3. Blur-test preview

`CreativePreview` gains a `blurPx` prop, defaulting to `0` so every existing call site (`ApprovalQueue.jsx`, `CreateCampaign.jsx`'s own preview) is unaffected — same pattern as the `aspectRatio` prop. A CSS `filter: blur(${blurPx}px)` is applied to the whole rendered frame.

Each selected screen's `environment` field (`'indoor' | 'outdoor'`) maps to a viewing-distance tier: `outdoor` → "far" (heavier blur, e.g. 7px), `indoor` → "close" (light blur, e.g. 2px). The wizard and approval queue render one preview per **distinct tier actually represented** among the relevant screens — at most two previews, never one per screen. A screen with no `environment` set contributes to neither tier (matches the "unknown means don't guess" precedent from creative-fit).

Unlike the fit-mismatch panel (which only renders when there's a problem), the blur-test preview always renders whenever a headline exists — it's a preview of what the ad will actually look like, not a warning, so there's always something worth showing.

### 4. Where it surfaces

- **Wizard Step 3 (Creative)**, in `CreateCampaign.jsx`, next to the existing `CreativeFitPanel` — same location, same advisory tone, computed from `form` state that's already present at that step.
- **Operator's Approval Queue**, in `ApprovalQueue.jsx`, next to the existing creative-fit badge — reusing `checkReadability` the same way `checkCreativeFit` is reused there today.

### 5. Testing approach

- `creativeReadability.test.js`: exhaustive unit tests per check — read-time boundary (exactly at the limit, one word over), truncation boundary (headline exactly at the estimated character limit, one character over), contrast boundary (ratio exactly at 4.5:1, just under), plus combined-issues cases — matching the density and boundary-case discipline of `creativeFit.test.js`.
- `CreativePreview`'s new `blurPx` prop: a rendering test confirming the default (`0`, or omitted) produces no blur filter, and a passed value applies it — mirroring the existing `aspectRatio` prop test.
- Manual verification: submit a campaign with a deliberately long headline and a low-contrast accent color, confirm the score reflects both issues with correct messages, and confirm the blur preview renders for both an indoor and an outdoor screen selection.

## Open questions

None — all resolved during brainstorming (see decisions above: structured-fields-only scope, near/far heuristic from `environment`, one preview per tier not per screen).
