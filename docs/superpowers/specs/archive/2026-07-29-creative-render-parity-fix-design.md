# Creative Render Parity Fix — Design

**Date:** 2026-07-29
**Status:** Approved for planning
**Context:** Found during manual verification of the Creative Studio / Templates branch (`docs/superpowers/specs/2026-07-27-creative-studio-templates-design.md`). Not part of that branch's original scope — a pre-existing gap that branch's changes made more consequential.

## Problem

`src/views/display/DisplayPlayer.jsx`'s `CreativeSlide` — what actually renders on physical screens — is a completely separate, hand-rolled implementation from `src/components/shared/CreativePreview.jsx` — what the wizard and operator approval queue show. They have never been kept in sync:

- `CreativeSlide` unconditionally renders headline/CTA/category regardless of whether the campaign has an uploaded creative. `CreativePreview` (as of this session) skips all of that whenever `media_url` is set, on the reasoning that an uploaded creative is the complete ad and the platform shouldn't add its own text on top of it.
- `CreativeSlide` never reads `creative_template` at all — every campaign plays back in one fixed layout regardless of what template was chosen in the wizard.
- `CreativeSlide` reads the legacy `campaign.cta` field name; the rest of the app moved to `cta_text` a while ago. It also falls back to `campaign.advertiser_name` for a blank headline, where `CreativePreview` falls back to `campaign.advertiser` — different field names for the same concept, because the two components' data sources normalize things differently (`CreativePreview` mostly sees objects `App.jsx` has aliased for the React app; `CreativeSlide` gets whatever `supabase/functions/display-feed` returns directly over HTTP).

Net effect: an advertiser can upload a creative, see "just my creative + QR" in the wizard preview, approve it — and have their actual screen playback show their creative with their business name and a CTA button composited on top anyway. The preview doesn't describe what airs.

## Goal

Make the "should text overlay show, and what does it say" decision come from one shared, tested, pure function that both `CreativePreview` and `DisplayPlayer` call — so this class of drift can't recur silently. Not attempting full visual parity of all 3 templates' distinct layouts on real screens in this pass (see Non-goals).

## Non-goals

- **Making `DisplayPlayer` render `full_bleed`/`split_panel`'s distinct layouts.** `CreativeSlide` keeps its one existing full-screen layout. This fix closes the "text shows when it shouldn't, or vice versa" mismatch — the actual trust-breaking bug — not full template-fidelity on hardware. The creative step's whole template concept is likely to be reworked in a follow-up project; investing in 3-layout parity for `DisplayPlayer` now risks being thrown away.
- **Unifying the two components into one.** `CreativePreview` is a small fixed-size preview card; `CreativeSlide` is full-screen and responsive (`clamp()`, viewport units) for real hardware. Sharing decision logic, not styling.
- **Changing what `display-feed` returns.** This fix works with whatever shape that function already produces; the shared function normalizes field-name variance rather than requiring the API to change.

## Design

New pure function, `src/lib/getCreativeRenderPlan.js`:

```js
export function getCreativeRenderPlan(campaign) {
  campaign = campaign || {};
  const mediaUrl = campaign.media_url || null;
  return {
    mediaUrl,
    isVideo: campaign.media_type === 'video',
    showTextOverlay: !mediaUrl,
    template: campaign.creative_template || 'bottom_bar',
    headline: campaign.headline || campaign.advertiser || campaign.advertiser_name || '',
    cta: campaign.cta || campaign.cta_text || '',
    bg: campaign.accent_color || campaign.color || '#7c3aed',
    secondaryBg: campaign.secondary_color || null,
    category: campaign.category || null,
    destination: campaign.destination_url || campaign.destination || 'https://adgrid.io',
  };
}
```

Pure, no DOM/network — same shape as `creativeFit.js`/`creativeReadability.js`/`creativeMessageSplit.js`, including a guard against a nullish `campaign` argument (this codebase already hit the "default parameter doesn't catch explicit `null`" footgun once, in `creativeReadability.js`; guarded against it here from the start instead of inline-`||`-ing a normalized local everywhere).

The dual fallback chain for `advertiser`/`advertiser_name` covers two different data shapes this is called with — the App.jsx-aliased shape `CreativePreview` usually sees, and whatever `display-feed` returns to `DisplayPlayer` directly — without either caller needing to know which shape it has. **`cta`/`cta_text` is not the same kind of alias, and the order matters**: `display-feed` writes the per-screen-override-aware value to `cta` while leaving the raw booking-level default under its own `cta_text` key (see `supabase/functions/display-feed/index.ts`'s `cta: cs?.cta_text || b.cta_text` merge) — so `campaign.cta` must be checked first, or a live per-screen CTA override silently stops reaching the physical screen. (This was caught in review after an earlier draft of this function had the order reversed — worth flagging here so a future edit doesn't reverse it back.)

**`CreativePreview.jsx`:** replaces its own inline field derivation (`bg`, `headline`, `cta`, `destination`, `mediaUrl`, `isVideo`, `template`) with a single `getCreativeRenderPlan(campaign)` call, then uses the returned plan's fields in place of its current locals. `Body` rendering already gates on `!mediaUrl`; changes to read `plan.showTextOverlay` instead (same boolean, now sourced from the shared function rather than computed locally).

**`DisplayPlayer.jsx`'s `CreativeSlide`:** same `getCreativeRenderPlan(campaign)` call. `qrUrl` stays `DisplayPlayer`-specific (it wraps `plan.destination` with tracking params via the existing `buildQrUrl`), everything else (`bg`, `mediaUrl`, `isVideo`) comes from the plan. Headline `<div>`, CTA `<div>`, and category `<div>` all become conditional on `plan.showTextOverlay` (currently: headline always renders, CTA/category already conditional on truthiness but not on media-presence). `campaign.cta` legacy reference is replaced by `plan.cta` as a side effect of the switch — fixes that field-name bug too.

## Testing

- `src/lib/getCreativeRenderPlan.test.js` (new): covers both fallback chains for headline (`advertiser` vs `advertiser_name`) and cta (`cta_text` vs `cta`), `showTextOverlay` true/false against `media_url` presence, `template` defaulting to `bottom_bar`, `bg`/`destination` fallback chains.
- `CreativePreview.test.jsx`: existing tests should pass unchanged (same observable behavior, different internal source).
- No existing test file for `DisplayPlayer.jsx` (none exists today) — consistent with this codebase's convention of not testing view-level files, verified manually instead.

## Open questions

None — scope was narrowed through direct conversation (fix the decision-logic gap only, not full template parity on hardware, not a full component merge).
