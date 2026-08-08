# QR Min-Size Fix + Color Customization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the QR code rendering invisibly small in 180–240px preview cards, and let advertisers recolor the QR (dots + background) to match their creative, including two eyedropper mechanisms.

**Architecture:** A CSS `max()` floor keeps the QR box at least 44px regardless of container width — one-line change in `CreativePreview.jsx` and `DisplayPlayer.jsx`, no data model change. Color customization mirrors the existing `qr_x`/`qr_y`/`qr_size_pct` plumbing exactly: two new nullable columns (`qr_fg_color`, `qr_bg_color`) on `bookings` and `campaign_creatives`, threaded through `buildPreviewCampaign.js` → `getCreativeRenderPlan.js` → `display-feed/index.ts` → `DisplayPlayer.jsx`/`CreativePreview.jsx`. A new shared `ColorField` primitive (swatch + hex + eyedropper) replaces `CreativeCard.jsx`'s ad-hoc Accent Colour markup and adds two new fields for QR Dots/Background. The eyedropper button prefers the native `window.EyeDropper` (Chrome/Edge, samples anywhere on screen) and always offers a "from creative" canvas-sample fallback that works in every browser but is scoped to the uploaded creative image/video.

**Tech Stack:** React 19, Vitest + Testing Library, Supabase (Postgres + Deno edge functions), `react-qr-code` (already supports `fgColor`/`bgColor` props).

**Spec:** `docs/superpowers/specs/2026-08-08-qr-color-and-min-size-design.md`

---

## Known limitations (accepted, not fixed by this plan)

- Native `EyeDropper` is unsupported in Safari/Firefox as of this writing — those browsers only get the "from creative" canvas-sample button, which can sample the uploaded creative but not arbitrary on-screen pixels. Matches the design spec's explicit trade-off.
- "From creative" canvas sampling requires the media host to serve permissive CORS headers (Supabase public storage buckets do by default). A future non-Supabase media host could silently land every pick attempt in the caught-error path ("Couldn't sample this image"). Not solvable client-side; not worth blocking this plan over a hypothetical future host.
- The contrast guard only checks the fg/bg pair the advertiser picked — it does not simulate a scanner's actual decode tolerance (screen brightness, camera quality, ambient light all vary). It is advisory, matching `CreativeFitPanel`'s existing flag-don't-block precedent, not a scan-success guarantee.
- 44px is tuned for "recognizable as a QR in an operator-review thumbnail," not "scannable" — small-card renders (`CreativeFitPanel`, `ReadabilityPanel`, `CampaignDetail`) are never the surface an end-user scans. The live screen (`DisplayPlayer`) stays proportional at 8–30% of its own (large) container, per `QR_SIZE_PCT_MIN`/`MAX`, so it's essentially never affected by the 44px floor.

---

### Task 1: Database columns for QR color

**Files:**
- Create: `supabase/migrations/20260808000000_creative_qr_color_columns.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260808000000_creative_qr_color_columns.sql
-- QR foreground (dots) / background color, advertiser-controlled per
-- creative. Nullable so an unset value falls back to
-- getCreativeRenderPlan's default (qrFgColor: the creative's own accent
-- color, qrBgColor: white) -- every existing row keeps rendering exactly
-- as it does today (black-on-white via react-qr-code's own defaults was
-- never actually stored; it only ever came from the library's props being
-- unset), no backfill needed.
--
-- Format-checked as a 6-digit hex string (`#rrggbb`) rather than range-
-- checked like qr_x/qr_y/qr_size_pct, since color has no numeric range --
-- an invalid string here would otherwise reach react-qr-code's fgColor/
-- bgColor props unchecked.

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

ALTER TABLE public.campaign_creatives
  ADD COLUMN IF NOT EXISTS qr_fg_color text,
  ADD COLUMN IF NOT EXISTS qr_bg_color text;

ALTER TABLE public.campaign_creatives
  DROP CONSTRAINT IF EXISTS campaign_creatives_qr_fg_color_format;
ALTER TABLE public.campaign_creatives
  ADD CONSTRAINT campaign_creatives_qr_fg_color_format CHECK (qr_fg_color IS NULL OR qr_fg_color ~* '^#[0-9a-f]{6}$');

ALTER TABLE public.campaign_creatives
  DROP CONSTRAINT IF EXISTS campaign_creatives_qr_bg_color_format;
ALTER TABLE public.campaign_creatives
  ADD CONSTRAINT campaign_creatives_qr_bg_color_format CHECK (qr_bg_color IS NULL OR qr_bg_color ~* '^#[0-9a-f]{6}$');
```

- [ ] **Step 2: Apply it to the local/dev Supabase project**

Run: `supabase db push` (or the project's usual migration-apply command)
Expected: migration applies with no errors; `qr_fg_color`, `qr_bg_color` exist on both tables (verify with `\d bookings` / `\d campaign_creatives` in `psql`, or the Supabase dashboard table editor).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260808000000_creative_qr_color_columns.sql
git commit -m "feat: add qr_fg_color/qr_bg_color columns to bookings and campaign_creatives"
```

---

### Task 2: Pure color-validation helpers (`qrColor.js`)

**Files:**
- Create: `src/lib/qrColor.js`
- Test: `src/lib/qrColor.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/lib/qrColor.test.js
import { describe, it, expect } from 'vitest';
import { isValidHexColor, QR_CONTRAST_MIN_RATIO, HEX_COLOR_RE } from './qrColor.js';

describe('isValidHexColor', () => {
  it('accepts a 6-digit hex string', () => {
    expect(isValidHexColor('#7c3aed')).toBe(true);
    expect(isValidHexColor('#FFFFFF')).toBe(true);
    expect(isValidHexColor('#000000')).toBe(true);
  });

  it('rejects 3-digit shorthand, missing #, and malformed strings', () => {
    expect(isValidHexColor('#fff')).toBe(false);
    expect(isValidHexColor('7c3aed')).toBe(false);
    expect(isValidHexColor('#gggggg')).toBe(false);
    expect(isValidHexColor('')).toBe(false);
  });

  it('rejects non-string input without throwing', () => {
    expect(isValidHexColor(null)).toBe(false);
    expect(isValidHexColor(undefined)).toBe(false);
    expect(isValidHexColor(123456)).toBe(false);
  });
});

describe('QR_CONTRAST_MIN_RATIO', () => {
  it('is 3 (WCAG UI-component/large-text threshold, not the 4.5 body-text threshold)', () => {
    expect(QR_CONTRAST_MIN_RATIO).toBe(3);
  });
});

describe('HEX_COLOR_RE', () => {
  it('is case-insensitive', () => {
    expect(HEX_COLOR_RE.test('#AbCdEf')).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/qrColor.test.js`
Expected: FAIL with "Failed to resolve import './qrColor.js'" (file doesn't exist yet)

- [ ] **Step 3: Write the implementation**

```js
// src/lib/qrColor.js
// Pure helpers for QR foreground/background color customization -- no DOM,
// same shape as creativeQrPosition.js/creativeFit.js. Contrast math itself
// lives in creativeReadability.js's contrastRatio(); this only adds the
// QR-specific threshold and hex validation those callers need.

export const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

export function isValidHexColor(value) {
  return typeof value === 'string' && HEX_COLOR_RE.test(value);
}

// 3:1 -- WCAG's UI-component/large-text threshold -- rather than the 4.5:1
// creativeReadability.js uses for body text. QR modules are large,
// high-frequency shapes, not small text glyphs, so the stricter text
// threshold isn't the right proxy here. Advisory only (flag, don't block),
// same precedent as CreativeFitPanel's mismatch warnings.
export const QR_CONTRAST_MIN_RATIO = 3;
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/lib/qrColor.test.js`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/qrColor.js src/lib/qrColor.test.js
git commit -m "feat: add QR hex-color validation and contrast threshold"
```

---

### Task 3: Pure click-to-pixel math for "pick from creative" (`sampleMediaColor.js`)

**Files:**
- Create: `src/lib/sampleMediaColor.js`
- Test: `src/lib/sampleMediaColor.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/lib/sampleMediaColor.test.js
import { describe, it, expect } from 'vitest';
import { mapCoverClickToNatural, rgbToHex } from './sampleMediaColor.js';

describe('mapCoverClickToNatural', () => {
  it('maps 1:1 when the element and natural size match exactly (no crop)', () => {
    expect(mapCoverClickToNatural(50, 25, 100, 50, 100, 50)).toEqual({ x: 50, y: 25 });
  });

  it('accounts for horizontal crop when the element is wider than natural aspect (object-fit: cover)', () => {
    // natural 100x100 shown in a 200x100 box: scale = max(200/100, 100/100) = 2
    // displayed 200x200, vertical crop offset = (200-100)/2/2 = 25 natural px
    const result = mapCoverClickToNatural(0, 0, 200, 100, 100, 100);
    expect(result).toEqual({ x: 0, y: 25 });
  });

  it('clamps the result inside the natural image bounds', () => {
    expect(mapCoverClickToNatural(-50, -50, 100, 100, 100, 100)).toEqual({ x: 0, y: 0 });
    expect(mapCoverClickToNatural(500, 500, 100, 100, 100, 100)).toEqual({ x: 99, y: 99 });
  });

  it('returns the origin without throwing when any dimension is zero', () => {
    expect(mapCoverClickToNatural(10, 10, 0, 100, 100, 100)).toEqual({ x: 0, y: 0 });
    expect(mapCoverClickToNatural(10, 10, 100, 100, 0, 100)).toEqual({ x: 0, y: 0 });
  });
});

describe('rgbToHex', () => {
  it('converts RGB channel values to a lowercase hex string', () => {
    expect(rgbToHex(18, 52, 86)).toBe('#123456');
    expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
    expect(rgbToHex(0, 0, 0)).toBe('#000000');
  });

  it('pads single-digit hex channels with a leading zero', () => {
    expect(rgbToHex(1, 2, 3)).toBe('#010203');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/sampleMediaColor.test.js`
Expected: FAIL with "Failed to resolve import './sampleMediaColor.js'"

- [ ] **Step 3: Write the implementation**

```js
// src/lib/sampleMediaColor.js
// Pure math for "pick a color from the creative" -- no DOM, no canvas, same
// shape as creativeQrPosition.js. Needed because the media element renders
// with CSS object-fit: cover, which center-crops the natural image/video to
// fill its box; a naive rescale of a click's on-screen position back to
// natural-image coordinates would sample the wrong pixel whenever the crop
// is non-trivial. The actual canvas draw + pixel read lives inline in
// CreativeCard.jsx (untested glue, same precedent as QrOverlay's pointer-
// drag handlers in CreativePreview.jsx -- only the pure math is unit tested).

export function mapCoverClickToNatural(clickX, clickY, elWidth, elHeight, naturalWidth, naturalHeight) {
  if (!elWidth || !elHeight || !naturalWidth || !naturalHeight) return { x: 0, y: 0 };
  const scale = Math.max(elWidth / naturalWidth, elHeight / naturalHeight);
  const displayedWidth = naturalWidth * scale;
  const displayedHeight = naturalHeight * scale;
  const offsetX = (displayedWidth - elWidth) / 2 / scale;
  const offsetY = (displayedHeight - elHeight) / 2 / scale;
  const naturalX = offsetX + clickX / scale;
  const naturalY = offsetY + clickY / scale;
  return {
    x: Math.min(naturalWidth - 1, Math.max(0, Math.round(naturalX))),
    y: Math.min(naturalHeight - 1, Math.max(0, Math.round(naturalY))),
  };
}

export function rgbToHex(r, g, b) {
  const hex = (n) => n.toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`.toLowerCase();
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/lib/sampleMediaColor.test.js`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/sampleMediaColor.js src/lib/sampleMediaColor.test.js
git commit -m "feat: add pure click-to-natural-pixel math for creative color sampling"
```

---

### Task 4: `getCreativeRenderPlan.js` — QR color defaults

**Files:**
- Modify: `src/lib/getCreativeRenderPlan.js`
- Test: `src/lib/getCreativeRenderPlan.test.js` (append only — do not remove existing tests)

- [ ] **Step 1: Write the failing tests**

```js
// append to src/lib/getCreativeRenderPlan.test.js, inside the existing file
describe('getCreativeRenderPlan QR color', () => {
  it('defaults the QR dots to the accent color and the background to white', () => {
    const plan = getCreativeRenderPlan({ accent_color: '#123456' });
    expect(plan.qrFgColor).toBe('#123456');
    expect(plan.qrBgColor).toBe('#ffffff');
  });

  it('defaults the QR dots to the hardcoded accent fallback when no accent color is set', () => {
    expect(getCreativeRenderPlan({}).qrFgColor).toBe('#7c3aed');
  });

  it('uses stored qr_fg_color/qr_bg_color when present, overriding the accent-color default', () => {
    const plan = getCreativeRenderPlan({ accent_color: '#123456', qr_fg_color: '#ff0000', qr_bg_color: '#00ff00' });
    expect(plan.qrFgColor).toBe('#ff0000');
    expect(plan.qrBgColor).toBe('#00ff00');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/getCreativeRenderPlan.test.js`
Expected: FAIL — `plan.qrFgColor`/`plan.qrBgColor` are `undefined`

- [ ] **Step 3: Update the implementation**

```js
// src/lib/getCreativeRenderPlan.js
/**
 * The single source of truth for "what should this campaign's creative show,
 * and what does it say" -- shared between CreativePreview.jsx (wizard/
 * operator preview) and DisplayPlayer.jsx (actual physical screen playback),
 * so those two can no longer silently disagree about whether text overlays
 * an uploaded creative, or where/how big/what color the QR code renders.
 *
 * The dual fallback chains (advertiser/advertiser_name) exist because this
 * is called with two different data shapes: the App.jsx-aliased campaign
 * objects CreativePreview usually sees, and whatever supabase/functions/
 * display-feed returns directly to DisplayPlayer over HTTP. Neither caller
 * needs to know which shape it has.
 *
 * Note: cta is NOT a simple alias like advertiser/advertiser_name. In the
 * display-feed shape, campaign.cta is override-aware (per-screen CTAs already
 * factored in), while campaign.cta_text is just the booking-level default.
 * Always prioritize campaign.cta to respect per-screen overrides.
 *
 * qrX/qrY/qrSizePct default to a top-right position/size matching the
 * pre-QR-positioning hardcoded values (see src/lib/creativeQrPosition.js's
 * QR_DEFAULT) so an existing row with no stored position renders identically
 * to before this feature existed. qrFgColor/qrBgColor default to the
 * creative's own accent color and white -- react-qr-code's own black/white
 * defaults are never reached in practice, since bg is always computed first.
 */
export function getCreativeRenderPlan(campaign = {}) {
  campaign = campaign || {};
  const mediaUrl = campaign.media_url || null;
  const rawDestination = campaign.destination_url || campaign.destination || '';
  const bg = campaign.accent_color || campaign.color || '#7c3aed';
  return {
    mediaUrl,
    isVideo: campaign.media_type === 'video',
    showTextOverlay: !mediaUrl,
    template: campaign.creative_template || 'bottom_bar',
    headline: campaign.headline || campaign.advertiser || campaign.advertiser_name || '',
    cta: campaign.cta || campaign.cta_text || '',
    bg,
    secondaryBg: campaign.secondary_color || null,
    category: campaign.category || null,
    destination: rawDestination || 'https://adgrid.io',
    // A placeholder QR pointing at adgrid.io on a campaign with no real
    // destination_url just wastes screen real estate on a dead link.
    showQr: Boolean(rawDestination),
    qrX: typeof campaign.qr_x === 'number' ? campaign.qr_x : 90,
    qrY: typeof campaign.qr_y === 'number' ? campaign.qr_y : 14,
    qrSizePct: typeof campaign.qr_size_pct === 'number' ? campaign.qr_size_pct : 0.12,
    qrFgColor: campaign.qr_fg_color || bg,
    qrBgColor: campaign.qr_bg_color || '#ffffff',
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/lib/getCreativeRenderPlan.test.js`
Expected: PASS (all original tests + 3 new ones)

- [ ] **Step 5: Commit**

```bash
git add src/lib/getCreativeRenderPlan.js src/lib/getCreativeRenderPlan.test.js
git commit -m "feat: add QR color defaults to getCreativeRenderPlan"
```

---

### Task 5: `buildPreviewCampaign.js` — QR color passthrough

**Files:**
- Modify: `src/lib/buildPreviewCampaign.js`
- Test: `src/lib/buildPreviewCampaign.test.js`

- [ ] **Step 1: Update the existing tests (they assert on the full object shape via `toEqual`, so they must gain the new fields or they'll fail once the implementation changes)**

```js
// src/lib/buildPreviewCampaign.test.js
import { describe, it, expect } from 'vitest';
import { buildPreviewCampaign } from './buildPreviewCampaign.js';

describe('buildPreviewCampaign', () => {
  it('carries the creative fields through from form', () => {
    const form = {
      accent_color: '#7c3aed', destination_url: 'https://example.com', category: 'Food & Beverage',
      media_url: 'https://x/y.jpg', media_type: 'image', qr_x: 20, qr_y: 30, qr_size_pct: 0.18,
      qr_fg_color: '#ff0000', qr_bg_color: '#00ff00',
    };
    expect(buildPreviewCampaign(form)).toEqual({
      accent_color: '#7c3aed', destination_url: 'https://example.com', category: 'Food & Beverage',
      media_url: 'https://x/y.jpg', media_type: 'image', qr_x: 20, qr_y: 30, qr_size_pct: 0.18,
      qr_fg_color: '#ff0000', qr_bg_color: '#00ff00',
    });
  });

  it('defaults qr_x/qr_y/qr_size_pct/qr_fg_color/qr_bg_color to null when unset on the form', () => {
    const form = { accent_color: '', destination_url: '', category: '', media_url: '', media_type: '' };
    const result = buildPreviewCampaign(form);
    expect(result.qr_x).toBeNull();
    expect(result.qr_y).toBeNull();
    expect(result.qr_size_pct).toBeNull();
    expect(result.qr_fg_color).toBeNull();
    expect(result.qr_bg_color).toBeNull();
  });

  it('preserves qr_x/qr_y/qr_size_pct of exactly 0 rather than defaulting them', () => {
    const form = { accent_color: '', destination_url: '', category: '', media_url: '', media_type: '', qr_x: 0, qr_y: 0, qr_size_pct: 0 };
    const result = buildPreviewCampaign(form);
    expect(result.qr_x).toBe(0);
    expect(result.qr_y).toBe(0);
    expect(result.qr_size_pct).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/buildPreviewCampaign.test.js`
Expected: FAIL — `qr_fg_color`/`qr_bg_color` missing from the actual result

- [ ] **Step 3: Update the implementation**

```js
// src/lib/buildPreviewCampaign.js
export function buildPreviewCampaign(form) {
  return {
    destination_url: form.destination_url,
    accent_color: form.accent_color,
    category: form.category,
    media_url: form.media_url,
    media_type: form.media_type,
    qr_x: form.qr_x ?? null,
    qr_y: form.qr_y ?? null,
    qr_size_pct: form.qr_size_pct ?? null,
    qr_fg_color: form.qr_fg_color ?? null,
    qr_bg_color: form.qr_bg_color ?? null,
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/lib/buildPreviewCampaign.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/buildPreviewCampaign.js src/lib/buildPreviewCampaign.test.js
git commit -m "feat: pass qr_fg_color/qr_bg_color through buildPreviewCampaign"
```

---

### Task 6: `makeBlankCreative` — QR color defaults

**Files:**
- Modify: `src/lib/creativeAssignment.js`
- Test: `src/lib/creativeAssignment.test.js`

- [ ] **Step 1: Append the failing test**

```js
// append inside the existing `describe('makeBlankCreative', ...)` block in src/lib/creativeAssignment.test.js
  it('defaults qr_fg_color/qr_bg_color to null', () => {
    const c = makeBlankCreative();
    expect(c.qr_fg_color).toBeNull();
    expect(c.qr_bg_color).toBeNull();
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/creativeAssignment.test.js`
Expected: FAIL — `c.qr_fg_color` is `undefined`, not `null`

- [ ] **Step 3: Update the implementation**

```js
// src/lib/creativeAssignment.js — only makeBlankCreative's return object changes
export function makeBlankCreative(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    label: '',
    destination_url: '', accent_color: '#7c3aed', category: 'Food & Beverage',
    media_url: '', media_type: '', media_width: null, media_height: null,
    qr_x: null, qr_y: null, qr_size_pct: null,
    qr_fg_color: null, qr_bg_color: null,
    assigned_screen_ids: [],
    weight: 100,
    ...overrides,
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/lib/creativeAssignment.test.js`
Expected: PASS (all original tests + 1 new one)

- [ ] **Step 5: Commit**

```bash
git add src/lib/creativeAssignment.js src/lib/creativeAssignment.test.js
git commit -m "feat: default qr_fg_color/qr_bg_color to null on a blank creative"
```

---

### Task 7: `CreativePreview.jsx` — 44px QR floor + color props

**Files:**
- Modify: `src/components/shared/CreativePreview.jsx:146-175` (`QrOverlay`) and `:224-231` (its call site)
- Test: `src/components/shared/CreativePreview.test.jsx`

- [ ] **Step 1: Update the existing QR tests to expect the new `max()` width, and add color-prop tests**

```js
// src/components/shared/CreativePreview.test.jsx — replace the existing
// `describe('CreativePreview QR', ...)` block with this
describe('CreativePreview QR', () => {
  it('hides the QR entirely when no destination is set', () => {
    const { container } = render(<CreativePreview campaign={{ headline: 'Test' }} />);
    expect(container.querySelector('[data-qr-overlay]')).toBeNull();
  });

  it('shows the QR at the default top-right position/size when a destination is set', () => {
    const { container } = render(<CreativePreview campaign={{ destination_url: 'https://example.com' }} />);
    const qr = container.querySelector('[data-qr-overlay]');
    expect(qr).not.toBeNull();
    expect(qr.style.left).toBe('90%');
    expect(qr.style.top).toBe('14%');
    expect(qr.style.width).toBe('max(12%, 44px)');
  });

  it('positions the QR at a stored qr_x/qr_y/qr_size_pct', () => {
    const { container } = render(<CreativePreview campaign={{ destination_url: 'https://example.com', qr_x: 20, qr_y: 30, qr_size_pct: 0.2 }} />);
    const qr = container.querySelector('[data-qr-overlay]');
    expect(qr.style.left).toBe('20%');
    expect(qr.style.top).toBe('30%');
    expect(qr.style.width).toBe('max(20%, 44px)');
  });

  it('never shrinks the QR box below a 44px floor, even at a tiny sizePct', () => {
    const { container } = render(<CreativePreview campaign={{ destination_url: 'https://example.com', qr_size_pct: 0.01 }} />);
    const qr = container.querySelector('[data-qr-overlay]');
    expect(qr.style.width).toBe('max(1%, 44px)');
  });

  it('only renders the resize handle when editableQr is true', () => {
    const { container: readOnly } = render(<CreativePreview campaign={{ destination_url: 'https://example.com' }} />);
    expect(readOnly.querySelector('[data-qr-resize-handle]')).toBeNull();

    const { container: editable } = render(<CreativePreview campaign={{ destination_url: 'https://example.com' }} editableQr onQrChange={() => {}} />);
    expect(editable.querySelector('[data-qr-resize-handle]')).not.toBeNull();
  });
});

describe('CreativePreview QR color', () => {
  it('defaults the QR box background to white and dots to the accent color', () => {
    const { container } = render(<CreativePreview campaign={{ destination_url: 'https://example.com', accent_color: '#123456' }} />);
    const qr = container.querySelector('[data-qr-overlay]');
    expect(qr.style.background).toBe('rgb(255, 255, 255)');
    const paths = [...qr.querySelectorAll('svg path')];
    expect(paths.some(p => p.getAttribute('fill') === '#123456')).toBe(true);
  });

  it('uses stored qr_fg_color/qr_bg_color when set', () => {
    const { container } = render(<CreativePreview campaign={{ destination_url: 'https://example.com', qr_fg_color: '#ff0000', qr_bg_color: '#00ff00' }} />);
    const qr = container.querySelector('[data-qr-overlay]');
    expect(qr.style.background).toBe('rgb(0, 255, 0)');
    const paths = [...qr.querySelectorAll('svg path')];
    expect(paths.some(p => p.getAttribute('fill') === '#ff0000')).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/shared/CreativePreview.test.jsx`
Expected: FAIL — `qr.style.width` is still `'12%'`/`'20%'`, no `qr_fg_color`/`qr_bg_color` prop wiring exists yet

- [ ] **Step 3: Update `QrOverlay` and its call site**

```jsx
// src/components/shared/CreativePreview.jsx:103-175 — QrOverlay, updated signature and box style
function QrOverlay({ url, x, y, sizePct, frameAspect, editable, onChange, fgColor, bgColor }) {
  const frameRef = useRef(null);
  const dragMode = useRef(null);

  const onPointerMove = (e) => {
    const frame = frameRef.current;
    if (!frame || !dragMode.current) return;
    const rect = frame.getBoundingClientRect();
    if (dragMode.current === 'move') {
      const nx = ((e.clientX - rect.left) / rect.width) * 100;
      const ny = ((e.clientY - rect.top) / rect.height) * 100;
      const clamped = clampQrCenter(nx, ny, sizePct, frameAspect);
      onChange({ x: clamped.x, y: clamped.y, sizePct });
    } else {
      const centerXPx = rect.left + (x / 100) * rect.width;
      const centerYPx = rect.top + (y / 100) * rect.height;
      // The resize handle sits at the box's corner, and the box is always
      // rendered square (CSS aspect-ratio:1) regardless of frame aspect --
      // the corner sits at a diagonal distance of half-side*sqrt(2) from
      // center, so dividing by sqrt(2) (not 2) makes the corner track the
      // cursor along the drag direction instead of overshooting by ~41%.
      const distPx = Math.max(Math.hypot(e.clientX - centerXPx, e.clientY - centerYPx), 1);
      const nextSizePct = clampQrSizePct((distPx * Math.SQRT2) / rect.width);
      const clamped = clampQrCenter(x, y, nextSizePct, frameAspect);
      onChange({ x: clamped.x, y: clamped.y, sizePct: nextSizePct });
    }
  };

  const onPointerUp = () => {
    dragMode.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  };

  const startDrag = (mode) => (e) => {
    if (!editable) return;
    e.preventDefault();
    if (mode === 'resize') e.stopPropagation();
    dragMode.current = mode;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  return (
    <div ref={frameRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div
        data-qr-overlay
        onPointerDown={startDrag('move')}
        style={{
          position: 'absolute', left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)',
          // 44px floor keeps the QR visually recognizable in small preview
          // cards (CreativeFitPanel/ReadabilityPanel/CampaignDetail render
          // this component at 180-240px wide, where sizePct alone shrinks
          // the box to ~18-29px). max() scales normally above the floor.
          width: `max(${sizePct * 100}%, 44px)`, aspectRatio: '1', background: bgColor, borderRadius: '10%',
          padding: '8%', boxSizing: 'border-box', pointerEvents: editable ? 'auto' : 'none',
          cursor: editable ? 'grab' : 'default',
          boxShadow: editable ? '0 0 0 2px rgba(124,58,237,0.6)' : 'none',
          touchAction: editable ? 'none' : 'auto',
        }}
      >
        <QRCode value={url} size={256} style={{ width: '100%', height: '100%' }} level="M" fgColor={fgColor} bgColor={bgColor} />
        {editable && (
          <div
            data-qr-resize-handle
            onPointerDown={startDrag('resize')}
            style={{
              position: 'absolute', right: -6, bottom: -6, width: 14, height: 14,
              borderRadius: '50%', background: '#7c3aed', border: '2px solid #fff',
              cursor: 'nwse-resize', touchAction: 'none',
            }}
          />
        )}
      </div>
    </div>
  );
}
```

```jsx
// src/components/shared/CreativePreview.jsx:183-236 — CreativePreview, updated
// destructuring and QrOverlay call site (rest of the function is unchanged)
export function CreativePreview({ campaign, aspectRatio = '16/9', blurPx = 0, editableQr = false, onQrChange }) {
  const plan = getCreativeRenderPlan(campaign);
  const { mediaUrl, isVideo, showTextOverlay, template, headline, cta, bg, secondaryBg, category, destination, showQr, qrX, qrY, qrSizePct, qrFgColor, qrBgColor } = plan;
  // ... unchanged: Body, wRatio/hRatio, frameAspect, mediaStyle ...

  return (
    <div data-template={template} style={{ /* unchanged */ }}>
      {/* ... unchanged media/scrim/watermark JSX ... */}
      {showQr && (
        <QrOverlay
          url={destination}
          x={qrX} y={qrY} sizePct={qrSizePct}
          frameAspect={frameAspect}
          editable={editableQr}
          onChange={onQrChange || (() => {})}
          fgColor={qrFgColor}
          bgColor={qrBgColor}
        />
      )}
      {/* ... unchanged Body JSX ... */}
    </div>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/components/shared/CreativePreview.test.jsx`
Expected: PASS (all tests, including the 2 new `CreativePreview QR color` cases)

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/CreativePreview.jsx src/components/shared/CreativePreview.test.jsx
git commit -m "fix: floor the QR box at 44px and wire fgColor/bgColor through CreativePreview"
```

---

### Task 8: `CreativePreview.jsx` — media ref + "pick from creative" click wiring

**Files:**
- Modify: `src/components/shared/CreativePreview.jsx` (media `<img>`/`<video>` tags, ~lines 203-207)
- Test: `src/components/shared/CreativePreview.test.jsx`

- [ ] **Step 1: Write the failing tests**

```js
// append to src/components/shared/CreativePreview.test.jsx
describe('CreativePreview media pick mode', () => {
  it('forwards mediaRef to the rendered media element', () => {
    const mediaRef = { current: null };
    render(<CreativePreview campaign={{ headline: 'Test', media_url: 'https://x/y.jpg', media_type: 'image' }} mediaRef={mediaRef} />);
    expect(mediaRef.current).not.toBeNull();
    expect(mediaRef.current.tagName).toBe('IMG');
  });

  it('calls onPickColor with click coordinates relative to the media element when pickColorMode is true', () => {
    const onPickColor = vi.fn();
    const { container } = render(
      <CreativePreview
        campaign={{ headline: 'Test', media_url: 'https://x/y.jpg', media_type: 'image' }}
        pickColorMode
        onPickColor={onPickColor}
      />
    );
    const img = container.querySelector('img');
    vi.spyOn(img, 'getBoundingClientRect').mockReturnValue({ left: 10, top: 20, width: 100, height: 100 });
    fireEvent.click(img, { clientX: 30, clientY: 50 });
    expect(onPickColor).toHaveBeenCalledWith(20, 30);
  });

  it('does not call onPickColor when pickColorMode is false', () => {
    const onPickColor = vi.fn();
    const { container } = render(
      <CreativePreview campaign={{ headline: 'Test', media_url: 'https://x/y.jpg', media_type: 'image' }} onPickColor={onPickColor} />
    );
    fireEvent.click(container.querySelector('img'), { clientX: 30, clientY: 50 });
    expect(onPickColor).not.toHaveBeenCalled();
  });
});
```

Also add `fireEvent` and `vi` to the file's existing `import { describe, it, expect } from 'vitest';` / `import { render } from '@testing-library/react';` lines:

```js
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/shared/CreativePreview.test.jsx`
Expected: FAIL — `mediaRef.current` stays `null`, `onPickColor` never called

- [ ] **Step 3: Update the media elements**

```jsx
// src/components/shared/CreativePreview.jsx — updated signature (adds
// mediaRef, pickColorMode, onPickColor, all optional so every read-only
// consumer that omits them is unaffected) and a local click handler
export function CreativePreview({
  campaign, aspectRatio = '16/9', blurPx = 0, editableQr = false, onQrChange,
  mediaRef, pickColorMode = false, onPickColor,
}) {
  const plan = getCreativeRenderPlan(campaign);
  const { mediaUrl, isVideo, showTextOverlay, template, headline, cta, bg, secondaryBg, category, destination, showQr, qrX, qrY, qrSizePct, qrFgColor, qrBgColor } = plan;
  const Body = BODIES[template] || BottomBarBody;
  const [wRatio, hRatio] = String(aspectRatio).split('/').map(Number);
  const frameAspect = wRatio && hRatio ? wRatio / hRatio : 16 / 9;

  const mediaStyle = template === 'split_panel'
    ? { position: 'absolute', top: 0, bottom: 0, left: '40%', right: 0, objectFit: 'cover' }
    : { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' };

  // "Pick from creative" mode -- CreativeCard.jsx sets pickColorMode true
  // while an eyedropper's "from creative" button is armed. The click
  // coordinates are relative to the media element itself (not the frame),
  // since mediaStyle can confine media to less than the full frame
  // (split_panel's right 60%) -- CreativeCard maps them to a natural-pixel
  // color sample via sampleMediaColor.js's mapCoverClickToNatural.
  const handleMediaClick = (e) => {
    if (!pickColorMode || !onPickColor) return;
    const rect = e.currentTarget.getBoundingClientRect();
    onPickColor(e.clientX - rect.left, e.clientY - rect.top);
  };

  return (
    <div data-template={template} style={{
      position: 'relative', width: '100%', aspectRatio,
      filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined,
      background: `linear-gradient(160deg, #050a10 0%, #0d1520 60%, ${bg}22 100%)`,
      borderRadius: 8, overflow: 'hidden', flexShrink: 0,
    }}>
      {mediaUrl && (isVideo ? (
        <video
          ref={mediaRef} src={mediaUrl} muted loop autoPlay playsInline crossOrigin="anonymous"
          onClick={pickColorMode ? handleMediaClick : undefined}
          style={{ ...mediaStyle, cursor: pickColorMode ? 'crosshair' : undefined }}
        />
      ) : (
        <img
          ref={mediaRef} src={mediaUrl} alt="" crossOrigin="anonymous"
          onClick={pickColorMode ? handleMediaClick : undefined}
          style={{ ...mediaStyle, cursor: pickColorMode ? 'crosshair' : undefined }}
        />
      ))}
      {mediaUrl && template !== 'split_panel' && (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 55%)', pointerEvents: 'none' }} />
      )}
      {!mediaUrl && <div style={{
        position: 'absolute', top: '-10%', right: '-5%',
        width: '50%', height: '60%',
        background: `radial-gradient(ellipse, ${bg}44 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: bg }} />
      <div style={{
        position: 'absolute', top: 10, left: 12, zIndex: 2,
        fontSize: 8, fontWeight: 700, letterSpacing: '2px',
        color: 'rgba(255,255,255,0.2)', fontFamily: F.sans, textTransform: 'uppercase',
      }}>ADGRID</div>
      {showQr && (
        <QrOverlay
          url={destination}
          x={qrX} y={qrY} sizePct={qrSizePct}
          frameAspect={frameAspect}
          editable={editableQr}
          onChange={onQrChange || (() => {})}
          fgColor={qrFgColor}
          bgColor={qrBgColor}
        />
      )}
      {showTextOverlay && (
        <Body headline={headline} cta={cta} bg={bg} secondaryBg={secondaryBg} category={category} headlineFont={fontFor(campaign?.creative_font)} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/components/shared/CreativePreview.test.jsx`
Expected: PASS (all tests, including the 3 new `CreativePreview media pick mode` cases)

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/CreativePreview.jsx src/components/shared/CreativePreview.test.jsx
git commit -m "feat: support mediaRef + pick-from-creative click mode in CreativePreview"
```

---

### Task 9: `DisplayPlayer.jsx` — real-screen QR floor + color

**Files:**
- Modify: `src/views/display/DisplayPlayer.jsx:68-84`

- [ ] **Step 1: Update the QR box**

```jsx
// src/views/display/DisplayPlayer.jsx:68-84
      {/* QR code — advertiser-positioned via qr_x/qr_y/qr_size_pct and
          colored via qr_fg_color/qr_bg_color, hidden entirely when the
          campaign has no real destination_url. Same 44px floor as
          CreativePreview.jsx's QrOverlay, though it essentially never
          triggers here — this container is the fullscreen physical
          display, and qrSizePct is clamped to 8-30% (creativeQrPosition.js)
          of it. */}
      {plan.showQr && (
        <div style={{
          position: 'absolute',
          left: `${plan.qrX}%`, top: `${plan.qrY}%`, transform: 'translate(-50%, -50%)',
          width: `max(${plan.qrSizePct * 100}%, 44px)`,
          background: plan.qrBgColor, borderRadius: 12, padding: 'clamp(8px, 1.2vw, 16px)',
          boxSizing: 'border-box', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          <QRCode value={qrUrl} size={256} style={{ width: '100%', height: 'auto', display: 'block' }} level="M" fgColor={plan.qrFgColor} bgColor={plan.qrBgColor} />
          <div style={{
            fontSize: 'clamp(8px, 0.8vw, 12px)', color: '#555', textAlign: 'center',
            marginTop: 6, fontFamily: "'Inter', sans-serif", fontWeight: 500,
          }}>Scan to learn more</div>
        </div>
      )}
```

- [ ] **Step 2: Manual verification (no automated test harness exists for DisplayPlayer today — confirm before skipping)**

Run: `find src -iname "DisplayPlayer*test*"`
Expected: no matches (confirms there's genuinely no existing DisplayPlayer test suite to update)

Then read the edited block back and confirm by eye: `plan.qrBgColor`/`plan.qrFgColor` come from `getCreativeRenderPlan` (Task 4), which already defaults them safely for every existing row (no `undefined` reaching `react-qr-code`'s props).

- [ ] **Step 3: Commit**

```bash
git add src/views/display/DisplayPlayer.jsx
git commit -m "fix: floor the live-screen QR box at 44px and honor qr_fg_color/qr_bg_color"
```

---

### Task 10: `ColorField` primitive (swatch + hex + eyedropper)

**Files:**
- Create: `src/components/primitives/ColorField.jsx`
- Test: `src/components/primitives/ColorField.test.jsx`

- [ ] **Step 1: Write the failing tests**

```jsx
// src/components/primitives/ColorField.test.jsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColorField } from './ColorField.jsx';

afterEach(() => {
  vi.restoreAllMocks();
  delete window.EyeDropper;
});

describe('ColorField', () => {
  it('renders the label, swatch, and current hex value', () => {
    render(<ColorField label="Dots" value="#7c3aed" onChange={() => {}} />);
    expect(screen.getByText('Dots')).toBeInTheDocument();
    expect(screen.getByDisplayValue('#7c3aed')).toBeInTheDocument();
  });

  it('commits a valid typed hex value on blur', () => {
    const onChange = vi.fn();
    render(<ColorField label="Dots" value="#7c3aed" onChange={onChange} />);
    const hexInput = screen.getByDisplayValue('#7c3aed');
    fireEvent.change(hexInput, { target: { value: '#ff0000' } });
    fireEvent.blur(hexInput);
    expect(onChange).toHaveBeenCalledWith('#ff0000');
  });

  it('reverts an invalid typed hex value on blur without calling onChange', () => {
    const onChange = vi.fn();
    render(<ColorField label="Dots" value="#7c3aed" onChange={onChange} />);
    const hexInput = screen.getByDisplayValue('#7c3aed');
    fireEvent.change(hexInput, { target: { value: 'not-a-color' } });
    fireEvent.blur(hexInput);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('#7c3aed')).toBeInTheDocument();
  });

  it('calls onChange immediately when the native color swatch changes', () => {
    const onChange = vi.fn();
    render(<ColorField label="Dots" value="#7c3aed" onChange={onChange} />);
    const swatch = document.querySelector('input[type="color"]');
    fireEvent.change(swatch, { target: { value: '#00ff00' } });
    expect(onChange).toHaveBeenCalledWith('#00ff00');
  });

  it('shows the native eyedropper button only when window.EyeDropper exists', () => {
    const { rerender } = render(<ColorField label="Dots" value="#7c3aed" onChange={() => {}} />);
    expect(screen.queryByTitle('Pick color from screen')).not.toBeInTheDocument();

    window.EyeDropper = function () {};
    rerender(<ColorField label="Dots" value="#7c3aed" onChange={() => {}} />);
    expect(screen.getByTitle('Pick color from screen')).toBeInTheDocument();
  });

  it('applies the native EyeDropper result to the field', async () => {
    const onChange = vi.fn();
    window.EyeDropper = function () {
      this.open = () => Promise.resolve({ sRGBHex: '#abcdef' });
    };
    render(<ColorField label="Dots" value="#7c3aed" onChange={onChange} />);
    fireEvent.click(screen.getByTitle('Pick color from screen'));
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith('#abcdef'));
  });

  it('does not render the "from creative" button when onPickFromCreative is not passed', () => {
    render(<ColorField label="Dots" value="#7c3aed" onChange={() => {}} />);
    expect(screen.queryByText(/from creative/i)).not.toBeInTheDocument();
  });

  it('calls onPickFromCreative when its button is clicked', () => {
    const onPickFromCreative = vi.fn();
    render(<ColorField label="Dots" value="#7c3aed" onChange={() => {}} onPickFromCreative={onPickFromCreative} />);
    fireEvent.click(screen.getByText(/from creative/i));
    expect(onPickFromCreative).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/primitives/ColorField.test.jsx`
Expected: FAIL with "Failed to resolve import './ColorField.jsx'"

- [ ] **Step 3: Write the implementation**

```jsx
// src/components/primitives/ColorField.jsx
import { useState, useEffect } from 'react';
import { C, F } from '../../design/tokens.js';
import { isValidHexColor } from '../../lib/qrColor.js';

// Swatch + hex input + eyedropper, shared by CreativeCard's Accent Colour
// and QR Dots/Background fields.
//
// Eyedropper has two independent paths, both optional:
//   - Native `window.EyeDropper` (Chrome/Edge only) samples any pixel on
//     screen, including outside the browser window. Button only renders
//     when the API exists -- Safari/Firefox get no dead button.
//   - `onPickFromCreative`, when passed, renders a second "From creative"
//     button. Callers (CreativeCard.jsx) wire this to a canvas-based sample
//     off the actual uploaded creative -- works in every browser, but only
//     the caller knows whether a creative is even uploaded yet, so a null
//     onPickFromCreative hides the button rather than rendering a dead one.
const EyedropperIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m2 22 1-4 9-9" />
    <path d="M14.5 5.5 18 2l4 4-3.5 3.5" />
    <path d="m10 13 4-4 4 4-4 4-4-4Z" />
  </svg>
);

export function ColorField({ label, value, onChange, onPickFromCreative }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);

  const hasNativeEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window;

  const commitDraft = () => {
    if (isValidHexColor(draft)) onChange(draft);
    else setDraft(value); // reject: revert to the last valid value
  };

  const openNativeEyeDropper = async () => {
    try {
      const result = await new window.EyeDropper().open();
      setDraft(result.sRGBHex);
      onChange(result.sRGBHex);
    } catch {
      // user cancelled the native picker -- no-op
    }
  };

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="color"
          value={value}
          onChange={e => { setDraft(e.target.value); onChange(e.target.value); }}
          style={{ width: 40, height: 36, border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', padding: 2 }}
        />
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commitDraft}
          style={{ width: 80, fontSize: 12, color: C.textSub, fontFamily: F.mono, border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 8px' }}
        />
        {hasNativeEyeDropper && (
          <button
            type="button" onClick={openNativeEyeDropper} title="Pick color from screen"
            style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${C.border}`, borderRadius: 6, background: C.surface, cursor: 'pointer', color: C.textSub }}
          >
            <EyedropperIcon />
          </button>
        )}
        {onPickFromCreative && (
          <button
            type="button" onClick={onPickFromCreative} title="Pick color from your creative"
            style={{ padding: '0 10px', height: 32, border: `1px solid ${C.border}`, borderRadius: 6, background: C.surface, cursor: 'pointer', fontSize: 11, fontFamily: F.sans, color: C.textSub, whiteSpace: 'nowrap' }}
          >
            From creative
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/components/primitives/ColorField.test.jsx`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/primitives/ColorField.jsx src/components/primitives/ColorField.test.jsx
git commit -m "feat: add ColorField primitive (swatch + hex + eyedropper)"
```

---

### Task 11: `CreativeCard.jsx` — Accent Colour + QR Colours via `ColorField`, with pick-from-creative wiring

**Files:**
- Modify: `src/views/advertiser/createCampaign/CreativeCard.jsx`
- Test: `src/views/advertiser/createCampaign/CreativeCard.test.jsx`

- [ ] **Step 1: Write the failing tests**

```jsx
// append to src/views/advertiser/createCampaign/CreativeCard.test.jsx
describe('CreativeCard QR colours', () => {
  it('does not render the QR Colours section when destination_url is empty', () => {
    const creative = makeBlankCreative({ id: 'c1', label: 'A', destination_url: '' });
    render(
      <CreativeCard creative={creative} onChange={() => {}} onRemove={() => {}} poolScreens={POOL_SCREENS} allCreatives={[creative]} showAssignment={false} duration={15} onSplitByType={() => {}} profile={null} />
    );
    expect(screen.queryByText('QR Code Colours')).not.toBeInTheDocument();
  });

  it('renders Dots and Background color fields when destination_url is set', () => {
    const creative = makeBlankCreative({ id: 'c1', label: 'A', destination_url: 'https://example.com' });
    render(
      <CreativeCard creative={creative} onChange={() => {}} onRemove={() => {}} poolScreens={POOL_SCREENS} allCreatives={[creative]} showAssignment={false} duration={15} onSplitByType={() => {}} profile={null} />
    );
    expect(screen.getByText('QR Code Colours')).toBeInTheDocument();
    expect(screen.getByText('Dots')).toBeInTheDocument();
    expect(screen.getByText('Background')).toBeInTheDocument();
  });

  it('shows a low-contrast warning when qr_fg_color and qr_bg_color are too close', () => {
    const creative = makeBlankCreative({ id: 'c1', label: 'A', destination_url: 'https://example.com', qr_fg_color: '#ffffff', qr_bg_color: '#ffffff' });
    render(
      <CreativeCard creative={creative} onChange={() => {}} onRemove={() => {}} poolScreens={POOL_SCREENS} allCreatives={[creative]} showAssignment={false} duration={15} onSplitByType={() => {}} profile={null} />
    );
    expect(screen.getByText(/Low contrast/)).toBeInTheDocument();
  });

  it('does not show a low-contrast warning for the default accent-color/white pair', () => {
    const creative = makeBlankCreative({ id: 'c1', label: 'A', destination_url: 'https://example.com', accent_color: '#7c3aed' });
    render(
      <CreativeCard creative={creative} onChange={() => {}} onRemove={() => {}} poolScreens={POOL_SCREENS} allCreatives={[creative]} showAssignment={false} duration={15} onSplitByType={() => {}} profile={null} />
    );
    expect(screen.queryByText(/Low contrast/)).not.toBeInTheDocument();
  });

  it('hides every "From creative" button when no media is uploaded', () => {
    const creative = makeBlankCreative({ id: 'c1', label: 'A', destination_url: 'https://example.com', media_url: '' });
    render(
      <CreativeCard creative={creative} onChange={() => {}} onRemove={() => {}} poolScreens={POOL_SCREENS} allCreatives={[creative]} showAssignment={false} duration={15} onSplitByType={() => {}} profile={null} />
    );
    expect(screen.queryByText(/from creative/i)).not.toBeInTheDocument();
  });

  it('samples a color from the creative and applies it to the field that armed the pick', () => {
    const creative = makeBlankCreative({ id: 'c1', label: 'A', destination_url: 'https://example.com', media_url: 'https://x/y.jpg', media_type: 'image' });
    const onChange = vi.fn();

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
      getImageData: () => ({ data: new Uint8ClampedArray([18, 52, 86, 255]) }),
    });
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100 });

    render(
      <CreativeCard creative={creative} onChange={onChange} onRemove={() => {}} poolScreens={POOL_SCREENS} allCreatives={[creative]} showAssignment={false} duration={15} onSplitByType={() => {}} profile={null} />
    );

    const img = document.querySelector('img');
    Object.defineProperty(img, 'naturalWidth', { value: 400, configurable: true });
    Object.defineProperty(img, 'naturalHeight', { value: 300, configurable: true });

    // First "From creative" button in DOM order belongs to Accent Colour.
    fireEvent.click(screen.getAllByText(/from creative/i)[0]);
    fireEvent.click(img, { clientX: 10, clientY: 10 });

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ accent_color: '#123456' }));

    vi.restoreAllMocks();
  });

  it('shows a "couldn\'t sample" message when canvas sampling throws (e.g. a CORS-tainted canvas)', () => {
    const creative = makeBlankCreative({ id: 'c1', label: 'A', destination_url: 'https://example.com', media_url: 'https://x/y.jpg', media_type: 'image' });

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: () => { throw new Error('SecurityError'); },
    });
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100 });

    render(
      <CreativeCard creative={creative} onChange={() => {}} onRemove={() => {}} poolScreens={POOL_SCREENS} allCreatives={[creative]} showAssignment={false} duration={15} onSplitByType={() => {}} profile={null} />
    );

    const img = document.querySelector('img');
    fireEvent.click(screen.getAllByText(/from creative/i)[0]);
    fireEvent.click(img, { clientX: 10, clientY: 10 });

    expect(screen.getByText(/Couldn't sample this image/)).toBeInTheDocument();

    vi.restoreAllMocks();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/views/advertiser/createCampaign/CreativeCard.test.jsx`
Expected: FAIL — no "QR Code Colours" text, no "From creative" buttons exist yet

- [ ] **Step 3: Update the implementation**

```jsx
// src/views/advertiser/createCampaign/CreativeCard.jsx
import { useRef, useState } from 'react';
import { C, F } from '../../../design/tokens.js';
import { Inp } from '../../../components/primitives/Inp.jsx';
import { SelInput } from '../../../components/primitives/SelInput.jsx';
import { ColorField } from '../../../components/primitives/ColorField.jsx';
import { CreativePreview } from '../../../components/shared/CreativePreview.jsx';
import { CreativeFitPanel } from '../../../components/shared/CreativeFitPanel.jsx';
import { checkCreativeFit } from '../../../lib/creativeFit.js';
import { isValidDestinationUrl } from '../../../lib/destinationUrl.js';
import { contrastRatio } from '../../../lib/creativeReadability.js';
import { QR_CONTRAST_MIN_RATIO } from '../../../lib/qrColor.js';
import { mapCoverClickToNatural, rgbToHex } from '../../../lib/sampleMediaColor.js';
import { CATEGORIES } from '../../../lib/data.js';
import { QR_CORNER_PRESETS, clampQrCenter } from '../../../lib/creativeQrPosition.js';
import { MediaUpload } from './MediaUpload.jsx';

const FRAME_ASPECT = 16 / 9;

// Reads the pixel the user clicked on the media element, in the element's
// own natural (unscaled) pixel space, accounting for CSS object-fit: cover's
// center-crop (mapCoverClickToNatural). Throws if the canvas is tainted by a
// cross-origin media host with no CORS headers -- callers must catch this.
function sampleColorAtClick(mediaEl, clickX, clickY) {
  const rect = mediaEl.getBoundingClientRect();
  const naturalWidth = mediaEl.naturalWidth ?? mediaEl.videoWidth;
  const naturalHeight = mediaEl.naturalHeight ?? mediaEl.videoHeight;
  const { x, y } = mapCoverClickToNatural(clickX, clickY, rect.width, rect.height, naturalWidth, naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(mediaEl, x, y, 1, 1, 0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return rgbToHex(r, g, b);
}

// One creative's authoring fields + preview + screen assignment, used both
// for the single default creative (no assignment UI shown — it implicitly
// covers every pool screen) and for each of 2+ creatives (assignment UI shown).
//
// Advertisers upload their own fully-designed creative — AdGrid no longer
// generates a text-card from a headline/CTA/template, since that duplicated
// (and could visually clash with) whatever the advertiser already designed
// into their upload. The only remaining authored fields are the destination
// (for the QR), category (for targeting), and accent/QR colours.
export function CreativeCard({
  creative, onChange, onRemove, poolScreens, allCreatives, showAssignment, onSplitByType,
}) {
  const setField = (k, v) => onChange({ ...creative, [k]: v });
  // MediaUpload calls setForm(s => ({ ...s, media_url, media_type, media_width, media_height })) --
  // it needs the *whole* creative as "previous state" so destination_url/accent_color/etc
  // survive the update, not just the four media fields.
  const setMediaForm = (updater) => onChange(updater(creative));

  const hasDestination = Boolean(creative.destination_url?.trim());

  const setQr = ({ x, y, sizePct }) => onChange({ ...creative, qr_x: x, qr_y: y, qr_size_pct: sizePct });
  const snapQrTo = (corner) => {
    const preset = QR_CORNER_PRESETS[corner];
    const sizePct = creative.qr_size_pct ?? 0.12;
    const clamped = clampQrCenter(preset.x, preset.y, sizePct, FRAME_ASPECT);
    setQr({ x: clamped.x, y: clamped.y, sizePct });
  };

  // "Pick from creative" eyedropper: pickField names which creative field
  // (accent_color / qr_fg_color / qr_bg_color) the next click on the media
  // element should fill. Shared across all three ColorFields rather than
  // one flag per field, since only one pick can be armed at a time.
  const [pickField, setPickField] = useState(null);
  const [pickError, setPickError] = useState('');
  const mediaRef = useRef(null);

  const startPick = (field) => {
    setPickError('');
    setPickField(field);
  };

  const handleMediaPick = (clickX, clickY) => {
    if (!pickField || !mediaRef.current) return;
    try {
      const hex = sampleColorAtClick(mediaRef.current, clickX, clickY);
      setField(pickField, hex);
      setPickError('');
    } catch {
      setPickError("Couldn't sample this image — use the color picker instead.");
    }
    setPickField(null);
  };

  const qrFgColor = creative.qr_fg_color || creative.accent_color || '#7c3aed';
  const qrBgColor = creative.qr_bg_color || '#ffffff';
  const qrContrastRatioValue = contrastRatio(qrFgColor, qrBgColor);
  const qrContrastWarning = qrContrastRatioValue < QR_CONTRAST_MIN_RATIO
    ? `Low contrast — this QR may not scan reliably (${qrContrastRatioValue.toFixed(1)}:1, aim for ${QR_CONTRAST_MIN_RATIO}:1+).`
    : null;

  const assignedScreens = poolScreens.filter(s => creative.assigned_screen_ids.includes(s.id));
  const screensForFitCheck = showAssignment ? assignedScreens : poolScreens;

  const fitMismatches = creative.media_url
    ? screensForFitCheck
        .map(s => {
          const { status, reasons } = checkCreativeFit(
            { widthPx: creative.media_width, heightPx: creative.media_height, fileType: creative.media_type === 'video' ? 'video/mp4' : 'image/png', fileSizeMb: 0 },
            { resolution_w: s.resolution_w, resolution_h: s.resolution_h, accepted_formats: s.accepted_formats, max_file_mb: s.max_file_mb },
          );
          return status === 'mismatch' ? { screenId: s.id, screenName: s.name, reasons, resolution_w: s.resolution_w, resolution_h: s.resolution_h } : null;
        })
        .filter(Boolean)
    : [];

  const otherCreatives = allCreatives.filter(c => c.id !== creative.id);
  const overlapsAnother = showAssignment && otherCreatives.some(c => c.assigned_screen_ids.some(id => creative.assigned_screen_ids.includes(id)));

  return (
    <div style={{ padding: 24, background: C.surfaceAlt, borderRadius: 12, border: `1px solid ${C.border}`, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Inp label="" placeholder="Creative label" value={creative.label} onChange={e => setField('label', e.target.value)} />
        {onRemove && (
          <button type="button" onClick={onRemove} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 10px', fontSize: 12, color: C.red, cursor: 'pointer', fontFamily: F.sans, marginLeft: 12, flexShrink: 0 }}>
            Remove
          </button>
        )}
      </div>

      <MediaUpload form={creative} setForm={setMediaForm} />
      {!creative.media_url && (
        <div style={{ fontSize: 12, color: C.red, fontFamily: F.sans, marginTop: -14, marginBottom: 14 }}>
          Upload your ad creative to continue — every campaign needs its own designed image or video.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 28 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Inp label="Destination URL (optional)" placeholder="https://example.com" type="url" value={creative.destination_url} onChange={e => setField('destination_url', e.target.value)} />
          {creative.destination_url.trim() !== '' && !isValidDestinationUrl(creative.destination_url) ? (
            <div style={{ fontSize: 11, color: C.red, fontFamily: F.sans, marginTop: -8 }}>
              Enter a full web address, like https://example.com — this is where your QR code sends people.
            </div>
          ) : (
            <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: -8 }}>
              Add one to show a scannable QR code on the ad. Leave blank to run without one.
            </div>
          )}
          <SelInput label="Category" value={creative.category} onChange={e => setField('category', e.target.value)}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </SelInput>
          <ColorField
            label="Accent Colour"
            value={creative.accent_color}
            onChange={hex => setField('accent_color', hex)}
            onPickFromCreative={creative.media_url ? () => startPick('accent_color') : null}
          />
          {hasDestination && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 6 }}>QR Code Colours</div>
              <div style={{ display: 'flex', gap: 16 }}>
                <ColorField
                  label="Dots"
                  value={qrFgColor}
                  onChange={hex => setField('qr_fg_color', hex)}
                  onPickFromCreative={creative.media_url ? () => startPick('qr_fg_color') : null}
                />
                <ColorField
                  label="Background"
                  value={qrBgColor}
                  onChange={hex => setField('qr_bg_color', hex)}
                  onPickFromCreative={creative.media_url ? () => startPick('qr_bg_color') : null}
                />
              </div>
              {pickField && (
                <div style={{ fontSize: 11, color: C.purple, fontFamily: F.sans, marginTop: 6 }}>
                  Click anywhere on your creative preview to sample that color.
                </div>
              )}
              {pickError && (
                <div style={{ fontSize: 11, color: C.red, fontFamily: F.sans, marginTop: 6 }}>{pickError}</div>
              )}
              {qrContrastWarning && (
                <div style={{ fontSize: 11, color: C.amber, fontFamily: F.sans, marginTop: 6 }}>{qrContrastWarning}</div>
              )}
            </div>
          )}
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.textMid, fontFamily: F.sans, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Preview</div>
          <CreativePreview
            campaign={creative}
            editableQr={hasDestination}
            onQrChange={setQr}
            mediaRef={mediaRef}
            pickColorMode={Boolean(pickField)}
            onPickColor={handleMediaPick}
          />
          {hasDestination && (
            <>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                {Object.keys(QR_CORNER_PRESETS).map(corner => (
                  <button key={corner} type="button" onClick={() => snapQrTo(corner)} style={{
                    flex: 1, padding: '6px 4px', borderRadius: 6, border: `1px solid ${C.border}`,
                    background: C.surface, color: C.textSub, fontSize: 10, fontFamily: F.sans, cursor: 'pointer', textTransform: 'capitalize',
                  }}>
                    {corner.replace('_', ' ')}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 6 }}>
                Drag the QR code to reposition it, or drag its corner handle to resize.
              </div>
            </>
          )}
          <CreativeFitPanel campaign={creative} mismatches={fitMismatches} />
        </div>
      </div>

      {showAssignment && (
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.textMid, fontFamily: F.sans }}>
              Show on ({creative.assigned_screen_ids.length} of {poolScreens.length} screens)
            </div>
            <button type="button" onClick={onSplitByType} style={{ background: 'none', border: 'none', fontSize: 12, color: C.purple, cursor: 'pointer', fontFamily: F.sans, padding: 0 }}>
              Split by screen type →
            </button>
          </div>
          {overlapsAnother && (
            <div style={{ marginBottom: 10 }}>
              <Inp
                label="Share of plays on shared screens (%)"
                type="number" min="1" max="100" step="1"
                value={String(creative.weight)}
                onChange={e => setField('weight', Math.max(1, parseInt(e.target.value, 10) || 1))}
                hint="Only matters where this creative shares a screen with another — you set the split, it never changes on its own."
              />
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
            {poolScreens.map(s => {
              const checked = creative.assigned_screen_ids.includes(s.id);
              return (
                <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.textSub, fontFamily: F.sans, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => setField('assigned_screen_ids', checked
                      ? creative.assigned_screen_ids.filter(id => id !== s.id)
                      : [...creative.assigned_screen_ids, s.id])}
                  />
                  {s.name}
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/views/advertiser/createCampaign/CreativeCard.test.jsx`
Expected: PASS (all original tests + 7 new `CreativeCard QR colours` cases)

- [ ] **Step 5: Also run the wizard smoke test, which renders `CreativeCard` indirectly**

Run: `npx vitest run src/views/advertiser/createCampaign/StepCreative.smoke.test.jsx`
Expected: PASS — confirms the new imports/state don't break the existing smoke coverage

- [ ] **Step 6: Commit**

```bash
git add src/views/advertiser/createCampaign/CreativeCard.jsx src/views/advertiser/createCampaign/CreativeCard.test.jsx
git commit -m "feat: QR Dots/Background color fields with eyedropper + pick-from-creative in CreativeCard"
```

---

### Task 12: `CreateCampaign.jsx` — thread `qr_fg_color`/`qr_bg_color` into saved campaigns

**Files:**
- Modify: `src/views/advertiser/CreateCampaign.jsx:299-317` (multi-creative insert) and `:360-389` (`created` object)

The single-creative `bookings` insert (`:255-288`) needs no change — it already spreads `...preview`, and Task 5 made `buildPreviewCampaign` include `qr_fg_color`/`qr_bg_color` in that object.

- [ ] **Step 1: Add the fields to the `campaign_creatives` insert**

```jsx
// src/views/advertiser/CreateCampaign.jsx:299-317
      if (isMulti) {
        const { data: creativeRows, error: creativesErr } = await supabase
          .from('campaign_creatives')
          .insert(creatives.map((c, i) => ({
            targeting_id: campaignId,
            label: c.label || `Creative ${i + 1}`,
            media_url: c.media_url || null,
            media_type: c.media_type || null,
            media_width: c.media_width ?? null,
            media_height: c.media_height ?? null,
            destination_url: c.destination_url ? normalizeDestinationUrl(c.destination_url) : null,
            accent_color: c.accent_color || null,
            qr_x: c.qr_x ?? null,
            qr_y: c.qr_y ?? null,
            qr_size_pct: c.qr_size_pct ?? null,
            qr_fg_color: c.qr_fg_color ?? null,
            qr_bg_color: c.qr_bg_color ?? null,
            budget: form.budget_level === 'per_creative' ? (parseFloat(c.budget) || null) : null,
          })))
          .select('id');
        if (creativesErr) throw new Error(creativesErr.message);
```

- [ ] **Step 2: Add the fields to the post-submit `created` object**

```jsx
// src/views/advertiser/CreateCampaign.jsx:360-372 — add qr_fg_color/qr_bg_color
// next to the existing qr_x/qr_y/qr_size_pct, same pattern
      setSubmitting(false);
      setCreated({
        id: campaignId,
        campaign_id: parentCampaignId,
        advertiser: profile?.name || user.email?.split('@')[0] || 'Advertiser',
        advertiser_id: user.id,
        screen: firstScreen?.name || '',
        city: form.city || '',
        color: preview.accent_color || '#7c3aed',
        qr_x: preview.qr_x,
        qr_y: preview.qr_y,
        qr_size_pct: preview.qr_size_pct,
        qr_fg_color: preview.qr_fg_color,
        qr_bg_color: preview.qr_bg_color,
        destination: preview.destination_url?.trim() ? normalizeDestinationUrl(preview.destination_url) : null,
        category: preview.category || 'Food & Beverage',
        budget: parseFloat(form.budget) || 0,
        budget_mode: form.budget_mode,
        budget_level: isMulti ? form.budget_level : 'unified',
        currency: profile?.preferred_currency || 'cad',
        start: form.start_date,
        end: form.end_date,
        days: form.schedule_days,
        timeStart: form.time_start,
        timeEnd: form.time_end,
        duration: parseInt(form.duration, 10) || 15,
        slots: parseInt(form.slots, 10) || 10,
        // ... remainder of the object unchanged ...
```

- [ ] **Step 3: Run the full wizard test suite (no dedicated new test — this file's existing coverage is smoke-level; the unit-level guarantee that `preview.qr_fg_color`/`qr_bg_color` are correct already comes from Task 5's `buildPreviewCampaign.test.js`)**

Run: `npx vitest run src/views/advertiser/createCampaign/StepCreative.smoke.test.jsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/views/advertiser/CreateCampaign.jsx
git commit -m "feat: save qr_fg_color/qr_bg_color on campaign submit"
```

---

### Task 13: `display-feed` — forward QR color to `DisplayPlayer`

**Files:**
- Modify: `supabase/functions/display-feed/index.ts:65,77,93,99,104-121,133-172`

- [ ] **Step 1: Add the columns to both `.select(...)` calls**

```ts
// supabase/functions/display-feed/index.ts:77 — bookings select, add qr_fg_color, qr_bg_color
    const { data: bookings } = await supabase
      .from("bookings")
      .select("id, advertiser_name, headline, cta_text, accent_color, destination_url, category, media_url, media_type, qr_x, qr_y, qr_size_pct, qr_fg_color, qr_bg_color, slots, duration, schedule_days, time_start, time_end")
      .in("id", campaignIds)
      .in("status", ["scheduled", "active"])
      .eq("payment_status", "paid")
      .lte("start_date", today)
      .gte("end_date", today);
```

```ts
// supabase/functions/display-feed/index.ts:99 — campaign_creatives select, add qr_fg_color, qr_bg_color
      const { data: creatives } = await supabase
        .from("campaign_creatives")
        .select("id, targeting_id, status, media_url, media_type, headline, cta_text, destination_url, accent_color, qr_x, qr_y, qr_size_pct, qr_fg_color, qr_bg_color")
        .in("id", creativeIds)
        .eq("status", "active");
```

- [ ] **Step 2: Extend the `creativesByTargeting` map's type and push**

```ts
// supabase/functions/display-feed/index.ts:93 — widen the map's value type
    const creativesByTargeting = new Map<string, { creative_id: string; weight: number; media_url: string | null; media_type: string | null; headline: string | null; cta_text: string | null; destination_url: string | null; accent_color: string | null; qr_x: number | null; qr_y: number | null; qr_size_pct: number | null; qr_fg_color: string | null; qr_bg_color: string | null }[]>();
```

```ts
// supabase/functions/display-feed/index.ts:104-120 — add qr_fg_color/qr_bg_color to the pushed object
      for (const cr of creatives ?? []) {
        const list = creativesByTargeting.get(cr.targeting_id as string) ?? [];
        list.push({
          creative_id: cr.id as string,
          weight: weightById.get(cr.id as string) ?? 100,
          media_url: cr.media_url as string | null,
          media_type: cr.media_type as string | null,
          headline: cr.headline as string | null,
          cta_text: cr.cta_text as string | null,
          destination_url: cr.destination_url as string | null,
          accent_color: cr.accent_color as string | null,
          qr_x: cr.qr_x as number | null,
          qr_y: cr.qr_y as number | null,
          qr_size_pct: cr.qr_size_pct as number | null,
          qr_fg_color: cr.qr_fg_color as string | null,
          qr_bg_color: cr.qr_bg_color as string | null,
        });
        creativesByTargeting.set(cr.targeting_id as string, list);
      }
```

- [ ] **Step 3: Add the merge in the per-screen-assignment branch (the `assignments.length === 0` branch needs no change — it spreads `...b`, which already carries `qr_fg_color`/`qr_bg_color` once the select includes them)**

```ts
// supabase/functions/display-feed/index.ts:157-172
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

- [ ] **Step 4: Deploy/serve and verify manually**

Run: whatever this project's usual edge-function deploy or local-serve command is (e.g. `supabase functions deploy display-feed` or `supabase functions serve display-feed`, matching how the prior `display-feed` QR-position change in this repo's history was shipped)
Expected: no TypeScript errors; a manual request against `/display-feed?token=<test-screen-token>` for a screen with an active paid campaign returns `qr_fg_color`/`qr_bg_color` in the response body (`null` for any campaign/creative that never set them).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/display-feed/index.ts
git commit -m "feat: forward qr_fg_color/qr_bg_color through display-feed"
```

---

### Task 14: Full regression pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS, 0 failures — every test touched in Tasks 1-13 plus the full pre-existing suite (in particular `CreativePreview.test.jsx`, `CreativeCard.test.jsx`, `StepCreative.smoke.test.jsx`, `getCreativeRenderPlan.test.js`, `buildPreviewCampaign.test.js`, `creativeAssignment.test.js`)

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no new errors introduced by this plan's files (`src/lib/qrColor.js`, `src/lib/sampleMediaColor.js`, `src/components/primitives/ColorField.jsx`, and every modified file)

- [ ] **Step 3: Manual smoke check in the wizard (Creative step)**

Using the app's dev server: create/edit a campaign, upload a creative image, type a destination URL. Confirm:
- The QR appears in the wizard preview, sized normally (not floored — the preview is ~600px wide).
- "QR Code Colours" section shows Dots/Background swatches defaulting to the accent color and white.
- Typing a hex value or using the native swatch updates the QR in the preview live.
- Clicking "From creative" then clicking anywhere on the uploaded image updates the swatch to that pixel's color.
- Setting both Dots and Background to the same color shows the "Low contrast" warning.
- Open the same campaign's card in a place that renders `CreativePreview` at ~180px (e.g. the Creative Fit panel's mismatch card, if one applies, or `ReadabilityPanel`) and confirm the QR is now clearly visible instead of a near-invisible speck.

- [ ] **Step 4: Commit (only if Steps 1-3 required fixes; otherwise this task produces no diff)**

```bash
git add -A
git commit -m "fix: address regressions found in QR color/size full regression pass"
```

---

## Self-review notes (from the plan author, kept for the executor's context)

- **Spec coverage:** §1 (min-size) → Tasks 7, 9. §2 (data model) → Task 1. §3 (threading) → Tasks 4, 5, 6, 12, 13. §4 (color controls) → Tasks 10, 11. §5 (eyedropper, both mechanisms) → Tasks 3, 8, 10, 11. §6 (contrast guard) → Task 11 (reuses `contrastRatio` from `creativeReadability.js` per spec, no new implementation needed for the math itself — only Task 2's threshold constant is new).
- **Type consistency check:** `qrFgColor`/`qrBgColor` (camelCase, plan object) vs `qr_fg_color`/`qr_bg_color` (snake_case, DB/form/campaign object) is used consistently throughout — matches the existing `qrX`/`qr_x` convention already established by the QR-position feature, not a new inconsistency.
- **`ColorField`'s `value` prop is always a valid 6-digit hex by construction** — every caller in `CreativeCard.jsx` computes it as `creative.qr_fg_color || creative.accent_color || '#7c3aed'` (or the `qr_bg_color`/`accent_color` equivalents), never passing a raw possibly-empty DB value straight through. `ColorField` itself doesn't need to defend against an invalid initial `value`.
- **Did not add a dedicated `DisplayPlayer.jsx` test file** — matches this repo's existing precedent (confirmed in Task 9, and previously established by the QR-position plan's own Task 5) of that file having zero automated coverage; adding a test harness for one file as an incidental side effect of this plan would be scope creep beyond the spec.
