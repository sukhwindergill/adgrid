# Creative Spec Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teach the app each screen's physical spec (resolution, accepted file formats, max file size), check an uploaded creative against every selected screen's spec, and show the advertiser — visually, not as text — which screens their creative doesn't fit, before they finish the campaign wizard. Advisory only, never a hard block. Give the operator the same information during review.

**Architecture:** Four nullable columns added to `screens` hold each screen's spec (null = "unknown," never a validation failure). A pure, synchronous checker (`creativeFit.js`) compares a creative's captured dimensions/format/size against a screen's spec and returns `fits | mismatch | unknown` plus specific reasons. Dimensions are captured client-side at upload time (before or independent of the network upload) and stored alongside the existing `media_url`/`media_type` columns on `bookings` and `campaign_screens`, so both the wizard and the operator's approval queue can run the same pure check without re-fetching or re-decoding the file. A new `CreativeFitPanel` component renders the uploaded creative live inside a mismatched screen's actual aspect ratio, reusing the existing `CreativePreview` component with a new `aspectRatio` prop.

**Tech Stack:** React 19 (JS), Supabase Postgres, vitest. No new edge function — this is pure schema + frontend.

**Depends on:** Nothing from earlier phases. Independent of Phase 1–3 work.

---

## Context an engineer needs before starting

**Verified against the current codebase on 2026-07-26.**

- **IDs are `text`:** `bookings.id`, `screens.id`, `campaign_screens.campaign_id`/`screen_id`. Migrations must type new foreign-key-adjacent columns accordingly, though this plan adds no new foreign keys — only plain columns on existing tables.
- **`screens.display_size`** is free text today (e.g. "55-inch landscape"), never parsed. This plan does not touch it — the new structured fields (`resolution_w`, `resolution_h`, `accepted_formats`, `max_file_mb`) are additive and independent.
- **All 12 production screens have every new field null.** The checker must treat "any of the four fields null" as `unknown`, never as a mismatch. This mirrors how missing screen coordinates were handled in Phase 3C — see `src/views/operator/Screens.jsx` for the precedent banner pattern (not reused verbatim here, since spec completeness is optional, not required).
- **`CreativePreview`** (`src/components/shared/CreativePreview.jsx`) hardcodes `aspectRatio: '16/9'` on its outer div (around line 21). It takes a single `campaign` prop with normalized field names (`media_url`, `media_type`, `accent_color`/`color`, `headline`, `cta_text`/`cta`, `destination_url`/`destination`). This plan adds an `aspectRatio` prop, defaulting to `'16/9'` so every existing call site (`ApprovalQueue.jsx`, `CreateCampaign.jsx` StepCreative preview) is unaffected.
- **`campaign_screens.media_url`/`media_type`** already exist (migration `20260703000002_campaign_screen_media_overrides.sql`) but have no UI. The per-screen override panel in `CreateCampaign.jsx` (`form.show_overrides`, around line 591–610) currently edits only `headline`/`cta_text` via `setOverride(screenId, key, value)`. This plan adds a media upload control to that same panel.
- **No column anywhere stores a creative's pixel dimensions.** This plan adds `media_width`/`media_height` (integer, nullable) to both `bookings` (main creative) and `campaign_screens` (per-screen override creative), captured client-side at upload time. Without this, the operator's `ApprovalQueue` would have to re-fetch and decode the media file just to check orientation — storing the dimensions once, at upload, avoids that.
- **`StepCreative` in `CreateCampaign.jsx`** (function starts ~line 521) is currently called as `<StepCreative form={form} setForm={setForm} />` (line 1184, inside the step-render block). It needs the selected screens' full objects (with spec fields) to run the checker — the parent component already computes `selectedScreens` at line 946 (`matchedScreens.filter(s => form.selected_screen_ids.includes(s.id))`) and passes it to `StepBudget` as `matchedScreens={selectedScreens}` (line 1185). This plan passes the same array to `StepCreative` under the same prop name for consistency.
- **The main creative upload handler** lives in an inner component inside `StepCreative` (function starting ~line 460, containing `handleFile`). It uploads to Supabase Storage bucket `creatives`, sets `form.media_url`/`form.media_type` on success. Client-side type/size validation already exists (`ALLOWED` MIME list, 15 MB image / 100 MB video ceiling) — this plan does not change those limits, only adds dimension capture and per-screen spec checking on top.
- **The `bookings` insert** (around line 994–1024) and **`campaign_screens` insert** (around line 1026–1040, via `screenRows`) are where captured dimensions must be persisted. The override row builder already reads `ov.headline`, `ov.cta_text`, `ov.accent_color`, `ov.destination_url` from `form.per_screen_overrides[screen_id]` — this plan adds `ov.media_url`, `ov.media_type`, `ov.media_width`, `ov.media_height` to that same object shape.
- **`ApprovalQueue.jsx`'s `MultiScreenCampaignCard`** (function ~line 60) already receives `myScreens` (the operator's own screen objects — will carry spec fields once added) and `allScreens`, and iterates `myRows` (pending `campaign_screens` rows for screens the operator owns) around line 187–200, rendering a health badge next to each screen name. This plan adds a fit badge in the same spot, computed from the campaign's creative (row-level override if present, else the campaign-level `bookings` creative) against that row's screen spec.
- **Array-field UI precedent:** no existing screen-editing UI edits a `text[]` column with a chip/pill control. `PillGroup` (`CreateCampaign.jsx` line 64) is a local, unexported multi-select pill component — the established convention in this codebase is small, file-local UI helpers rather than shared primitives for a single use case. This plan follows that convention: a small local chip toggle for `accepted_formats`, defined once in `ScreenOnboard.jsx` and once in `EditScreenModal.jsx` (not extracted to a shared primitive — two ~15-line copies is proportionate; extract later only if a third caller appears).
- **Migration workflow:** apply via the Supabase MCP `apply_migration` tool (project `hkqiuwnppxkkztacwicj`), **not** `supabase db push` — remote migration history does not match local filenames (pre-existing drift, documented in every prior phase plan). Still write the `.sql` file to `supabase/migrations/` for repo history; latest existing migration is `20260726000040_bookings_destination_url_constraints.sql`, so this plan's migrations start at `20260727000000`.
- **Test/lint gates:** `pnpm test` and `pnpm build` are the real gates. `pnpm lint` reports ~1000 pre-existing problems (it walks `.claude/worktrees/**` and `mobile/**`) and is not usable as-is — lint only the files you touched, and compare against a `git stash` baseline before treating any reported error as a regression you introduced.
- **Existing DI pattern for browser-API code:** `src/lib/playBuffer.js` (Phase 1) injects browser constructors (`newId`, `storage`) as optional parameters with real defaults, making otherwise-impure code unit-testable with fakes. This plan's `mediaDimensions.js` follows the same pattern for `Image`/`video` element creation.

---

## File Structure

**Created:**
| Path | Responsibility |
|---|---|
| `src/lib/creativeFit.js` | Pure: check a creative against a screen's spec |
| `src/lib/creativeFit.test.js` | Tests for the above |
| `src/lib/mediaDimensions.js` | Read a File's pixel dimensions (DI'd browser APIs) |
| `src/lib/mediaDimensions.test.js` | Tests for the above |
| `src/components/shared/CreativeFitPanel.jsx` | Visual mismatch panel (screen-shaped previews) |
| `src/components/shared/CreativeFitPanel.test.jsx` | Tests for the above |
| `supabase/migrations/20260727000000_screen_creative_specs.sql` | `screens` spec columns |
| `supabase/migrations/20260727000001_creative_media_dimensions.sql` | `bookings`/`campaign_screens` dimension columns |

**Modified:**
| Path | Change |
|---|---|
| `src/components/shared/CreativePreview.jsx` | Add `aspectRatio` prop, default `'16/9'` |
| `src/views/operator/ScreenOnboard.jsx` | Optional spec fields section + insert payload |
| `src/components/screens/EditScreenModal.jsx` | Same spec fields, editable for existing screens |
| `src/views/advertiser/CreateCampaign.jsx` | Capture dimensions on upload; pass screens to `StepCreative`; render `CreativeFitPanel`; media override field; persist dimensions on submit |
| `src/views/operator/ApprovalQueue.jsx` | Fit badge per screen row |

---

## Task 1: Creative fit checker (pure)

**Files:**
- Create: `src/lib/creativeFit.js`, `src/lib/creativeFit.test.js`

- [ ] **Step 1: Write the failing test at `src/lib/creativeFit.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { checkCreativeFit, aspectOrientation, extensionFromMime } from './creativeFit.js';

describe('aspectOrientation', () => {
  it('reports landscape when wider than tall', () => {
    expect(aspectOrientation(1920, 1080)).toBe('landscape');
  });

  it('reports portrait when taller than wide', () => {
    expect(aspectOrientation(1080, 1920)).toBe('portrait');
  });

  it('reports square when equal', () => {
    expect(aspectOrientation(1080, 1080)).toBe('square');
  });
});

describe('extensionFromMime', () => {
  it('maps common image and video mime types to short extensions', () => {
    expect(extensionFromMime('image/jpeg')).toBe('jpg');
    expect(extensionFromMime('image/png')).toBe('png');
    expect(extensionFromMime('image/gif')).toBe('gif');
    expect(extensionFromMime('image/webp')).toBe('webp');
    expect(extensionFromMime('video/mp4')).toBe('mp4');
    expect(extensionFromMime('video/webm')).toBe('webm');
    expect(extensionFromMime('video/quicktime')).toBe('mov');
  });

  it('returns null for an unrecognised mime type', () => {
    expect(extensionFromMime('application/octet-stream')).toBeNull();
    expect(extensionFromMime('')).toBeNull();
    expect(extensionFromMime(null)).toBeNull();
  });
});

const spec = { resolution_w: 1080, resolution_h: 1920, accepted_formats: ['jpg', 'png', 'mp4'], max_file_mb: 20 };

describe('checkCreativeFit', () => {
  it('fits when orientation, format and size all match', () => {
    const creative = { widthPx: 1080, heightPx: 1920, fileType: 'image/png', fileSizeMb: 5 };
    expect(checkCreativeFit(creative, spec)).toEqual({ status: 'fits', reasons: [] });
  });

  it('is unknown when any spec field is null, regardless of the creative', () => {
    const creative = { widthPx: 1080, heightPx: 1920, fileType: 'image/png', fileSizeMb: 5 };
    for (const missing of ['resolution_w', 'resolution_h', 'accepted_formats', 'max_file_mb']) {
      const partial = { ...spec, [missing]: null };
      expect(checkCreativeFit(creative, partial)).toEqual({ status: 'unknown', reasons: [] });
    }
  });

  it('is unknown for a null or undefined spec object', () => {
    const creative = { widthPx: 1080, heightPx: 1920, fileType: 'image/png', fileSizeMb: 5 };
    expect(checkCreativeFit(creative, null).status).toBe('unknown');
    expect(checkCreativeFit(creative, undefined).status).toBe('unknown');
  });

  it('flags an orientation mismatch', () => {
    const landscapeCreative = { widthPx: 1920, heightPx: 1080, fileType: 'image/png', fileSizeMb: 5 };
    const r = checkCreativeFit(landscapeCreative, spec); // spec wants portrait
    expect(r.status).toBe('mismatch');
    expect(r.reasons).toContain('orientation');
  });

  it('does not flag orientation when the creative is square', () => {
    // A square creative can be reasonably cropped into either orientation.
    const squareCreative = { widthPx: 1080, heightPx: 1080, fileType: 'image/png', fileSizeMb: 5 };
    const r = checkCreativeFit(squareCreative, spec);
    expect(r.reasons).not.toContain('orientation');
  });

  it('does not flag orientation when the screen spec is square', () => {
    const landscapeCreative = { widthPx: 1920, heightPx: 1080, fileType: 'image/png', fileSizeMb: 5 };
    const squareSpec = { ...spec, resolution_w: 1080, resolution_h: 1080 };
    const r = checkCreativeFit(landscapeCreative, squareSpec);
    expect(r.reasons).not.toContain('orientation');
  });

  it('flags a format not in the accepted list', () => {
    const creative = { widthPx: 1080, heightPx: 1920, fileType: 'video/webm', fileSizeMb: 5 };
    const r = checkCreativeFit(creative, spec); // spec accepts jpg,png,mp4 — not webm
    expect(r.status).toBe('mismatch');
    expect(r.reasons).toContain('format');
  });

  it('matches accepted_formats case-insensitively', () => {
    const creative = { widthPx: 1080, heightPx: 1920, fileType: 'image/png', fileSizeMb: 5 };
    const upperSpec = { ...spec, accepted_formats: ['PNG', 'JPG'] };
    expect(checkCreativeFit(creative, upperSpec).reasons).not.toContain('format');
  });

  it('flags a file over the size limit', () => {
    const creative = { widthPx: 1080, heightPx: 1920, fileType: 'image/png', fileSizeMb: 25 };
    const r = checkCreativeFit(creative, spec);
    expect(r.status).toBe('mismatch');
    expect(r.reasons).toContain('file_size');
  });

  it('does not flag a file exactly at the size limit', () => {
    const creative = { widthPx: 1080, heightPx: 1920, fileType: 'image/png', fileSizeMb: 20 };
    expect(checkCreativeFit(creative, spec).reasons).not.toContain('file_size');
  });

  it('does not flag a resolution that differs but shares orientation', () => {
    // Fit checking is orientation-based, not exact-pixel-match — a screen
    // spec of 1080x1920 and a creative of 1440x2560 are both portrait.
    const creative = { widthPx: 1440, heightPx: 2560, fileType: 'image/png', fileSizeMb: 5 };
    expect(checkCreativeFit(creative, spec).reasons).not.toContain('orientation');
  });

  it('collects multiple reasons at once', () => {
    const creative = { widthPx: 1920, heightPx: 1080, fileType: 'video/webm', fileSizeMb: 99 };
    const r = checkCreativeFit(creative, spec);
    expect(r.status).toBe('mismatch');
    expect(r.reasons).toEqual(expect.arrayContaining(['orientation', 'format', 'file_size']));
    expect(r.reasons).toHaveLength(3);
  });

  it('is unknown when the creative itself is missing dimensions, rather than guessing', () => {
    const incomplete = { widthPx: null, heightPx: null, fileType: 'image/png', fileSizeMb: 5 };
    expect(checkCreativeFit(incomplete, spec).status).toBe('unknown');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/lib/creativeFit.test.js`
Expected: FAIL — cannot resolve `./creativeFit.js`.

- [ ] **Step 3: Write `src/lib/creativeFit.js`**

```js
// Pure creative-fit checking. No DOM, no network — takes already-known
// numbers and returns a verdict.
//
// A screen with ANY spec field missing is 'unknown', never a mismatch: all 12
// production screens have no spec today, and treating incompleteness as
// failure would flag every campaign on every screen.

const MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

export function extensionFromMime(mimeType) {
  if (typeof mimeType !== 'string' || !mimeType) return null;
  return MIME_TO_EXT[mimeType.toLowerCase()] ?? null;
}

export function aspectOrientation(widthPx, heightPx) {
  if (widthPx === heightPx) return 'square';
  return widthPx > heightPx ? 'landscape' : 'portrait';
}

function hasCompleteSpec(spec) {
  if (!spec) return false;
  return (
    spec.resolution_w !== null && spec.resolution_w !== undefined &&
    spec.resolution_h !== null && spec.resolution_h !== undefined &&
    Array.isArray(spec.accepted_formats) && spec.accepted_formats.length > 0 &&
    spec.max_file_mb !== null && spec.max_file_mb !== undefined
  );
}

function hasKnownDimensions(creative) {
  return Number.isFinite(creative?.widthPx) && Number.isFinite(creative?.heightPx);
}

export function checkCreativeFit(creative, spec) {
  if (!hasCompleteSpec(spec) || !hasKnownDimensions(creative)) {
    return { status: 'unknown', reasons: [] };
  }

  const reasons = [];

  const creativeOrientation = aspectOrientation(creative.widthPx, creative.heightPx);
  const screenOrientation = aspectOrientation(spec.resolution_w, spec.resolution_h);
  const eitherSquare = creativeOrientation === 'square' || screenOrientation === 'square';
  if (!eitherSquare && creativeOrientation !== screenOrientation) {
    reasons.push('orientation');
  }

  const ext = extensionFromMime(creative.fileType);
  const accepted = spec.accepted_formats.map(f => String(f).toLowerCase());
  if (!ext || !accepted.includes(ext)) {
    reasons.push('format');
  }

  if (Number(creative.fileSizeMb) > Number(spec.max_file_mb)) {
    reasons.push('file_size');
  }

  return { status: reasons.length > 0 ? 'mismatch' : 'fits', reasons };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/lib/creativeFit.test.js`
Expected: PASS, 16 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/creativeFit.js src/lib/creativeFit.test.js
git commit -m "feat: add pure creative-fit checker"
```

---

## Task 2: Media dimension capture (DI'd browser APIs)

**Files:**
- Create: `src/lib/mediaDimensions.js`, `src/lib/mediaDimensions.test.js`

Follows the dependency-injection pattern already used in `src/lib/playBuffer.js` (Phase 1) so browser-only APIs (`Image`, `<video>`) can be swapped for fakes in tests.

- [ ] **Step 1: Write the failing test at `src/lib/mediaDimensions.test.js`**

```js
import { describe, it, expect, vi } from 'vitest';
import { getMediaDimensions } from './mediaDimensions.js';

// Fakes that behave like Image/HTMLVideoElement just enough to drive the
// promise: setting `.src` synchronously (via a microtask) fires the success
// or error handler.
function fakeImage({ shouldError = false, naturalWidth = 800, naturalHeight = 600 } = {}) {
  const img = { naturalWidth, naturalHeight, onload: null, onerror: null };
  Object.defineProperty(img, 'src', {
    set() {
      queueMicrotask(() => {
        if (shouldError) img.onerror?.();
        else img.onload?.();
      });
    },
  });
  return img;
}

function fakeVideo({ shouldError = false, videoWidth = 1080, videoHeight = 1920 } = {}) {
  const video = { videoWidth, videoHeight, onloadedmetadata: null, onerror: null, preload: '' };
  Object.defineProperty(video, 'src', {
    set() {
      queueMicrotask(() => {
        if (shouldError) video.onerror?.();
        else video.onloadedmetadata?.();
      });
    },
  });
  return video;
}

const pngFile = { type: 'image/png', name: 'a.png' };
const mp4File = { type: 'video/mp4', name: 'a.mp4' };

describe('getMediaDimensions', () => {
  it('resolves width/height for an image via the injected Image constructor', async () => {
    const createImage = vi.fn(() => fakeImage({ naturalWidth: 1080, naturalHeight: 1920 }));
    const result = await getMediaDimensions(pngFile, { createImage, createVideo: fakeVideo });
    expect(result).toEqual({ width: 1080, height: 1920 });
    expect(createImage).toHaveBeenCalledTimes(1);
  });

  it('resolves width/height for a video via the injected video element factory', async () => {
    const createVideo = vi.fn(() => fakeVideo({ videoWidth: 1920, videoHeight: 1080 }));
    const result = await getMediaDimensions(mp4File, { createImage: fakeImage, createVideo });
    expect(result).toEqual({ width: 1920, height: 1080 });
    expect(createVideo).toHaveBeenCalledTimes(1);
  });

  it('rejects when the image fails to load', async () => {
    await expect(
      getMediaDimensions(pngFile, { createImage: () => fakeImage({ shouldError: true }), createVideo: fakeVideo })
    ).rejects.toThrow();
  });

  it('rejects when the video fails to load', async () => {
    await expect(
      getMediaDimensions(mp4File, { createImage: fakeImage, createVideo: () => fakeVideo({ shouldError: true }) })
    ).rejects.toThrow();
  });

  it('rejects for a file with neither an image nor a video mime type', async () => {
    await expect(
      getMediaDimensions({ type: 'application/pdf', name: 'a.pdf' }, { createImage: fakeImage, createVideo: fakeVideo })
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/lib/mediaDimensions.test.js`
Expected: FAIL — cannot resolve `./mediaDimensions.js`.

- [ ] **Step 3: Write `src/lib/mediaDimensions.js`**

```js
// Reads a File's pixel dimensions client-side, before or independent of any
// network upload. Image/video element creation is injected (matching the
// pattern in src/lib/playBuffer.js) so this is testable without a real
// browser decoding a real file.

export function getMediaDimensions(file, {
  createImage = () => new Image(),
  createVideo = () => document.createElement('video'),
} = {}) {
  return new Promise((resolve, reject) => {
    const isImage = typeof file?.type === 'string' && file.type.startsWith('image/');
    const isVideo = typeof file?.type === 'string' && file.type.startsWith('video/');
    if (!isImage && !isVideo) {
      reject(new Error(`Unsupported file type: ${file?.type ?? 'unknown'}`));
      return;
    }

    const url = URL.createObjectURL(file);
    const cleanup = () => URL.revokeObjectURL(url);

    if (isVideo) {
      const video = createVideo();
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        const dims = { width: video.videoWidth, height: video.videoHeight };
        cleanup();
        resolve(dims);
      };
      video.onerror = () => { cleanup(); reject(new Error('Could not read video dimensions')); };
      video.src = url;
    } else {
      const img = createImage();
      img.onload = () => {
        const dims = { width: img.naturalWidth, height: img.naturalHeight };
        cleanup();
        resolve(dims);
      };
      img.onerror = () => { cleanup(); reject(new Error('Could not read image dimensions')); };
      img.src = url;
    }
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/lib/mediaDimensions.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mediaDimensions.js src/lib/mediaDimensions.test.js
git commit -m "feat: add client-side media dimension reader"
```

---

## Task 3: `screens` spec columns

**Files:**
- Create: `supabase/migrations/20260727000000_screen_creative_specs.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- Per-screen creative spec, so an advertiser's upload can be checked against
-- what a screen actually expects. All nullable, no default: a screen with
-- ANY of these unset is treated as "spec unknown" everywhere this is read —
-- see src/lib/creativeFit.js — never as a validation failure. All 12
-- production screens start with every field null.
--
-- Orientation is derived from resolution_w/resolution_h, not stored
-- separately. Video max duration reuses the existing max_ad_duration column.
-- ============================================================

ALTER TABLE public.screens ADD COLUMN IF NOT EXISTS resolution_w integer;
ALTER TABLE public.screens ADD COLUMN IF NOT EXISTS resolution_h integer;
ALTER TABLE public.screens ADD COLUMN IF NOT EXISTS accepted_formats text[];
ALTER TABLE public.screens ADD COLUMN IF NOT EXISTS max_file_mb integer;
```

- [ ] **Step 2: Apply via the Supabase MCP `apply_migration` (project `hkqiuwnppxkkztacwicj`, name `screen_creative_specs`)**

Do not use `supabase db push` — remote migration history does not match local filenames (pre-existing drift).

- [ ] **Step 3: Verify the columns exist and are null on every existing screen**

```sql
select column_name, data_type from information_schema.columns
where table_name = 'screens' and column_name in ('resolution_w','resolution_h','accepted_formats','max_file_mb');

select count(*) as total, count(resolution_w) as with_spec from public.screens;
```
Expected: 4 columns present; `with_spec` is `0` (no screen has been given a spec yet).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260727000000_screen_creative_specs.sql
git commit -m "feat: add per-screen creative spec columns"
```

---

## Task 4: Creative dimension columns on `bookings` and `campaign_screens`

**Files:**
- Create: `supabase/migrations/20260727000001_creative_media_dimensions.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Pixel dimensions of the uploaded creative, captured client-side at upload
-- time (see src/lib/mediaDimensions.js) and stored alongside the existing
-- media_url/media_type columns. Without this, checking fit anywhere other
-- than the upload moment (e.g. the operator's approval queue) would require
-- re-fetching and re-decoding the file.

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS media_width  integer;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS media_height integer;

ALTER TABLE public.campaign_screens ADD COLUMN IF NOT EXISTS media_width  integer;
ALTER TABLE public.campaign_screens ADD COLUMN IF NOT EXISTS media_height integer;
```

- [ ] **Step 2: Apply via the Supabase MCP `apply_migration`, name `creative_media_dimensions`**

- [ ] **Step 3: Verify**

```sql
select table_name, column_name from information_schema.columns
where table_name in ('bookings','campaign_screens') and column_name in ('media_width','media_height')
order by table_name, column_name;
```
Expected: 4 rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260727000001_creative_media_dimensions.sql
git commit -m "feat: add creative dimension columns for fit checking"
```

---

## Task 5: `CreativePreview` accepts an aspect ratio

**Files:**
- Modify: `src/components/shared/CreativePreview.jsx`
- Create: `src/components/shared/CreativePreview.test.jsx`

- [ ] **Step 1: Write the failing test at `src/components/shared/CreativePreview.test.jsx`**

```jsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CreativePreview } from './CreativePreview.jsx';

describe('CreativePreview', () => {
  it('defaults to a 16:9 frame when no aspectRatio is given', () => {
    const { container } = render(<CreativePreview campaign={{ headline: 'Test' }} />);
    expect(container.firstChild.style.aspectRatio).toBe('16/9');
  });

  it('renders at the given aspect ratio', () => {
    const { container } = render(<CreativePreview campaign={{ headline: 'Test' }} aspectRatio="9/16" />);
    expect(container.firstChild.style.aspectRatio).toBe('9/16');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/components/shared/CreativePreview.test.jsx`
Expected: FAIL — the `aspectRatio="9/16"` case fails because the component ignores the prop (always renders `16/9`).

- [ ] **Step 3: Add the prop in `src/components/shared/CreativePreview.jsx`**

Change the function signature:

```jsx
export function CreativePreview({ campaign, aspectRatio = '16/9' }) {
```

And change the outer div's inline style (currently `aspectRatio: '16/9'`, around line 21) to:

```jsx
      position: 'relative', width: '100%', aspectRatio,
```

Leave every other line in the file unchanged.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/components/shared/CreativePreview.test.jsx`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/CreativePreview.jsx src/components/shared/CreativePreview.test.jsx
git commit -m "feat: CreativePreview accepts an aspectRatio prop"
```

---

## Task 6: `CreativeFitPanel` component

**Files:**
- Create: `src/components/shared/CreativeFitPanel.jsx`, `src/components/shared/CreativeFitPanel.test.jsx`

Renders nothing when there are no mismatches. For each mismatched screen, shows the creative live inside that screen's actual shape plus which reasons caused the mismatch.

- [ ] **Step 1: Write the failing test at `src/components/shared/CreativeFitPanel.test.jsx`**

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CreativeFitPanel } from './CreativeFitPanel.jsx';

const baseCampaign = { headline: 'Test', media_url: 'https://example.com/a.png', media_type: 'image' };

describe('CreativeFitPanel', () => {
  it('renders nothing when there are no mismatches', () => {
    const { container } = render(<CreativeFitPanel campaign={baseCampaign} mismatches={[]} />);
    expect(container.textContent).toBe('');
  });

  it('renders nothing when mismatches is not provided', () => {
    const { container } = render(<CreativeFitPanel campaign={baseCampaign} />);
    expect(container.textContent).toBe('');
  });

  it('shows the screen name and reasons for each mismatch', () => {
    render(
      <CreativeFitPanel
        campaign={baseCampaign}
        mismatches={[
          { screenId: 's1', screenName: 'Shoreditch Coffee Co', reasons: ['orientation'], resolution_w: 1080, resolution_h: 1920 },
        ]}
      />
    );
    expect(screen.getByText('Shoreditch Coffee Co')).toBeInTheDocument();
    expect(screen.getByText(/wrong orientation/i)).toBeInTheDocument();
  });

  it('lists every reason for a screen with multiple mismatches', () => {
    render(
      <CreativeFitPanel
        campaign={baseCampaign}
        mismatches={[
          { screenId: 's1', screenName: 'Brixton Market Bar', reasons: ['format', 'file_size'], resolution_w: 1920, resolution_h: 1080 },
        ]}
      />
    );
    expect(screen.getByText(/format not accepted/i)).toBeInTheDocument();
    expect(screen.getByText(/file too large/i)).toBeInTheDocument();
  });

  it('renders one panel per mismatched screen', () => {
    render(
      <CreativeFitPanel
        campaign={baseCampaign}
        mismatches={[
          { screenId: 's1', screenName: 'Screen One', reasons: ['orientation'], resolution_w: 1080, resolution_h: 1920 },
          { screenId: 's2', screenName: 'Screen Two', reasons: ['format'], resolution_w: 1920, resolution_h: 1080 },
        ]}
      />
    );
    expect(screen.getByText('Screen One')).toBeInTheDocument();
    expect(screen.getByText('Screen Two')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/components/shared/CreativeFitPanel.test.jsx`
Expected: FAIL — cannot resolve `./CreativeFitPanel.jsx`.

- [ ] **Step 3: Write `src/components/shared/CreativeFitPanel.jsx`**

```jsx
import { C, F } from '../../design/tokens.js';
import { Card } from '../primitives/Card.jsx';
import { CreativePreview } from './CreativePreview.jsx';

const REASON_LABEL = {
  orientation: 'Wrong orientation',
  format: 'Format not accepted',
  file_size: 'File too large',
};

// Shows only what needs attention: screens the creative does NOT fit.
// Screens that fit, or whose spec is unknown, are never listed here — this
// panel exists to make a problem visible, not to confirm the absence of one.
export function CreativeFitPanel({ campaign, mismatches = [] }) {
  if (!mismatches || mismatches.length === 0) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.amber, fontFamily: F.sans, marginBottom: 4 }}>
        This creative may not fit {mismatches.length} screen{mismatches.length === 1 ? '' : 's'}
      </div>
      <div style={{ fontSize: 12, color: C.textMuted, fontFamily: F.sans, marginBottom: 14 }}>
        You can still submit — but the preview below is how it will actually look on each screen.
        Upload a different file for these screens in the per-screen overrides below.
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {mismatches.map(m => (
          <Card key={m.screenId} style={{ padding: 12, width: 180 }}>
            <div style={{ width: '100%', marginBottom: 8 }}>
              <CreativePreview campaign={campaign} aspectRatio={`${m.resolution_w}/${m.resolution_h}`} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>
              {m.screenName}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {m.reasons.map(r => (
                <span key={r} style={{ fontSize: 11, color: C.amber, fontFamily: F.sans }}>
                  ⚠ {REASON_LABEL[r] ?? r}
                </span>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/components/shared/CreativeFitPanel.test.jsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/CreativeFitPanel.jsx src/components/shared/CreativeFitPanel.test.jsx
git commit -m "feat: add visual creative-fit mismatch panel"
```

---

## Task 7: Operator collects screen spec at onboarding

**Files:**
- Modify: `src/views/operator/ScreenOnboard.jsx`

Optional section — does not block onboarding completion, unlike the required coordinates field from Phase 3C.

- [ ] **Step 1: Add spec fields to the form state**

Near the existing `lat: '', lng: '',` in the initial `useState` (around line 122), add:

```js
    resolution_w: '', resolution_h: '', accepted_formats: [], max_file_mb: '',
```

- [ ] **Step 2: Add a local format-chip toggle**

Add this small component near the top of the file, alongside other local helpers (not exported — matches the `PillGroup` convention in `CreateCampaign.jsx`):

```jsx
const FORMAT_OPTIONS = ['jpg', 'png', 'gif', 'webp', 'mp4', 'webm'];

function FormatChips({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {FORMAT_OPTIONS.map(fmt => {
        const active = value.includes(fmt);
        return (
          <button key={fmt} type="button" onClick={() => {
            onChange(active ? value.filter(f => f !== fmt) : [...value, fmt]);
          }} style={{
            padding: '6px 12px', borderRadius: 16, cursor: 'pointer',
            border: `1px solid ${active ? C.purple : C.border}`,
            background: active ? C.purpleSoft : C.surface,
            color: active ? C.purple : C.textSub,
            fontSize: 12, fontFamily: F.sans,
          }}>{fmt}</button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Render the optional section**

Directly below the existing `Display Size` field (around line 274), add:

```jsx
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 4 }}>
              Creative spec <span style={{ color: C.textMuted, fontWeight: 400 }}>(optional)</span>
            </div>
            <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginBottom: 10, lineHeight: 1.5 }}>
              Lets advertisers know before they upload whether their creative fits your screen.
              Leave blank if you're not sure — it won't block anything.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <Inp label="Resolution width (px)" type="number" min="1" placeholder="e.g. 1080"
                value={form.resolution_w} onChange={e => set('resolution_w', e.target.value)} />
              <Inp label="Resolution height (px)" type="number" min="1" placeholder="e.g. 1920"
                value={form.resolution_h} onChange={e => set('resolution_h', e.target.value)} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginBottom: 6 }}>Accepted file formats</div>
              <FormatChips value={form.accepted_formats} onChange={v => set('accepted_formats', v)} />
            </div>
            <Inp label="Max file size (MB)" type="number" min="1" placeholder="e.g. 20"
              value={form.max_file_mb} onChange={e => set('max_file_mb', e.target.value)} />
          </div>
```

- [ ] **Step 4: Persist on submit**

In the `screens` insert payload (around line 167, alongside `display_size: form.display_size.trim(),`), add:

```js
      resolution_w:      form.resolution_w ? parseInt(form.resolution_w, 10) : null,
      resolution_h:      form.resolution_h ? parseInt(form.resolution_h, 10) : null,
      accepted_formats:  form.accepted_formats.length > 0 ? form.accepted_formats : null,
      max_file_mb:       form.max_file_mb ? parseInt(form.max_file_mb, 10) : null,
```

- [ ] **Step 5: Verify manually**

Start the preview server, walk through screen onboarding, fill in a resolution and two format chips, submit, and confirm via SQL that the new row has the values set:

```sql
select name, resolution_w, resolution_h, accepted_formats, max_file_mb
from screens order by created_at desc limit 1;
```

Then onboard a second screen leaving the section blank and confirm those four fields are `null`, not empty strings or `[]`.

- [ ] **Step 6: Verify and commit**

Run: `pnpm test && pnpm build`
Expected: both pass.

Run: `pnpm exec eslint src/views/operator/ScreenOnboard.jsx`
Expected: no new errors versus a `git stash` baseline.

```bash
git add src/views/operator/ScreenOnboard.jsx
git commit -m "feat: collect optional creative spec at screen onboarding"
```

---

## Task 8: Edit spec on existing screens

**Files:**
- Modify: `src/components/screens/EditScreenModal.jsx`

Same fields, same chip component (duplicated locally per the convention noted in Context — this file does not import from `ScreenOnboard.jsx`).

- [ ] **Step 1: Add a local `FormatChips` component**

Add this near the top of the file, alongside the existing local helpers (same component as introduced in `ScreenOnboard.jsx` — duplicated here rather than imported, per the file-local-helper convention noted in Context):

```jsx
const FORMAT_OPTIONS = ['jpg', 'png', 'gif', 'webp', 'mp4', 'webm'];

function FormatChips({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {FORMAT_OPTIONS.map(fmt => {
        const active = value.includes(fmt);
        return (
          <button key={fmt} type="button" onClick={() => {
            onChange(active ? value.filter(f => f !== fmt) : [...value, fmt]);
          }} style={{
            padding: '6px 12px', borderRadius: 16, cursor: 'pointer',
            border: `1px solid ${active ? C.purple : C.border}`,
            background: active ? C.purpleSoft : C.surface,
            color: active ? C.purple : C.textSub,
            fontSize: 12, fontFamily: F.sans,
          }}>{fmt}</button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Add spec fields to form state**

In the initial `useState` (around line 8–17), add:

```js
    resolution_w:      screen.resolution_w || '',
    resolution_h:      screen.resolution_h || '',
    accepted_formats:  screen.accepted_formats || [],
    max_file_mb:       screen.max_file_mb || '',
```

- [ ] **Step 3: Add fields to the update payload**

In the `supabase.from('screens').update({...})` call (around line 27–37), add:

```js
        resolution_w:      form.resolution_w ? parseInt(form.resolution_w, 10) : null,
        resolution_h:      form.resolution_h ? parseInt(form.resolution_h, 10) : null,
        accepted_formats:  form.accepted_formats.length > 0 ? form.accepted_formats : null,
        max_file_mb:       form.max_file_mb ? parseInt(form.max_file_mb, 10) : null,
```

- [ ] **Step 4: Render the fields**

This file updates form state inline (`setForm(f => ({ ...f, key: value }))`), unlike `ScreenOnboard.jsx`'s `set(key, value)` helper — the block below matches this file's actual pattern. Add it directly after the existing `Monthly Footfall` / `CPM Floor` grid (the last field block before `{err && ...}`):

```jsx
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 4 }}>
              Creative spec <span style={{ color: C.textMuted, fontWeight: 400 }}>(optional)</span>
            </div>
            <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginBottom: 10, lineHeight: 1.5 }}>
              Lets advertisers know before they upload whether their creative fits your screen.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <Inp label="Resolution width (px)" type="number" min="1" placeholder="e.g. 1080"
                value={form.resolution_w} onChange={e => setForm(f => ({ ...f, resolution_w: e.target.value }))} />
              <Inp label="Resolution height (px)" type="number" min="1" placeholder="e.g. 1920"
                value={form.resolution_h} onChange={e => setForm(f => ({ ...f, resolution_h: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginBottom: 6 }}>Accepted file formats</div>
              <FormatChips value={form.accepted_formats} onChange={v => setForm(f => ({ ...f, accepted_formats: v }))} />
            </div>
            <Inp label="Max file size (MB)" type="number" min="1" placeholder="e.g. 20"
              value={form.max_file_mb} onChange={e => setForm(f => ({ ...f, max_file_mb: e.target.value }))} />
          </div>
```

- [ ] **Step 5: Verify manually**

Open the edit modal for a screen with no spec, fill in resolution and formats, save, and confirm via SQL that the row now has those values. Re-open the modal and confirm the fields are pre-populated from the saved row.

- [ ] **Step 6: Verify and commit**

Run: `pnpm test && pnpm build`
Expected: both pass.

Run: `pnpm exec eslint src/components/screens/EditScreenModal.jsx`
Expected: no new errors versus a `git stash` baseline.

```bash
git add src/components/screens/EditScreenModal.jsx
git commit -m "feat: let operators edit creative spec on existing screens"
```

---

## Task 9: Capture dimensions on the main creative upload

**Files:**
- Modify: `src/views/advertiser/CreateCampaign.jsx`

- [ ] **Step 1: Import the new modules**

Near the other imports at the top of the file:

```js
import { getMediaDimensions } from '../../lib/mediaDimensions.js';
import { checkCreativeFit } from '../../lib/creativeFit.js';
import { CreativeFitPanel } from '../../components/shared/CreativeFitPanel.jsx';
```

- [ ] **Step 2: Add dimension fields to form state**

In the top-level `useState` (around line 894, alongside `media_url: '', media_type: '',`), add:

```js
    media_width: null,
    media_height: null,
```

- [ ] **Step 3: Capture dimensions in `handleFile`**

In the inner upload component's `handleFile` (around line 464–478), after the successful upload and before `setUploading(false)`, add a best-effort dimension read that does not block or fail the upload if it errors:

```js
    const { data } = supabase.storage.from('creatives').getPublicUrl(path);
    let width = null, height = null;
    try {
      const dims = await getMediaDimensions(file);
      width = dims.width;
      height = dims.height;
    } catch {
      // Dimensions are best-effort. A read failure must not block the upload
      // — the creative is still usable, it just won't be fit-checked until
      // dimensions are known (checkCreativeFit reports 'unknown' without them).
    }
    setForm(s => ({ ...s, media_url: data.publicUrl, media_type: isVid ? 'video' : 'image', media_width: width, media_height: height }));
    setUploading(false);
```

This replaces the existing single `setForm(...)` call at that spot — remove the old one.

Also update `clear()` (a few lines below) to reset the new fields:

```js
  const clear = () => setForm(s => ({ ...s, media_url: '', media_type: '', media_width: null, media_height: null }));
```

- [ ] **Step 4: Run the fit check and render the panel**

`StepCreative` is called at line 1184 as `<StepCreative form={form} setForm={setForm} />`. Change the call site to also pass the selected screens (the parent already computes `selectedScreens` at line 946, used by `StepBudget`):

```jsx
      {step === 2 && <StepCreative form={form} setForm={setForm} matchedScreens={selectedScreens} />}
```

In the `StepCreative` function signature (around line 521), accept the new prop:

```jsx
function StepCreative({ form, setForm, matchedScreens = [] }) {
```

After the existing `previewCampaign` object is built (around line 528–536), compute the mismatch list:

```js
  const fitMismatches = form.media_url
    ? matchedScreens
        .map(s => {
          const { status, reasons } = checkCreativeFit(
            { widthPx: form.media_width, heightPx: form.media_height, fileType: form.media_type === 'video' ? 'video/mp4' : 'image/png', fileSizeMb: 0 },
            { resolution_w: s.resolution_w, resolution_h: s.resolution_h, accepted_formats: s.accepted_formats, max_file_mb: s.max_file_mb },
          );
          return status === 'mismatch' ? { screenId: s.id, screenName: s.name, reasons, resolution_w: s.resolution_w, resolution_h: s.resolution_h } : null;
        })
        .filter(Boolean)
    : [];
```

> **Note on `fileType`/`fileSizeMb` above:** `form.media_type` only stores `'image'`/`'video'`, not the original MIME subtype or file size — neither is captured today and this task does not add them. Using a representative MIME (`image/png`/`video/mp4`) means the `format` reason can under-report (a screen requiring only `jpg` won't be flagged for a PNG upload) and `file_size` never fires here (its check lives in the existing upload-time validator, which already enforces 15 MB/100 MB ceilings — see Context). This is a deliberate, documented simplification: orientation is the fit dimension that actually varies per screen and matters most; format/size are already bounded by the existing uploader. If tightened later, capture `file.type` and `file.size` alongside dimensions in Task 9 Step 3's `handleFile` and thread them through here instead of the representative values.

Render the panel directly below the existing `<CreativePreview campaign={previewCampaign} />` call (around line 772):

```jsx
            <CreativeFitPanel campaign={previewCampaign} mismatches={fitMismatches} />
```

- [ ] **Step 5: Persist dimensions on submit**

In the `bookings` insert payload (around line 1005–1006, alongside `media_url: form.media_url || null, media_type: form.media_type || null,`), add:

```js
        media_width:            form.media_width,
        media_height:           form.media_height,
```

- [ ] **Step 6: Verify manually**

Upload a portrait image, select a mix of screens (some with a spec you set in Task 7/8, some without), and confirm the fit panel appears only for screens whose stored spec conflicts with the upload's orientation — and that screens with no spec never appear in the panel.

- [ ] **Step 7: Verify and commit**

Run: `pnpm test && pnpm build`
Expected: both pass.

Run: `pnpm exec eslint src/views/advertiser/CreateCampaign.jsx`
Expected: no new errors versus a `git stash` baseline (this file has pre-existing lint errors from earlier phases — compare counts, don't expect zero).

```bash
git add src/views/advertiser/CreateCampaign.jsx
git commit -m "feat: check uploaded creative against selected screens' specs"
```

---

## Task 10: Per-screen media override

**Files:**
- Modify: `src/views/advertiser/CreateCampaign.jsx`

Adds a media upload control to the existing per-screen override panel (`form.show_overrides`), so an advertiser whose creative doesn't fit a screen can upload a replacement for just that screen.

- [ ] **Step 1: Add an upload handler scoped to one screen**

`StepCreative` does not currently call `useAuth()` — the main creative uploader is a sibling component, `MediaUpload` (starts ~line 459), which has its own `const { user } = useAuth();` at line 460. `StepCreative` needs the same import for the override upload path's storage key.

At the top of `StepCreative` (around line 522, right after the function signature), add:

```js
  const { user } = useAuth();
```

Near the top-level `setOverride` helper inside `StepCreative` (around line 524–530), add a sibling function:

```js
  const [overrideUploading, setOverrideUploading] = useState(null); // screenId currently uploading, or null

  const handleOverrideFile = async (screenId, file) => {
    if (!file) return;
    const isVid = file.type.startsWith('video/');
    setOverrideUploading(screenId);
    const ext = (file.name.split('.').pop() || (isVid ? 'mp4' : 'jpg')).toLowerCase();
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('creatives').upload(path, file, { contentType: file.type, upsert: false });
    if (error) { setOverrideUploading(null); return; }
    const { data } = supabase.storage.from('creatives').getPublicUrl(path);
    let width = null, height = null;
    try {
      const dims = await getMediaDimensions(file);
      width = dims.width; height = dims.height;
    } catch { /* best-effort, see Task 9 Step 3 */ }
    setOverride(screenId, 'media_url', data.publicUrl);
    setOverride(screenId, 'media_type', isVid ? 'video' : 'image');
    setOverride(screenId, 'media_width', width);
    setOverride(screenId, 'media_height', height);
    setOverrideUploading(null);
  };
```

`useAuth` is already imported at the top of `CreateCampaign.jsx` (used by the main component and by `MediaUpload`), so no new import is needed — only the hook call inside `StepCreative` itself.

- [ ] **Step 2: Add the upload control to the override panel**

In the per-screen override render block (around line 591–609), inside the `.map(screenId => { ... })`, alongside the existing `Headline override`/`CTA override` inputs, add:

```jsx
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 11, color: C.textSub, fontFamily: F.sans, marginBottom: 6 }}>
                          Creative override <span style={{ color: C.textMuted }}>(leave blank to use the campaign creative)</span>
                        </div>
                        {ov.media_url ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11, color: C.text, fontFamily: F.sans }}>{ov.media_type === 'video' ? 'Video' : 'Image'} uploaded ✓</span>
                            <button type="button" onClick={() => { setOverride(screenId, 'media_url', ''); setOverride(screenId, 'media_type', ''); setOverride(screenId, 'media_width', null); setOverride(screenId, 'media_height', null); }}
                              style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, padding: '2px 8px', fontSize: 11, color: C.textSub, cursor: 'pointer', fontFamily: F.sans }}>Remove</button>
                          </div>
                        ) : (
                          <label style={{ display: 'inline-block', border: `1px dashed ${C.border}`, borderRadius: 6, padding: '6px 12px', fontSize: 11, color: C.textSub, cursor: overrideUploading === screenId ? 'default' : 'pointer', fontFamily: F.sans }}>
                            <input type="file" accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime" style={{ display: 'none' }}
                              disabled={overrideUploading === screenId}
                              onChange={e => handleOverrideFile(screenId, e.target.files?.[0])} />
                            {overrideUploading === screenId ? 'Uploading…' : '+ Upload replacement'}
                          </label>
                        )}
                      </div>
```

- [ ] **Step 3: Persist override dimensions on submit**

In the `screenRows` builder (around line 1030–1037), add to the returned object:

```js
          media_url:       ov.media_url || null,
          media_type:      ov.media_type || null,
          media_width:     ov.media_width || null,
          media_height:    ov.media_height || null,
```

- [ ] **Step 4: Verify manually**

Upload a mismatched main creative, open per-screen overrides, upload a replacement for one mismatched screen, submit the campaign, and confirm via SQL that the corresponding `campaign_screens` row has the override's `media_url`/`media_width`/`media_height` set, distinct from the campaign-level `bookings` row.

- [ ] **Step 5: Verify and commit**

Run: `pnpm test && pnpm build`
Expected: both pass.

Run: `pnpm exec eslint src/views/advertiser/CreateCampaign.jsx`
Expected: no new errors versus the Task 9 baseline.

```bash
git add src/views/advertiser/CreateCampaign.jsx
git commit -m "feat: let advertisers upload a per-screen creative override"
```

---

## Task 11: Operator sees fit info in the approval queue

**Files:**
- Modify: `src/views/operator/ApprovalQueue.jsx`

- [ ] **Step 1: Import the checker**

```js
import { checkCreativeFit } from '../../lib/creativeFit.js';
```

- [ ] **Step 2: Compute and render the fit badge per row**

Inside `MultiScreenCampaignCard`, in the `myRows.map(row => { ... })` block (around line 187–200), after `const health = screen ? healthLabel(screen) : null;`, add:

```js
                const rowMedia = {
                  widthPx: row.media_width ?? campaign.media_width,
                  heightPx: row.media_height ?? campaign.media_height,
                  fileType: (row.media_type ?? campaign.media_type) === 'video' ? 'video/mp4' : 'image/png',
                  fileSizeMb: 0, // see the note in CreateCampaign.jsx Task 9 Step 4 — size is not captured yet
                };
                const fit = screen ? checkCreativeFit(rowMedia, {
                  resolution_w: screen.resolution_w,
                  resolution_h: screen.resolution_h,
                  accepted_formats: screen.accepted_formats,
                  max_file_mb: screen.max_file_mb,
                }) : { status: 'unknown', reasons: [] };
```

A row-level override (`row.media_url`/`media_width`/etc, set when the advertiser used the per-screen override) takes precedence over the campaign-level creative — matching how the creative itself is already resolved elsewhere in this file.

Render the badge next to the existing health badge:

```jsx
                      {health && <span style={{ fontSize: 10, color: health.color, fontFamily: F.sans }}>⚠ {health.label}</span>}
                      {fit.status === 'mismatch' && (
                        <span style={{ fontSize: 10, color: C.amber, fontFamily: F.sans, marginLeft: health ? 8 : 0 }}>
                          ⚠ Creative may not fit ({fit.reasons.join(', ')})
                        </span>
                      )}
```

Nothing is rendered for `fits` or `unknown` — consistent with the panel being advisory and only surfacing actionable information.

- [ ] **Step 3: Verify manually**

Submit a campaign whose creative mismatches a screen with a spec set (from Task 7/8), open the approval queue as that screen's operator, and confirm the mismatch badge appears with the correct reasons. Confirm a screen with no spec shows no badge.

- [ ] **Step 4: Verify and commit**

Run: `pnpm test && pnpm build`
Expected: both pass.

Run: `pnpm exec eslint src/views/operator/ApprovalQueue.jsx`
Expected: no new errors versus a `git stash` baseline.

```bash
git add src/views/operator/ApprovalQueue.jsx
git commit -m "feat: show creative-fit mismatch to operators during review"
```

---

## Task 12: Verification pass

- [ ] **Step 1: Full test suite**

Run: `pnpm test`
Expected: all pass, including the 16 + 5 + 2 + 5 = 28 tests added in Tasks 1, 2, 5, 6.

- [ ] **Step 2: Build**

Run: `pnpm build`
Expected: exits 0.

- [ ] **Step 3: Unknown-spec screens never appear as mismatches**

With no screen given a spec (fresh check against production data, where all 12 screens have every field null), upload any creative in the wizard against any screen selection and confirm the fit panel never renders. This is the single most important behavior in this plan — a false mismatch on an unconfigured screen would train advertisers to ignore the warning.

- [ ] **Step 4: A configured mismatch is visible, and fixable**

With at least one screen given an orientation-conflicting spec: confirm the wizard's `CreativeFitPanel` shows it, confirm a per-screen override upload clears it from that screen specifically (the panel re-evaluates on every render since it's derived from `form` state, not cached), and confirm the operator's approval queue shows the same mismatch for an unfixed screen.

- [ ] **Step 5: Persisted dimensions round-trip correctly**

```sql
select id, media_url, media_width, media_height from bookings where media_width is not null order by created_at desc limit 3;
select campaign_id, screen_id, media_url, media_width, media_height from campaign_screens where media_width is not null order by created_at desc limit 3;
```
Expected: dimensions present and matching what was uploaded (spot-check against the actual image/video's known dimensions).

- [ ] **Step 6: Confirm the acceptance criteria**

- A screen with no creative spec is never flagged as a mismatch, in either the wizard or the approval queue.
- An orientation, format, or file-size mismatch against a configured screen is shown visually (the creative rendered in that screen's shape), not just as text.
- The wizard's Next button is never disabled by a fit mismatch — advisory only.
- An advertiser can resolve a mismatch for one screen via a per-screen override without affecting other screens.
- The operator sees the same mismatch information during review, sourced from the same pure `checkCreativeFit` function used in the wizard.

- [ ] **Step 7: Commit the checked-off plan**

```bash
git add docs/superpowers/plans/2026-07-26-creative-spec-validation.md
git commit -m "docs: mark creative spec validation plan complete"
```
