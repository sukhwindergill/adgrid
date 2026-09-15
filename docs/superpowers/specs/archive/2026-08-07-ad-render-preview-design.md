# Ad Render Preview — Design Spec
**Date:** 2026-08-07
**Priority:** P2 — advertiser confidence / conversion at campaign creation

---

## Problem

Screen registration already collects photos of the physical board (`PhotoUpload` in [ScreenOnboard.jsx](../../../src/views/operator/ScreenOnboard.jsx), duplicated in [ScreenDetail.jsx](../../../src/views/operator/ScreenDetail.jsx)) and advertisers already see the first photo as a thumbnail while picking screens ([ScreenPickerCard.jsx](../../../src/views/advertiser/createCampaign/ScreenPickerCard.jsx)). What's missing: the advertiser has no way to see *their own ad* composited onto that photo before booking — they're picking screens blind to how their creative will actually look in that physical spot (angle, size relative to the board, surrounding context).

This spec adds a perspective-corrected render preview: operator marks the 4 corners of the actual screen within an uploaded photo once; advertiser then gets a "Preview" action per screen that warps their uploaded creative (image or video) onto that photo using those corners.

**Out of scope:** downloadable/shareable export of the render (v1 is in-app only — revisit if advertisers ask); forcing aspect-ratio match between creative and marked quad (same "flag, don't block" precedent as `CreativeFitPanel`); requiring corner-marking on every photo (skippable — a photo with no marked corners just doesn't support preview).

---

## Solution

1. Operator marks 4 corners of the screen within a photo right after upload (or later, editable) — normalized coordinates stored per-photo.
2. Advertiser, once they've uploaded a creative and are looking at screens with a marked photo, clicks "Preview" on that screen's card → modal shows their creative perspective-warped onto the real photo, live (video plays).
3. All compositing is client-side (Canvas 2D for images via triangle-subdivision affine warp, CSS `matrix3d` for video) — no server render step, no new storage beyond the corner coordinates.

---

## 1. Data model

Add to `screens` table:

```sql
ALTER TABLE screens
  ADD COLUMN IF NOT EXISTS screen_photo_frames jsonb NOT NULL DEFAULT '[]';
```

Shape:

```json
[
  { "url": "https://.../screen-photos/<id>/<uuid>", "corners": [[0.18,0.22],[0.81,0.19],[0.83,0.76],[0.17,0.79]] }
]
```

- `corners` is `[TL, TR, BR, BL]`, each `[x, y]` normalized 0–1 against the photo's natural width/height (resize-proof).
- Keyed by `url` against the existing `screen_photos text[]` column rather than changing that column's type — avoids touching every existing reader of `screen_photos` (including the `advertiser_screens` view and `ScreenPickerCard`'s `screen.screen_photos?.[0]` thumbnail).
- A photo present in `screen_photos` with no matching entry here simply isn't preview-eligible.

Add `screen_photo_frames` to the `advertiser_screens` view (same pattern as [20260714000000_advertiser_screens_view.sql](../../../supabase/migrations/20260714000000_advertiser_screens_view.sql), which already exposes `screen_photos`), so the advertiser-facing query gets it for free.

---

## 2. Operator flow — corner marking

Extract the current duplicated photo-management code (identical in `ScreenOnboard.jsx`'s `PhotoUpload` and `ScreenDetail.jsx`) into one shared `components/ScreenPhotoManager.jsx` — this work touches both call sites anyway, so de-duplicate rather than tripling the copy with corner-marking logic added.

New `components/CornerMarker.jsx`:

- Opens automatically right after a photo finishes uploading (inline panel or modal — implementation detail for the plan).
- Renders the photo full-size with 4 draggable handles, seeded at a 20%–80% inset rectangle so the operator nudges rather than places from scratch.
- Signed-area validation on drag-release — rejects a crossed/degenerate quad with an inline message rather than saving a matrix that inverts.
- "Skip — no clear screen edge" bypasses it; no `screen_photo_frames` entry written.
- "Save corners" writes/updates the entry for that photo's `url`.
- Existing thumbnails in the photo grid get a small pencil affordance to (re)open `CornerMarker` for an already-uploaded photo — not one-shot-only.
- `removePhoto` (in the new shared `ScreenPhotoManager`) also prunes any `screen_photo_frames` entry for the deleted URL.

---

## 3. Rendering — `lib/quadWarp.js`

- `computeHomography(srcCorners, dstCorners)` — 4-point DLT, solves the 8x8 linear system for the 3x3 projective matrix. Pure math, no new dependency.
- **Images:** canvas-based. Subdivide the destination quad into 2 triangles; per triangle, set `ctx.setTransform(...)` to the affine map for that triangle and `drawImage`. Standard workaround for Canvas 2D having no native quad/perspective primitive — imperceptible seam for a flat ad graphic at these sizes.
- **Video:** `matrixFromHomography(h)` converts the same 3x3 matrix to a CSS `matrix3d(...)`. Applied via `transform` on the actual `<video>` element, absolutely positioned over the photo `<img>`. Video keeps native playback/loop — no per-frame canvas cost, no extra CPU.
- Corners are read from `screen_photo_frames` (normalized) and scaled to the photo's *rendered* pixel box at composite time (`getBoundingClientRect`-driven, recompute on resize).

New component `components/shared/AdRenderPreview.jsx({ photoUrl, corners, creative })`: presentational, layers photo + warped creative. Consumed by both the picker modal (§4) and directly testable in isolation.

---

## 4. Advertiser flow

`ScreenPickerCard.jsx`:

- Screen has ≥1 photo with a `screen_photo_frames` entry **and** the in-progress campaign has a creative with `media_url` set → show a small "👁 Preview" button on the card, overlaid bottom-right on the thumbnail.
- No marked photo → no button (unchanged behavior).
- Marked photo exists but no creative uploaded yet → button shown disabled, tooltip "Upload your creative to preview" (in `StepCreative.jsx` the screen grid renders above the creative upload, so this state is reachable).
- Click → modal with `AdRenderPreview` at full size. If the screen has >1 marked photo, a small thumbnail strip lets the advertiser switch which one is shown. Uses the creative assigned to that screen (`assigned_screen_ids`) in multi-creative campaigns, falling back to the single default creative otherwise.

---

## 5. Edge cases

- Degenerate quad on save → blocked client-side (see §2 validation), never reaches the DB.
- Creative aspect ratio doesn't match the marked quad → warp stretches to fit, no hard block (matches existing `CreativeFitPanel` mismatch-warning precedent, not a new blocking rule).
- Photo deleted after corners marked → entry pruned in the same delete handler (§2).
- Screen has photos but operator skipped marking all of them → advertiser sees the plain thumbnail as today, no Preview button, no error state.

---

## 6. Testing

- `quadWarp.test.js` — `computeHomography` against known correspondences (identity map, known skew/rotation) — pure math, exact expected outputs.
- `AdRenderPreview` — smoke-render test with a fixed photo/corners/creative fixture, following the existing pattern in [CreativeCard.test.jsx](../../../src/views/advertiser/createCampaign/CreativeCard.test.jsx).
- `CornerMarker` — validation logic (signed-area rejection) unit tested independent of drag interaction.
