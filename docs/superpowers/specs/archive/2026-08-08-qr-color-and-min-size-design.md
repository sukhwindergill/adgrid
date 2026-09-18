# QR Min-Size Fix + Color Customization — Design Spec
**Date:** 2026-08-08
**Priority:** P2 — advertiser confidence at campaign creation / operator review

---

## Problem

Two related QR issues in the ad creative preview:

1. **Tiny/invisible QR in small preview cards.** `QrOverlay` (in [CreativePreview.jsx](../../../src/components/shared/CreativePreview.jsx)) sizes the QR box as `${qrSizePct * 100}%` of its container's width, with `qrSizePct` defaulting to 0.12. That's fine in the ~600px wizard preview (~72px box) but [CreativeFitPanel.jsx](../../../src/components/shared/CreativeFitPanel.jsx), [ReadabilityPanel.jsx](../../../src/components/shared/ReadabilityPanel.jsx), and [CampaignDetail.jsx](../../../src/views/operator/CampaignDetail.jsx) render the same component in 180–240px cards, shrinking the box to ~18–29px — effectively invisible.
2. **No way to color the QR to match a creative.** The QR always renders black-on-white via `react-qr-code`'s defaults. Advertisers who design creatives around a brand color have no way to make the QR visually belong to the ad.

---

## Solution

### 1. Minimum QR size (CSS-only)

In `QrOverlay`'s box style, change:
```js
width: `${sizePct * 100}%`,
```
to:
```js
width: `max(${sizePct * 100}%, 44px)`,
```
(`aspectRatio: '1'` keeps height in lockstep.) Same change to the inline QR box in [DisplayPlayer.jsx](../../../src/views/display/DisplayPlayer.jsx) for consistency, though it's rarely triggered there (fullscreen container).

44px chosen as "visually recognizable as a QR in an operator-review thumbnail," not "guaranteed scannable" — these small-card renders are never the surface an end-user actually scans (that's the live screen in `DisplayPlayer`, which stays proportional and large). No data model change.

### 2. QR color — data model

Mirror the existing `qr_x`/`qr_y`/`qr_size_pct` pattern (added in [20260804000001_creative_qr_position_columns.sql](../../../supabase/migrations/20260804000001_creative_qr_position_columns.sql)) exactly:

```sql
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS qr_fg_color text,
  ADD COLUMN IF NOT EXISTS qr_bg_color text;
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_qr_fg_color_format;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_qr_fg_color_format CHECK (qr_fg_color IS NULL OR qr_fg_color ~* '^#[0-9a-f]{6}$');
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_qr_bg_color_format;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_qr_bg_color_format CHECK (qr_bg_color IS NULL OR qr_bg_color ~* '^#[0-9a-f]{6}$');

-- same two columns + two constraints on public.campaign_creatives
```

Nullable, so every existing row renders identically to today (null → fallback below).

### 3. Threading through the existing pipeline

Same chain the position fields already use — add `qr_fg_color`/`qr_bg_color` alongside `qr_x`/`qr_y`/`qr_size_pct` at each hop:

- `creativeAssignment.js` — default creative shape (`qr_fg_color: null, qr_bg_color: null`)
- `buildPreviewCampaign.js` — `qr_fg_color: form.qr_fg_color ?? null`, same for bg
- `getCreativeRenderPlan.js` — new plan fields:
  ```js
  qrFgColor: campaign.qr_fg_color || bg,       // bg = accent_color fallback chain, already computed
  qrBgColor: campaign.qr_bg_color || '#ffffff',
  ```
  Defaulting the dots to the creative's existing accent color means every campaign already gets a loosely-matching QR with zero user action; the color controls (below) are for exact matching.
- `supabase/functions/display-feed/index.ts` — add `qr_fg_color, qr_bg_color` to both `.select(...)` calls and both creative-merge objects (`cr.qr_fg_color ?? b.qr_fg_color`, same pattern as the existing `qr_x` merge).
- `DisplayPlayer.jsx` / `CreativePreview.jsx` — pass `plan.qrFgColor`/`plan.qrBgColor` into `<QRCode fgColor bgColor>` (both already supported by `react-qr-code`) and into the surrounding box's `background` (replacing the hardcoded `#fff`).

### 4. Color controls — `CreativeCard.jsx`

New "QR Code Colours" section, shown only when `hasDestination` (same gate the position/drag controls already use — no QR renders otherwise). Two rows, **Dots** and **Background**, each built from a new shared `ColorField` component:

```
[swatch] [#HEXHEX    ] [eyedropper icon]
```

- Swatch: native `<input type="color">`, same as today's Accent Colour field.
- Hex text: editable, validated against `^#[0-9a-f]{6}$` (case-insensitive), rejected edits are ignored (revert to last valid value) rather than committing a bad partial string.
- Eyedropper icon button: see §5.

Accent Colour's existing ad-hoc swatch+hex markup moves onto `ColorField` too (same file, one extra usage, avoids a third near-identical block).

### 5. Eyedropper — two mechanisms, same button

Clicking the eyedropper icon:

- **If `window.EyeDropper` exists** (Chrome/Edge): `new EyeDropper().open()` — native OS-level color picker, can sample any pixel on screen including outside the browser. Result applied directly to that field.
- **Always available fallback / alternate mode:** "Pick from creative" — cursor becomes a crosshair over the `CreativePreview`'s media element; next click reads that pixel via a hidden `<canvas>` (`drawImage` + `getImageData`) and applies it. `CreativePreview` gains a forwarded `mediaRef` prop so `CreativeCard` can reach the actual `<img>`/`<video>` DOM node to sample from.
  - Browsers without `EyeDropper` show only this mode (button behavior swaps, not hidden).
  - Browsers with `EyeDropper` get a small secondary "or pick from your creative" link/button next to the primary eyedropper icon.
  - Canvas sampling is wrapped in try/catch — a CORS-tainted canvas (media served without permissive CORS headers) fails `getImageData`; caught and surfaced as a small inline message ("Couldn't sample this image — use the color picker instead") rather than throwing.

### 6. Contrast guard

Below the two `ColorField` rows: reuse `contrastRatio()` (already exported from [creativeReadability.js](../../../src/lib/creativeReadability.js)) on the fg/bg pair. If ratio < 3:1, show an inline warning: "Low contrast — this QR may not scan reliably (X.X:1, aim for 3:1+)." Flag-don't-block — same precedent as `CreativeFitPanel`'s mismatch warnings; a deliberately unusual color scheme isn't hard-blocked.

3:1 chosen as a practical floor (WCAG's UI-component/large-text threshold) rather than the 4.5:1 used for body text elsewhere in `creativeReadability.js` — QR modules are large, high-frequency shapes, not small text glyphs, so the stricter text threshold isn't the right proxy here.

---

## Edge cases

- Existing campaigns with `qr_fg_color`/`qr_bg_color` both null → renders exactly as today (fg = accent color, bg = white).
- Hex typed with valid format but resolves to identical fg/bg (e.g. both `#ffffff`) → contrast guard catches this (ratio = 1:1), same warning path, no special-case needed.
- `EyeDropper().open()` user-cancels (native promise rejects) → caught, no-op, field unchanged.
- "Pick from creative" clicked with no `media_url` yet uploaded → button disabled (mirrors the existing "Upload your ad creative to continue" gate already in `CreativeCard`).

---

## Testing

- `getCreativeRenderPlan.test.js` — new cases for `qrFgColor`/`qrBgColor` default chain (null → accent color / white; explicit values pass through).
- `ColorField` — hex validation (reject malformed input, accept valid, swatch/hex stay in sync).
- Contrast guard — unit test against `contrastRatio` at a few known ratios (just above/below 3:1).
- `CreativePreview.test.jsx` — QR box never renders below 44px regardless of `qrSizePct`/container width (jsdom `getComputedStyle` or a snapshot of the `max()` string, matching how the existing size tests assert style values).
