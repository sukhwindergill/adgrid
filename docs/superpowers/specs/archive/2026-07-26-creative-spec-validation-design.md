# Creative Spec Validation — Design

**Date:** 2026-07-26
**Status:** Approved for planning
**Part of:** Phase 4 (Creative Pipeline) — first of four independent sub-projects (specs+validation, readability score, creative studio/templates, variant testing). Each ships and is specced separately.

## Problem

An advertiser uploads their ad creative in the campaign wizard with no idea whether it fits the screens they've selected. A landscape TV and a portrait bus-shelter screen need different image shapes; the wizard has no concept of a screen's physical spec at all. Today's flow: advertiser uploads, picks screens, pays, and the operator discovers the mismatch during manual review — sometimes rejecting a paid campaign after the fact, forcing a redo.

`screens.display_size` exists today but is free text (e.g. "55-inch landscape"), never parsed, never checked against anything.

## Goal

Teach the app each screen's spec (resolution, accepted formats, max file size), check an uploaded creative against every selected screen's spec, and show the advertiser — visually, not as a text list — which screens their creative doesn't fit, before they finish the wizard. Advisory, never a hard block. Give the operator the same information during review.

## Non-goals (explicitly out of scope for this pass)

- **Auto-cropping/auto-generating a missing orientation.** Advertiser manually uploads a second file for mismatched screens, via the existing per-screen override mechanism.
- **Backfilling specs for the 12 existing production screens.** They start with every field null ("spec unknown") and are never blocked by validation until an operator fills them in — same pattern used for missing screen coordinates in Phase 3C.
- **Readability/legibility scoring.** Separate sub-project; this pass is fit only (shape, format, size).
- **Hard-blocking campaign submission on a spec mismatch.** Advisory only, in both the advertiser wizard and the operator queue.

## Design

### 1. Schema — `screens` table

```sql
ALTER TABLE screens ADD COLUMN resolution_w integer;       -- pixels, e.g. 1080
ALTER TABLE screens ADD COLUMN resolution_h integer;       -- pixels, e.g. 1920
ALTER TABLE screens ADD COLUMN accepted_formats text[];    -- e.g. {jpg,png,mp4}
ALTER TABLE screens ADD COLUMN max_file_mb integer;
```

All four nullable, no default. Orientation is derived (`resolution_h > resolution_w` → portrait), not stored separately. Video max duration reuses the existing `max_ad_duration` column rather than adding a duplicate.

Collected as an **optional** section in `ScreenOnboard` (unlike coordinates, does not block onboarding completion) and editable via `EditScreenModal` (`src/components/screens/EditScreenModal.jsx`), following its existing field pattern (local `form` state, `Inp`/`SelInput`, save via `supabase.from('screens').update(...)`).

### 2. Fit checker — pure module

`src/lib/creativeFit.js`. Given a creative descriptor and a screen's spec, returns one of `fits | mismatch | unknown`, plus the specific reason(s) for a mismatch (`orientation`, `format`, `file_size`).

```js
checkCreativeFit(
  { widthPx, heightPx, fileType, fileSizeMb },
  { resolution_w, resolution_h, accepted_formats, max_file_mb }
) → { status: 'fits' | 'mismatch' | 'unknown', reasons: string[] }
```

`unknown` whenever the screen has no spec at all (any of the four fields null) — this is the common case today and must never render as a failure. Pure, synchronous, fully unit-testable without a DOM or network — same shape as `deliveryExpectation.js` and `benchmark.js` from earlier phases.

### 3. Wizard — visual fit panel

In `CreateCampaign.jsx` Step 3 (Creative), after a creative is uploaded, run `checkCreativeFit` against every selected screen's spec. For screens where the result is `mismatch`, render a small preview block per screen showing the actual uploaded creative inside that screen's aspect ratio — a tall frame for a portrait mismatch, wide for landscape — so a cut-off headline or letterboxed video is visible directly, not described in text. Screens that `fit` or are `unknown` are not shown in this panel at all; it only surfaces what needs attention.

This reuses `CreativePreview` (`src/components/shared/CreativePreview.jsx`), which currently hardcodes `aspectRatio: '16/9'`. It needs a new `aspectRatio` prop (default `'16/9'` to preserve every other call site) so it can render at a mismatched screen's actual shape.

Purely advisory — the Next button's existing `disabled` logic is untouched.

### 4. Fixing a mismatch — per-screen media override

`campaign_screens.media_url` / `media_type` already exist (added by `20260703000002_campaign_screen_media_overrides.sql`) but have never had UI. The per-screen override panel in `CreateCampaign.jsx` (`form.show_overrides`, currently headline/CTA text only) gains a media upload field, using the same upload path already wired for the main creative. An advertiser whose creative doesn't fit a screen uploads a replacement for just that screen from the same panel where they already override headline/CTA.

### 5. Operator side

`ApprovalQueue.jsx` runs the same `checkCreativeFit` for the screen being reviewed and shows the result (mismatch reasons, or "spec unknown") next to the existing approve/reject controls. Gives the operator a concrete, specific reason to reject rather than a subjective call — no new data model, this is the same pure function rendered in a second place.

## Testing approach

- `creativeFit.js`: pure unit tests — every combination of unknown spec, fitting, and each mismatch reason (orientation, format, size), plus boundary cases (exact resolution match, file exactly at the size limit).
- `CreativePreview` `aspectRatio` prop: a rendering test confirming the default preserves existing 16:9 behavior and a passed prop overrides it.
- Manual verification in the wizard and approval queue against a screen with a deliberately mismatched spec, and against a screen with no spec (must show nothing).

## Open questions

None — all resolved during brainstorming (see decisions above: unknown-spec handling, advisory-only enforcement, auto-crop excluded, visual over textual fit display, operator-side included).
