# Simplified Creative Authoring + Movable QR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require advertisers to upload their own ad creative (image/video) instead of authoring a generated headline/CTA text-card, and let them drag-and-resize the QR code's position/size on that upload, persisted per creative and honored identically in the wizard preview and on the real screen.

**Architecture:** `getCreativeRenderPlan.js` (already the shared source of truth between `CreativePreview.jsx` and `DisplayPlayer.jsx`) gains `showQr`/`qrX`/`qrY`/`qrSizePct`. A new pure module `creativeQrPosition.js` holds the clamp math and corner presets, unit-tested without any DOM. `CreativePreview.jsx` gets an optional `editableQr` mode (pointer-drag + resize handle) used only by the wizard's `CreativeCard.jsx`; every other consumer (`ApprovalQueue`, `CampaignReport`, `CampaignDetail`, `ReadabilityPanel`) renders the same component read-only. Two new nullable numeric columns (`qr_x`, `qr_y`, `qr_size_pct`) are added to both `bookings` and `campaign_creatives` so existing rows keep rendering at today's hardcoded top-right position with zero backfill. `headline`/`cta_text`/`creative_template`/`secondary_color`/`creative_font` are **not** dropped from the database or from `getCreativeRenderPlan`'s fallback chain — legacy campaigns that already have them keep rendering correctly — they are only removed from the *authoring* path (`CreativeCard.jsx`, `makeBlankCreative`, `buildPreviewCampaign`, the wizard's submit payload), since new creatives can no longer set them.

**Tech Stack:** React (JSX, no build-time CSS), Supabase Postgres migrations, Vitest + Testing Library, `react-qr-code`.

---

## Known limitations (accepted, not fixed by this plan)

- `DisplayPlayer.jsx`'s real QR box has a "Scan to learn more" caption below the code, so its actual pixel height is slightly taller than `qrSizePct * frameWidth`. The clamp math (`clampQrCenter`) treats the box as a square, so a QR dragged to an extreme edge in the wizard preview could sit a few pixels closer to the real screen's edge than in the preview. Not worth solving with a second clamp formula for a cosmetic few-pixel difference — advertisers dragging to a screen edge already see the preview clamp stop them well before it matters.
- Advertiser-facing `CampaignDetail.jsx` "Edit Creative" does not gain QR-position editing in this plan — only the wizard (`CreativeCard.jsx`) is interactive. Repositioning after submit is a reasonable follow-up if requested.

---

### Task 1: Pure QR-position math (`creativeQrPosition.js`)

**Files:**
- Create: `src/lib/creativeQrPosition.js`
- Test: `src/lib/creativeQrPosition.test.js`

- [ ] **Step 1: Write the module**

```js
// src/lib/creativeQrPosition.js
// Pure math for the draggable/resizable QR overlay -- no DOM, no network,
// same shape as creativeFit.js/creativeReadability.js. Positions are the QR
// box's CENTER as a percent of the creative frame's width (x) and height
// (y). Size is the box's width as a fraction of the frame's width (the box
// itself is square in pixels) -- 0.12 matches DisplayPlayer's pre-existing
// hardcoded `window.innerWidth * 0.12` sizing, so an unset qr_size_pct keeps
// rendering at today's size with no backfill.

export const QR_DEFAULT = { x: 90, y: 14, sizePct: 0.12 };
export const QR_SIZE_PCT_MIN = 0.08;
export const QR_SIZE_PCT_MAX = 0.3;

export const QR_CORNER_PRESETS = {
  top_left: { x: 8, y: 8 },
  top_right: { x: 92, y: 8 },
  bottom_left: { x: 8, y: 92 },
  bottom_right: { x: 92, y: 92 },
};

// Keeps the QR box's center far enough from every edge that the box itself
// never overflows the frame. frameAspect is the frame's width/height (e.g.
// 16/9) -- needed because the box is square in pixels but x/y are percents
// of two different axis lengths, so the box's height-as-percent-of-frame-
// height is not the same number as its width-as-percent-of-frame-width.
export function clampQrCenter(x, y, sizePct, frameAspect) {
  const halfWidthPct = (sizePct * 100) / 2;
  const halfHeightPct = (sizePct * 100 * frameAspect) / 2;
  return {
    x: Math.min(100 - halfWidthPct, Math.max(halfWidthPct, x)),
    y: Math.min(100 - halfHeightPct, Math.max(halfHeightPct, y)),
  };
}

export function clampQrSizePct(sizePct) {
  return Math.min(QR_SIZE_PCT_MAX, Math.max(QR_SIZE_PCT_MIN, sizePct));
}
```

- [ ] **Step 2: Write the tests**

```js
// src/lib/creativeQrPosition.test.js
import { describe, it, expect } from 'vitest';
import { clampQrCenter, clampQrSizePct, QR_SIZE_PCT_MIN, QR_SIZE_PCT_MAX, QR_CORNER_PRESETS, QR_DEFAULT } from './creativeQrPosition.js';

describe('clampQrCenter', () => {
  it('leaves a center that already fits untouched', () => {
    expect(clampQrCenter(50, 50, 0.12, 16 / 9)).toEqual({ x: 50, y: 50 });
  });

  it('pulls the x coordinate in from the left edge', () => {
    const result = clampQrCenter(0, 50, 0.2, 16 / 9);
    expect(result.x).toBe(10); // half of 20% width
  });

  it('pulls the x coordinate in from the right edge', () => {
    const result = clampQrCenter(100, 50, 0.2, 16 / 9);
    expect(result.x).toBe(90);
  });

  it('pulls the y coordinate in from the top edge, scaled by frame aspect', () => {
    const result = clampQrCenter(50, 0, 0.2, 16 / 9);
    // halfHeightPct = 0.2 * 100 * (16/9) / 2 ≈ 17.78
    expect(result.y).toBeCloseTo(17.78, 1);
  });

  it('pulls the y coordinate in from the bottom edge', () => {
    const result = clampQrCenter(50, 100, 0.2, 16 / 9);
    expect(result.y).toBeCloseTo(82.22, 1);
  });
});

describe('clampQrSizePct', () => {
  it('leaves an in-range size untouched', () => {
    expect(clampQrSizePct(0.15)).toBe(0.15);
  });

  it('floors below the minimum', () => {
    expect(clampQrSizePct(0.01)).toBe(QR_SIZE_PCT_MIN);
  });

  it('ceils above the maximum', () => {
    expect(clampQrSizePct(0.9)).toBe(QR_SIZE_PCT_MAX);
  });
});

describe('QR_CORNER_PRESETS and QR_DEFAULT', () => {
  it('exposes all four corners', () => {
    expect(Object.keys(QR_CORNER_PRESETS)).toEqual(['top_left', 'top_right', 'bottom_left', 'bottom_right']);
  });

  it('matches DisplayPlayer\'s pre-existing top-right default size', () => {
    expect(QR_DEFAULT.sizePct).toBe(0.12);
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `npx vitest run src/lib/creativeQrPosition.test.js`
Expected: PASS (11 tests)

- [ ] **Step 4: Commit**

```bash
git add src/lib/creativeQrPosition.js src/lib/creativeQrPosition.test.js
git commit -m "feat: add pure QR-position clamp math for a draggable/resizable QR overlay"
```

---

### Task 2: Database columns for QR position

**Files:**
- Create: `supabase/migrations/20260804000001_creative_qr_position_columns.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260804000001_creative_qr_position_columns.sql
-- QR code position/size, advertiser-controlled per creative. Nullable so an
-- unset value falls back to getCreativeRenderPlan's hardcoded top-right
-- default (qrX:90, qrY:14, qrSizePct:0.12, see src/lib/creativeQrPosition.js)
-- -- every existing row keeps rendering exactly as it does today, no
-- backfill needed.
--
-- qr_x/qr_y are the QR box's CENTER, as a percent of the creative frame's
-- width/height. qr_size_pct is the box's width as a fraction of the frame's
-- width (the box is square in pixels). Range matches
-- src/lib/creativeQrPosition.js's QR_SIZE_PCT_MIN/MAX so the database can
-- never hold a QR too small to scan or large enough to swallow the ad.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS qr_x numeric,
  ADD COLUMN IF NOT EXISTS qr_y numeric,
  ADD COLUMN IF NOT EXISTS qr_size_pct numeric;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_qr_x_range CHECK (qr_x IS NULL OR (qr_x >= 0 AND qr_x <= 100)),
  ADD CONSTRAINT bookings_qr_y_range CHECK (qr_y IS NULL OR (qr_y >= 0 AND qr_y <= 100)),
  ADD CONSTRAINT bookings_qr_size_pct_range CHECK (qr_size_pct IS NULL OR (qr_size_pct >= 0.08 AND qr_size_pct <= 0.3));

ALTER TABLE public.campaign_creatives
  ADD COLUMN IF NOT EXISTS qr_x numeric,
  ADD COLUMN IF NOT EXISTS qr_y numeric,
  ADD COLUMN IF NOT EXISTS qr_size_pct numeric;

ALTER TABLE public.campaign_creatives
  ADD CONSTRAINT campaign_creatives_qr_x_range CHECK (qr_x IS NULL OR (qr_x >= 0 AND qr_x <= 100)),
  ADD CONSTRAINT campaign_creatives_qr_y_range CHECK (qr_y IS NULL OR (qr_y >= 0 AND qr_y <= 100)),
  ADD CONSTRAINT campaign_creatives_qr_size_pct_range CHECK (qr_size_pct IS NULL OR (qr_size_pct >= 0.08 AND qr_size_pct <= 0.3));
```

- [ ] **Step 2: Apply it to the local/dev Supabase project**

Run: `supabase db push` (or the project's usual migration-apply command)
Expected: migration applies with no errors; `qr_x`, `qr_y`, `qr_size_pct` exist on both tables (verify with `\d bookings` / `\d campaign_creatives` in `psql`, or the Supabase dashboard table editor).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260804000001_creative_qr_position_columns.sql
git commit -m "feat: add qr_x/qr_y/qr_size_pct columns to bookings and campaign_creatives"
```

---

### Task 3: Teach `getCreativeRenderPlan` about QR position and visibility

**Files:**
- Modify: `src/lib/getCreativeRenderPlan.js`
- Test: `src/lib/getCreativeRenderPlan.test.js` (append only — do not remove existing tests)

- [ ] **Step 1: Update the function**

```js
// src/lib/getCreativeRenderPlan.js
/**
 * The single source of truth for "what should this campaign's creative show,
 * and what does it say" -- shared between CreativePreview.jsx (wizard/
 * operator preview) and DisplayPlayer.jsx (actual physical screen playback),
 * so those two can no longer silently disagree about whether text overlays
 * an uploaded creative, or where/how big the QR code renders.
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
 * to before this feature existed.
 */
export function getCreativeRenderPlan(campaign = {}) {
  campaign = campaign || {};
  const mediaUrl = campaign.media_url || null;
  const rawDestination = campaign.destination_url || campaign.destination || '';
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
    destination: rawDestination || 'https://adgrid.io',
    // A placeholder QR pointing at adgrid.io on a campaign with no real
    // destination_url just wastes screen real estate on a dead link.
    showQr: Boolean(rawDestination),
    qrX: typeof campaign.qr_x === 'number' ? campaign.qr_x : 90,
    qrY: typeof campaign.qr_y === 'number' ? campaign.qr_y : 14,
    qrSizePct: typeof campaign.qr_size_pct === 'number' ? campaign.qr_size_pct : 0.12,
  };
}
```

- [ ] **Step 2: Append new tests**

```js
// append to src/lib/getCreativeRenderPlan.test.js, inside the existing file
describe('getCreativeRenderPlan QR', () => {
  it('shows the QR when a destination is set', () => {
    expect(getCreativeRenderPlan({ destination_url: 'https://a.com' }).showQr).toBe(true);
    expect(getCreativeRenderPlan({ destination: 'https://a.com' }).showQr).toBe(true);
  });

  it('hides the QR when no destination is set at all', () => {
    expect(getCreativeRenderPlan({}).showQr).toBe(false);
    expect(getCreativeRenderPlan({ destination_url: '' }).showQr).toBe(false);
  });

  it('defaults qr position and size when unset', () => {
    const plan = getCreativeRenderPlan({});
    expect(plan.qrX).toBe(90);
    expect(plan.qrY).toBe(14);
    expect(plan.qrSizePct).toBe(0.12);
  });

  it('uses a stored qr position and size when present, including zero', () => {
    const plan = getCreativeRenderPlan({ qr_x: 0, qr_y: 30, qr_size_pct: 0.2 });
    expect(plan.qrX).toBe(0);
    expect(plan.qrY).toBe(30);
    expect(plan.qrSizePct).toBe(0.2);
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `npx vitest run src/lib/getCreativeRenderPlan.test.js`
Expected: PASS (all original tests + 4 new ones)

- [ ] **Step 4: Commit**

```bash
git add src/lib/getCreativeRenderPlan.js src/lib/getCreativeRenderPlan.test.js
git commit -m "feat: add QR position/visibility to getCreativeRenderPlan"
```

---

### Task 4: `CreativePreview.jsx` — shared render plan, draggable QR, text-overlay bugfix

This also fixes a latent bug: `CreativePreview.jsx` never adopted the `showTextOverlay` gating that `DisplayPlayer.jsx` already has (commit `70b315d`), so today the wizard preview still draws the headline/CTA/category `Body` on top of an uploaded creative even though the real screen correctly suppresses it. Consuming `getCreativeRenderPlan` here fixes that divergence for any legacy row that still has both media and old headline/cta text.

**Files:**
- Modify: `src/components/shared/CreativePreview.jsx`
- Test: `src/components/shared/CreativePreview.test.jsx`

- [ ] **Step 1: Rewrite the file**

```jsx
// src/components/shared/CreativePreview.jsx
import { useRef } from 'react';
import QRCode from 'react-qr-code';
import { F } from '../../design/tokens.js';
import { getCreativeRenderPlan } from '../../lib/getCreativeRenderPlan.js';
import { clampQrCenter, clampQrSizePct } from '../../lib/creativeQrPosition.js';

const FONT_STACKS = { sans: F.sans, serif: 'Georgia, serif', mono: F.mono };
const fontFor = (creativeFont) => FONT_STACKS[creativeFont] || FONT_STACKS.serif;

function BottomBarBody({ headline, cta, bg, category, headlineFont }) {
  return (
    <>
      {category && (
        <div style={{
          position: 'absolute', bottom: 44, left: 14,
          fontSize: 7, letterSpacing: '2px', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.4)', fontFamily: F.sans,
        }}>{category}</div>
      )}
      <div data-headline style={{
        position: 'absolute', bottom: 22, left: 14, right: 60,
        fontSize: 13, fontWeight: 800, color: '#fff',
        lineHeight: 1.1, fontFamily: headlineFont,
        textShadow: '0 2px 8px rgba(0,0,0,0.5)',
        overflow: 'hidden', display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      }}>{headline}</div>
      {cta && (
        <div style={{
          position: 'absolute', bottom: 7, left: 14,
          padding: '2px 8px', border: `1.5px solid ${bg}`,
          color: bg, fontSize: 7, fontWeight: 600,
          borderRadius: 3, fontFamily: F.sans, letterSpacing: '0.5px',
        }}>{cta}</div>
      )}
    </>
  );
}

function FullBleedBody({ headline, cta, bg, category, headlineFont }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 20px', textAlign: 'center',
    }}>
      {category && (
        <div style={{
          fontSize: 7, letterSpacing: '2px', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.4)', fontFamily: F.sans,
        }}>{category}</div>
      )}
      <div data-headline style={{
        fontSize: 14, fontWeight: 800, color: '#fff', lineHeight: 1.15,
        fontFamily: headlineFont, textShadow: '0 2px 8px rgba(0,0,0,0.5)',
        overflow: 'hidden', display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      }}>{headline}</div>
      {cta && (
        <div style={{
          padding: '4px 14px', borderRadius: 20, background: bg,
          color: '#fff', fontSize: 8, fontWeight: 700, fontFamily: F.sans, letterSpacing: '0.5px',
        }}>{cta}</div>
      )}
    </div>
  );
}

function SplitPanelBody({ headline, cta, bg, secondaryBg, category, headlineFont }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
      <div data-panel style={{
        width: '40%', flexShrink: 0, background: secondaryBg || bg,
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        gap: 6, padding: '0 12px', boxSizing: 'border-box',
      }}>
        {category && (
          <div style={{
            fontSize: 7, letterSpacing: '2px', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.4)', fontFamily: F.sans,
          }}>{category}</div>
        )}
        <div data-headline style={{
          fontSize: 12, fontWeight: 800, color: '#fff', lineHeight: 1.15,
          fontFamily: headlineFont, overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
        }}>{headline}</div>
        {cta && (
          <div style={{
            display: 'inline-block', padding: '2px 8px', border: '1.5px solid #fff',
            color: '#fff', fontSize: 7, fontWeight: 600, borderRadius: 3,
            fontFamily: F.sans, letterSpacing: '0.5px', alignSelf: 'flex-start',
          }}>{cta}</div>
        )}
      </div>
      <div style={{ flex: 1 }} />
    </div>
  );
}

const BODIES = { full_bleed: FullBleedBody, split_panel: SplitPanelBody, bottom_bar: BottomBarBody };

function QrOverlay({ url, x, y, sizePct, frameAspect, editable, onChange }) {
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
      const distPx = Math.max(Math.hypot(e.clientX - centerXPx, e.clientY - centerYPx), 1);
      const nextSizePct = clampQrSizePct((distPx * 2) / rect.width);
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
          width: `${sizePct * 100}%`, aspectRatio: '1', background: '#fff', borderRadius: '10%',
          padding: '8%', boxSizing: 'border-box', pointerEvents: editable ? 'auto' : 'none',
          cursor: editable ? 'grab' : 'default',
          boxShadow: editable ? '0 0 0 2px rgba(124,58,237,0.6)' : 'none',
        }}
      >
        <QRCode value={url} size={256} style={{ width: '100%', height: '100%' }} level="M" />
        {editable && (
          <div
            data-qr-resize-handle
            onPointerDown={startDrag('resize')}
            style={{
              position: 'absolute', right: -6, bottom: -6, width: 14, height: 14,
              borderRadius: '50%', background: '#7c3aed', border: '2px solid #fff',
              cursor: 'nwse-resize',
            }}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Props: campaign — see getCreativeRenderPlan.js for the accepted field
 * shapes/fallback chains. editableQr/onQrChange enable wizard-only
 * drag-to-reposition and drag-to-resize of the QR code; every other
 * (read-only) consumer omits them.
 */
export function CreativePreview({ campaign, aspectRatio = '16/9', blurPx = 0, editableQr = false, onQrChange }) {
  const plan = getCreativeRenderPlan(campaign);
  const { mediaUrl, isVideo, showTextOverlay, template, headline, cta, bg, secondaryBg, category, destination, showQr, qrX, qrY, qrSizePct } = plan;
  const Body = BODIES[template] || BottomBarBody;
  const [wRatio, hRatio] = String(aspectRatio).split('/').map(Number);
  const frameAspect = wRatio && hRatio ? wRatio / hRatio : 16 / 9;

  // split_panel confines media to its right 60% (the left 40% is an opaque
  // brand-color block); the other two templates fill the whole frame.
  const mediaStyle = template === 'split_panel'
    ? { position: 'absolute', top: 0, bottom: 0, left: '40%', right: 0, objectFit: 'cover' }
    : { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' };

  return (
    <div data-template={template} style={{
      position: 'relative', width: '100%', aspectRatio,
      filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined,
      background: `linear-gradient(160deg, #050a10 0%, #0d1520 60%, ${bg}22 100%)`,
      borderRadius: 8, overflow: 'hidden', flexShrink: 0,
    }}>
      {mediaUrl && (isVideo ? (
        <video src={mediaUrl} muted loop autoPlay playsInline style={mediaStyle} />
      ) : (
        <img src={mediaUrl} alt="" style={mediaStyle} />
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
        />
      )}
      {showTextOverlay && (
        <Body headline={headline} cta={cta} bg={bg} secondaryBg={secondaryBg} category={category} headlineFont={fontFor(campaign?.creative_font)} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Append new tests (keep every existing test in this file — they cover legacy-row rendering and must keep passing)**

```jsx
// append to src/components/shared/CreativePreview.test.jsx
describe('CreativePreview text-overlay/media divergence fix', () => {
  it('suppresses the headline/CTA overlay once media is uploaded, even if headline/cta_text are still set', () => {
    const { container } = render(<CreativePreview campaign={{ headline: 'Cold Brew', cta_text: 'Order now', media_url: 'https://x/y.jpg', media_type: 'image' }} />);
    expect(container.querySelector('[data-headline]')).toBeNull();
  });

  it('still shows the headline/CTA overlay when there is no uploaded media', () => {
    const { container } = render(<CreativePreview campaign={{ headline: 'Cold Brew', cta_text: 'Order now' }} />);
    expect(container.querySelector('[data-headline]')).not.toBeNull();
  });
});

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
    expect(qr.style.width).toBe('12%');
  });

  it('positions the QR at a stored qr_x/qr_y/qr_size_pct', () => {
    const { container } = render(<CreativePreview campaign={{ destination_url: 'https://example.com', qr_x: 20, qr_y: 30, qr_size_pct: 0.2 }} />);
    const qr = container.querySelector('[data-qr-overlay]');
    expect(qr.style.left).toBe('20%');
    expect(qr.style.top).toBe('30%');
    expect(qr.style.width).toBe('20%');
  });

  it('only renders the resize handle when editableQr is true', () => {
    const { container: readOnly } = render(<CreativePreview campaign={{ destination_url: 'https://example.com' }} />);
    expect(readOnly.querySelector('[data-qr-resize-handle]')).toBeNull();

    const { container: editable } = render(<CreativePreview campaign={{ destination_url: 'https://example.com' }} editableQr onQrChange={() => {}} />);
    expect(editable.querySelector('[data-qr-resize-handle]')).not.toBeNull();
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `npx vitest run src/components/shared/CreativePreview.test.jsx`
Expected: PASS (all original template/font/blur tests + 6 new ones)

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/CreativePreview.jsx src/components/shared/CreativePreview.test.jsx
git commit -m "feat: draggable/resizable QR overlay in CreativePreview, fix text-overlay/media divergence"
```

---

### Task 5: `DisplayPlayer.jsx` — real-screen QR follows the stored position

**Files:**
- Modify: `src/views/display/DisplayPlayer.jsx:68-79`

- [ ] **Step 1: Replace the hardcoded QR block**

Replace this (current lines 68-79):

```jsx
      {/* QR code — top right */}
      <div style={{
        position: 'absolute', top: 'clamp(20px, 3vw, 48px)', right: 'clamp(20px, 3vw, 48px)',
        background: '#fff', borderRadius: 12, padding: 'clamp(8px, 1.2vw, 16px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        <QRCode value={qrUrl} size={Math.max(64, Math.floor(window.innerWidth * 0.12))} level="M" />
        <div style={{
          fontSize: 'clamp(8px, 0.8vw, 12px)', color: '#555', textAlign: 'center',
          marginTop: 6, fontFamily: "'Inter', sans-serif", fontWeight: 500,
        }}>Scan to learn more</div>
      </div>
```

with:

```jsx
      {/* QR code — advertiser-positioned via qr_x/qr_y/qr_size_pct, hidden
          entirely when the campaign has no real destination_url */}
      {plan.showQr && (
        <div style={{
          position: 'absolute',
          left: `${plan.qrX}%`, top: `${plan.qrY}%`, transform: 'translate(-50%, -50%)',
          width: `${plan.qrSizePct * 100}%`,
          background: '#fff', borderRadius: 12, padding: 'clamp(8px, 1.2vw, 16px)',
          boxSizing: 'border-box', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          <QRCode value={qrUrl} size={256} style={{ width: '100%', height: 'auto', display: 'block' }} level="M" />
          <div style={{
            fontSize: 'clamp(8px, 0.8vw, 12px)', color: '#555', textAlign: 'center',
            marginTop: 6, fontFamily: "'Inter', sans-serif", fontWeight: 500,
          }}>Scan to learn more</div>
        </div>
      )}
```

Also destructure `showQr, qrX, qrY, qrSizePct` alongside the existing `plan` fields at the top of `CreativeSlide` (line 24 currently reads `const { mediaUrl, isVideo, showTextOverlay, bg, headline, cta, category } = plan;`) — leave that destructure as-is and just reference `plan.showQr`/`plan.qrX`/etc. directly in the JSX above, since `plan` itself is already in scope.

- [ ] **Step 2: Manual verification (no automated test harness exists for DisplayPlayer today — confirm no existing test file covers it before skipping)**

Run: `find src/views/display -iname "*.test.*"`
Expected: no matches (confirms there's genuinely no existing DisplayPlayer test suite to update)

Then start the dev server and load a screen token with an active, paid campaign that has `destination_url` set; confirm the QR renders top-right by default. If a test screen token isn't available, this step is a visual sanity check only — do not block the commit on it if no screen/campaign fixture exists in this environment.

- [ ] **Step 3: Commit**

```bash
git add src/views/display/DisplayPlayer.jsx
git commit -m "feat: DisplayPlayer honors the campaign's stored QR position/size"
```

---

### Task 6: `buildPreviewCampaign.js` — drop the generated-card fields, add QR passthrough

**Files:**
- Modify: `src/lib/buildPreviewCampaign.js`
- Test: `src/lib/buildPreviewCampaign.test.js` (full rewrite — the old assertions test fields that no longer exist)

- [ ] **Step 1: Rewrite the module**

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
  };
}
```

- [ ] **Step 2: Rewrite the tests**

```js
// src/lib/buildPreviewCampaign.test.js
import { describe, it, expect } from 'vitest';
import { buildPreviewCampaign } from './buildPreviewCampaign.js';

describe('buildPreviewCampaign', () => {
  it('carries the creative fields through from form', () => {
    const form = {
      accent_color: '#7c3aed', destination_url: 'https://example.com', category: 'Food & Beverage',
      media_url: 'https://x/y.jpg', media_type: 'image', qr_x: 20, qr_y: 30, qr_size_pct: 0.18,
    };
    expect(buildPreviewCampaign(form)).toEqual({
      accent_color: '#7c3aed', destination_url: 'https://example.com', category: 'Food & Beverage',
      media_url: 'https://x/y.jpg', media_type: 'image', qr_x: 20, qr_y: 30, qr_size_pct: 0.18,
    });
  });

  it('defaults qr_x/qr_y/qr_size_pct to null when unset on the form', () => {
    const form = { accent_color: '', destination_url: '', category: '', media_url: '', media_type: '' };
    const result = buildPreviewCampaign(form);
    expect(result.qr_x).toBeNull();
    expect(result.qr_y).toBeNull();
    expect(result.qr_size_pct).toBeNull();
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `npx vitest run src/lib/buildPreviewCampaign.test.js`
Expected: PASS (2 tests)

- [ ] **Step 4: Commit**

```bash
git add src/lib/buildPreviewCampaign.js src/lib/buildPreviewCampaign.test.js
git commit -m "refactor: drop headline/cta/template fields from buildPreviewCampaign, add QR passthrough"
```

---

### Task 7: `makeBlankCreative` — drop the generated-card fields, add QR defaults

**Files:**
- Modify: `src/lib/creativeAssignment.js:10-21`
- Modify: `src/lib/creativeAssignment.test.js:6-26` (the `makeBlankCreative` describe block only — leave every other describe block untouched)

- [ ] **Step 1: Update `makeBlankCreative`**

```js
// src/lib/creativeAssignment.js — replace makeBlankCreative only
export function makeBlankCreative(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    label: '',
    destination_url: '', accent_color: '#7c3aed', category: 'Food & Beverage',
    media_url: '', media_type: '', media_width: null, media_height: null,
    qr_x: null, qr_y: null, qr_size_pct: null,
    assigned_screen_ids: [],
    weight: 100,
    ...overrides,
  };
}
```

- [ ] **Step 2: Update the test**

```js
// src/lib/creativeAssignment.test.js — replace the makeBlankCreative describe block only
describe('makeBlankCreative', () => {
  it('returns a complete creative shape with sane defaults', () => {
    const c = makeBlankCreative();
    expect(c.id).toBeTruthy();
    expect(c.assigned_screen_ids).toEqual([]);
    expect(c.weight).toBe(100);
    expect(c.accent_color).toBe('#7c3aed');
    expect(c.qr_x).toBeNull();
    expect(c.qr_y).toBeNull();
    expect(c.qr_size_pct).toBeNull();
  });

  it('applies overrides on top of the defaults', () => {
    const c = makeBlankCreative({ accent_color: '#00ff00', label: 'Hi' });
    expect(c.accent_color).toBe('#00ff00');
    expect(c.label).toBe('Hi');
    expect(c.weight).toBe(100);
  });

  it('generates a distinct id per call', () => {
    expect(makeBlankCreative().id).not.toBe(makeBlankCreative().id);
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `npx vitest run src/lib/creativeAssignment.test.js`
Expected: PASS (all describe blocks, including the unmodified `unassignedScreenIds`/`splitScreenIdsByOrientation`/`reconcileAssignments` ones)

- [ ] **Step 4: Commit**

```bash
git add src/lib/creativeAssignment.js src/lib/creativeAssignment.test.js
git commit -m "refactor: drop generated-card fields from makeBlankCreative, add QR defaults"
```

---

### Task 8: `CreativeCard.jsx` — require media, drop headline/CTA/template authoring, wire the editable QR

**Files:**
- Modify: `src/views/advertiser/createCampaign/CreativeCard.jsx` (full rewrite)

- [ ] **Step 1: Rewrite the file**

```jsx
// src/views/advertiser/createCampaign/CreativeCard.jsx
import { C, F } from '../../../design/tokens.js';
import { Inp } from '../../../components/primitives/Inp.jsx';
import { SelInput } from '../../../components/primitives/SelInput.jsx';
import { CreativePreview } from '../../../components/shared/CreativePreview.jsx';
import { CreativeFitPanel } from '../../../components/shared/CreativeFitPanel.jsx';
import { checkCreativeFit } from '../../../lib/creativeFit.js';
import { isValidDestinationUrl } from '../../../lib/destinationUrl.js';
import { CATEGORIES } from '../../../lib/data.js';
import { QR_CORNER_PRESETS, clampQrCenter } from '../../../lib/creativeQrPosition.js';
import { MediaUpload } from './MediaUpload.jsx';

const FRAME_ASPECT = 16 / 9;

// One creative's authoring fields + preview + screen assignment, used both
// for the single default creative (no assignment UI shown — it implicitly
// covers every pool screen) and for each of 2+ creatives (assignment UI shown).
//
// Advertisers upload their own fully-designed creative — AdGrid no longer
// generates a text-card from a headline/CTA/template, since that duplicated
// (and could visually clash with) whatever the advertiser already designed
// into their upload. The only remaining authored fields are the destination
// (for the QR), category (for targeting), and an accent colour used only for
// the thin brand strip along the frame's bottom edge.
export function CreativeCard({
  creative, onChange, onRemove, poolScreens, allCreatives, showAssignment, onSplitByType,
}) {
  const setField = (k, v) => onChange({ ...creative, [k]: v });
  // MediaUpload calls setForm(s => ({ ...s, media_url, media_type, media_width, media_height })) --
  // it needs the *whole* creative as "previous state" so destination_url/accent_color/etc
  // survive the update, not just the four media fields.
  const setMediaForm = (updater) => onChange(updater(creative));

  const hasDestination = isValidDestinationUrl(creative.destination_url);

  const setQr = ({ x, y, sizePct }) => onChange({ ...creative, qr_x: x, qr_y: y, qr_size_pct: sizePct });
  const snapQrTo = (corner) => {
    const preset = QR_CORNER_PRESETS[corner];
    const sizePct = creative.qr_size_pct ?? 0.12;
    const clamped = clampQrCenter(preset.x, preset.y, sizePct, FRAME_ASPECT);
    setQr({ x: clamped.x, y: clamped.y, sizePct });
  };

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
          <Inp label="Destination URL" placeholder="https://example.com" type="url" value={creative.destination_url} onChange={e => setField('destination_url', e.target.value)} />
          {creative.destination_url.trim() !== '' && !isValidDestinationUrl(creative.destination_url) && (
            <div style={{ fontSize: 11, color: C.red, fontFamily: F.sans, marginTop: -8 }}>
              Enter a full web address, like https://example.com — this is where your QR code sends people.
            </div>
          )}
          <SelInput label="Category" value={creative.category} onChange={e => setField('category', e.target.value)}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </SelInput>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 6 }}>Accent Colour</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="color" value={creative.accent_color} onChange={e => setField('accent_color', e.target.value)}
                style={{ width: 40, height: 36, border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', padding: 2 }} />
              <span style={{ fontSize: 12, color: C.textSub, fontFamily: F.mono }}>{creative.accent_color}</span>
            </div>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.textMid, fontFamily: F.sans, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Preview</div>
          <CreativePreview campaign={creative} editableQr={hasDestination} onQrChange={setQr} />
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

Note the dropped props: `duration` and `profile` are no longer accepted (their only use was `checkReadability`'s `durationSeconds` and `buildPreviewCampaign`'s `creative_font`, both removed). Task 10 updates `StepCreative.jsx`'s call site to match.

- [ ] **Step 2: Run the existing CreativeCard test (should still pass unchanged — it only covers screen-assignment UI, not the removed fields)**

Run: `npx vitest run src/views/advertiser/createCampaign/CreativeCard.test.jsx`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/views/advertiser/createCampaign/CreativeCard.jsx
git commit -m "feat: require media upload, drop headline/CTA/template authoring, add draggable QR to CreativeCard"
```

---

### Task 9: Delete the now-dead `TemplatePicker.jsx` and `MessageQuickFill.jsx`

**Files:**
- Delete: `src/views/advertiser/createCampaign/TemplatePicker.jsx`
- Delete: `src/views/advertiser/createCampaign/MessageQuickFill.jsx`

- [ ] **Step 1: Confirm nothing else imports them**

Run: `grep -rn "TemplatePicker\|MessageQuickFill" src/ --include="*.jsx" --include="*.js"`
Expected: only the two files themselves and their (now-removed) import lines in `CreativeCard.jsx` from Task 8 — no other matches. If a dedicated `TemplatePicker.test.jsx` or `MessageQuickFill.test.jsx` turns up, delete it in this same step.

- [ ] **Step 2: Delete the files**

```bash
git rm src/views/advertiser/createCampaign/TemplatePicker.jsx src/views/advertiser/createCampaign/MessageQuickFill.jsx
```

- [ ] **Step 3: Run the full test suite to confirm nothing else broke**

Run: `npx vitest run`
Expected: no import-resolution failures related to the deleted files

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: delete TemplatePicker and MessageQuickFill, unused after dropping generated-card authoring"
```

---

### Task 10: `StepCreative.jsx` + `CreateCampaign.jsx` — drop dead prop threading, require media before advancing, update submit payloads

**Files:**
- Modify: `src/views/advertiser/createCampaign/StepCreative.jsx:144-155`
- Modify: `src/views/advertiser/CreateCampaign.jsx` (several locations, listed below)

- [ ] **Step 1: Drop the now-unused `duration`/`profile` props from the `<CreativeCard>` call**

In `StepCreative.jsx`, replace:

```jsx
        {creatives.map((c) => (
          <CreativeCard
            key={c.id}
            creative={c}
            onChange={(next) => updateCreative(c.id, next)}
            onRemove={isMulti ? () => removeCreative(c.id) : undefined}
            poolScreens={selectedScreens}
            allCreatives={creatives}
            showAssignment={isMulti}
            duration={form.duration}
            onSplitByType={() => splitByType(c.id)}
            profile={profile}
          />
        ))}
```

with:

```jsx
        {creatives.map((c) => (
          <CreativeCard
            key={c.id}
            creative={c}
            onChange={(next) => updateCreative(c.id, next)}
            onRemove={isMulti ? () => removeCreative(c.id) : undefined}
            poolScreens={selectedScreens}
            allCreatives={creatives}
            showAssignment={isMulti}
            onSplitByType={() => splitByType(c.id)}
          />
        ))}
```

Since `StepCreative`'s own `profile` param is now unused, also change its signature from:

```jsx
export function StepCreative({ form, setForm, matchedScreens, profile }) {
```

to:

```jsx
export function StepCreative({ form, setForm, matchedScreens }) {
```

- [ ] **Step 2: Drop the now-unused `profile` prop at the call site in `CreateCampaign.jsx:480`**

Replace:

```jsx
      {step === 1 && <StepCreative form={form} setForm={setForm} matchedScreens={matchedScreens} profile={profile} />}
```

with:

```jsx
      {step === 1 && <StepCreative form={form} setForm={setForm} matchedScreens={matchedScreens} />}
```

- [ ] **Step 3: Simplify the brand-kit seed (drop `secondary_color`, which no longer exists on the creative shape)**

In `CreateCampaign.jsx:169-178`, replace:

```jsx
    setForm(s => {
      if (s.creatives.length > 0) return s;
      return {
        ...s,
        creatives: [makeBlankCreative({
          accent_color: profile.brand_color_1 || '#7c3aed',
          secondary_color: profile.brand_color_2 || '',
        })],
      };
    });
```

with:

```jsx
    setForm(s => {
      if (s.creatives.length > 0) return s;
      return {
        ...s,
        creatives: [makeBlankCreative({
          accent_color: profile.brand_color_1 || '#7c3aed',
        })],
      };
    });
```

- [ ] **Step 4: Simplify `loadDuplicate` — drop the removed fields, carry the QR position forward instead**

In `CreateCampaign.jsx:193-218`, replace:

```jsx
  const loadDuplicate = (c) => {
    setForm(s => ({
      ...s,
      creatives: [makeBlankCreative({
        headline: c.headline || '',
        cta_text: c.cta_text || c.cta || '',
        destination_url: c.destination_url || c.destination || '',
        accent_color: c.accent_color || c.color || '#7c3aed',
        secondary_color: c.secondary_color || '',
        creative_template: c.creative_template || 'bottom_bar',
        category: c.category || 'Food & Beverage',
      })],
```

with:

```jsx
  const loadDuplicate = (c) => {
    setForm(s => ({
      ...s,
      // Media is intentionally NOT carried forward -- every campaign needs
      // its own uploaded creative, so duplicating a past campaign still
      // requires a fresh upload before the wizard lets it advance.
      creatives: [makeBlankCreative({
        destination_url: c.destination_url || c.destination || '',
        accent_color: c.accent_color || c.color || '#7c3aed',
        category: c.category || 'Food & Beverage',
        qr_x: c.qr_x ?? null,
        qr_y: c.qr_y ?? null,
        qr_size_pct: c.qr_size_pct ?? null,
      })],
```

(the rest of the `loadDuplicate` object — `budget` through `start_when` — is unchanged)

- [ ] **Step 5: Update `handleSubmit`'s `buildPreviewCampaign` call and the `bookings` insert**

Replace:

```jsx
      const preview = buildPreviewCampaign(primary, profile);
```

with:

```jsx
      const preview = buildPreviewCampaign(primary);
```

In the `bookings` insert (`CreateCampaign.jsx:255-288`), remove this line (the field it references no longer exists on `preview`):

```jsx
        secondary_color:       preview.secondary_color || null,
```

`qr_x`/`qr_y`/`qr_size_pct` need no separate line — they're already included via the `...preview` spread on the line above, since `buildPreviewCampaign` now returns them.

- [ ] **Step 6: Update the `campaign_creatives` insert to drop headline/cta_text and add QR fields**

In `CreateCampaign.jsx:299-316`, replace:

```jsx
          .insert(creatives.map((c, i) => ({
            targeting_id: campaignId,
            label: c.label || `Creative ${i + 1}`,
            media_url: c.media_url || null,
            media_type: c.media_type || null,
            media_width: c.media_width ?? null,
            media_height: c.media_height ?? null,
            headline: c.headline || null,
            cta_text: c.cta_text || null,
            destination_url: c.destination_url ? normalizeDestinationUrl(c.destination_url) : null,
            accent_color: c.accent_color || null,
            budget: form.budget_level === 'per_creative' ? (parseFloat(c.budget) || null) : null,
          })))
```

with:

```jsx
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
            budget: form.budget_level === 'per_creative' ? (parseFloat(c.budget) || null) : null,
          })))
```

- [ ] **Step 7: Update the post-submit `created` object**

In `CreateCampaign.jsx:360-392`, remove these four lines (the fields they reference no longer exist on `preview`):

```jsx
        headline: preview.headline || '',
        cta: preview.cta_text || '',
        creative_template: preview.creative_template,
        secondary_color: preview.secondary_color,
```

and add QR passthrough alongside the existing `color`/`destination` lines:

```jsx
        color: preview.accent_color || '#7c3aed',
        qr_x: preview.qr_x,
        qr_y: preview.qr_y,
        qr_size_pct: preview.qr_size_pct,
        destination: normalizeDestinationUrl(preview.destination_url || ''),
```

- [ ] **Step 8: Require every creative to have an uploaded media file before advancing past the Creative step**

In `CreateCampaign.jsx:484-504`, replace the `Next →` button's `disabled` expression:

```jsx
            disabled={
              (step === 0 && form.area_type === 'radius' && !form.radius_center_lat) ||
              (step === 0 && form.selected_screen_ids.length === 0 && form.area_type !== 'radius') ||
              (step === 1 && form.selected_screen_ids.length === 0) ||
              // Creative step: a campaign with no valid destination goes live
              // with a QR code that sends every scanner to an error. A
              // never-touched creatives array (blank, lazily seeded by
              // StepCreative on first edit) is treated the same as a blank
              // destination — .some() over [] is always false and would
              // otherwise silently permit advancing past a wholly blank ad.
              (step === 1 && (form.creatives.length === 0 || form.creatives.some(c => !isValidDestinationUrl(c.destination_url))))
            }
```

with:

```jsx
            disabled={
              (step === 0 && form.area_type === 'radius' && !form.radius_center_lat) ||
              (step === 0 && form.selected_screen_ids.length === 0 && form.area_type !== 'radius') ||
              (step === 1 && form.selected_screen_ids.length === 0) ||
              // Creative step: a campaign with no valid destination goes live
              // with a QR code that sends every scanner to an error, and a
              // creative with no uploaded media has no ad to show at all
              // (there's no generated text-card fallback anymore). A
              // never-touched creatives array (blank, lazily seeded by
              // StepCreative on first edit) is treated the same as a blank
              // destination/missing media — .some() over [] is always false
              // and would otherwise silently permit advancing past a wholly
              // blank ad.
              (step === 1 && (
                form.creatives.length === 0 ||
                form.creatives.some(c => !isValidDestinationUrl(c.destination_url)) ||
                form.creatives.some(c => !c.media_url)
              ))
            }
```

- [ ] **Step 9: Update the smoke test to exercise a field that still exists**

`StepCreative.smoke.test.jsx`'s third test types into a Headline input that no longer exists. Replace it (and trim the fixture creatives to match the new `makeBlankCreative` shape) — full new file:

```jsx
// src/views/advertiser/createCampaign/StepCreative.smoke.test.jsx
// Throwaway smoke test — confirms StepCreative.jsx and CreativeCard.jsx are
// syntactically valid and resolvable (imports exist, renders without
// throwing) before they are wired into CreateCampaign.jsx's render switch in
// a later task.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// StepCreative pulls in CreativeCard -> MediaUpload, which imports the real
// supabase client (throws "supabaseUrl is required" under jsdom with no env)
// and useAuth() from AuthContext. Neither is exercised by this smoke test --
// mock both, same pattern as SettingsView.test.jsx / AuthContext.test.jsx.
vi.mock('../../../lib/supabase.js', () => ({
  supabase: { storage: { from: vi.fn() } },
}));
vi.mock('../../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { id: 'u-1' } }),
}));

import { StepCreative } from './StepCreative.jsx';

const SCREEN_A = {
  id: 'scr-1', name: 'Corner Brew — Oxford St', city: 'London', environment: 'indoor',
  impressions: 84200, resolution_w: 1920, resolution_h: 1080, accepted_formats: ['jpg', 'mp4'], max_file_mb: 50,
};
const SCREEN_B = {
  id: 'scr-2', name: 'Canary Wharf Plaza', city: 'London', environment: 'outdoor',
  impressions: 210000, resolution_w: 1080, resolution_h: 1920, accepted_formats: ['jpg', 'mp4'], max_file_mb: 50,
};

const baseForm = {
  selected_screen_ids: [SCREEN_A.id, SCREEN_B.id],
  env_filter: 'any',
  duration: 15,
  creatives: [],
};

describe('StepCreative', () => {
  it('renders the default single-creative flow without assignment UI', () => {
    render(
      <StepCreative form={baseForm} setForm={() => {}} matchedScreens={[SCREEN_A, SCREEN_B]} />
    );
    expect(screen.getByText('Screens')).toBeInTheDocument();
    expect(screen.getByText('Creative')).toBeInTheDocument();
    expect(screen.queryByText(/Split by screen type/)).not.toBeInTheDocument();
  });

  it('reveals per-creative assignment once a second creative is added', () => {
    const form = {
      ...baseForm,
      creatives: [
        { id: 'c1', label: 'A', destination_url: '', accent_color: '#7c3aed', category: 'Food & Beverage', media_url: '', media_type: '', media_width: null, media_height: null, qr_x: null, qr_y: null, qr_size_pct: null, assigned_screen_ids: [SCREEN_A.id], weight: 100 },
        { id: 'c2', label: 'B', destination_url: '', accent_color: '#7c3aed', category: 'Food & Beverage', media_url: '', media_type: '', media_width: null, media_height: null, qr_x: null, qr_y: null, qr_size_pct: null, assigned_screen_ids: [], weight: 100 },
      ],
    };
    render(
      <StepCreative form={form} setForm={() => {}} matchedScreens={[SCREEN_A, SCREEN_B]} />
    );
    expect(screen.getByText('Creatives')).toBeInTheDocument();
    expect(screen.getAllByText(/Split by screen type/).length).toBe(2);
    // scr-2 isn't claimed by either creative -- the "unassigned" banner should surface it.
    expect(screen.getByText(/aren't assigned to a creative yet/)).toBeInTheDocument();
  });

  it('preserves the first edit when starting from an empty creatives array', () => {
    let capturedUpdater;
    const setForm = (updater) => { capturedUpdater = updater; };
    render(
      <StepCreative form={baseForm} setForm={setForm} matchedScreens={[SCREEN_A, SCREEN_B]} />
    );
    const destinationInput = screen.getByPlaceholderText('https://example.com');
    fireEvent.change(destinationInput, { target: { value: 'https://example.com' } });

    expect(capturedUpdater).toBeTypeOf('function');
    const next = capturedUpdater(baseForm);
    expect(next.creatives).toHaveLength(1);
    expect(next.creatives[0].destination_url).toBe('https://example.com');
  });
});
```

- [ ] **Step 10: Simplify `StepBudgetReview.jsx`'s Creatives review row to stop reading the removed `headline` field**

In `StepBudgetReview.jsx:33`, replace:

```jsx
    ['Creatives', isMulti ? form.creatives.map((c, i) => creativeLabel(i)).join(', ') : (form.creatives[0]?.headline || '—')],
```

with:

```jsx
    ['Creatives', isMulti ? form.creatives.map((c, i) => creativeLabel(i)).join(', ') : creativeLabel(0)],
```

- [ ] **Step 11: Run the affected tests**

Run: `npx vitest run src/views/advertiser/createCampaign/StepCreative.smoke.test.jsx src/views/advertiser/createCampaign/StepBudgetReview.smoke.test.jsx`
Expected: PASS

- [ ] **Step 12: Commit**

```bash
git add src/views/advertiser/createCampaign/StepCreative.jsx src/views/advertiser/CreateCampaign.jsx src/views/advertiser/createCampaign/StepCreative.smoke.test.jsx src/views/advertiser/createCampaign/StepBudgetReview.jsx
git commit -m "feat: require media upload before advancing past Creative step, wire QR fields through submit"
```

---

### Task 11: `display-feed` — forward QR position/size to `DisplayPlayer`

**Files:**
- Modify: `supabase/functions/display-feed/index.ts:77,93,99,104-117,154-165`

- [ ] **Step 1: Add the columns to both select statements**

Line 77 (`bookings` select), replace:

```ts
      .select("id, advertiser_name, headline, cta_text, accent_color, destination_url, category, media_url, media_type, slots, duration, schedule_days, time_start, time_end")
```

with:

```ts
      .select("id, advertiser_name, headline, cta_text, accent_color, destination_url, category, media_url, media_type, qr_x, qr_y, qr_size_pct, slots, duration, schedule_days, time_start, time_end")
```

Line 99 (`campaign_creatives` select), replace:

```ts
        .select("id, targeting_id, status, media_url, media_type, headline, cta_text, destination_url, accent_color")
```

with:

```ts
        .select("id, targeting_id, status, media_url, media_type, headline, cta_text, destination_url, accent_color, qr_x, qr_y, qr_size_pct")
```

- [ ] **Step 2: Widen the `creativesByTargeting` map's value type and carry the fields through the loop that builds it**

Line 93, replace:

```ts
    const creativesByTargeting = new Map<string, { creative_id: string; weight: number; media_url: string | null; media_type: string | null; headline: string | null; cta_text: string | null; destination_url: string | null; accent_color: string | null }[]>();
```

with:

```ts
    const creativesByTargeting = new Map<string, { creative_id: string; weight: number; media_url: string | null; media_type: string | null; headline: string | null; cta_text: string | null; destination_url: string | null; accent_color: string | null; qr_x: number | null; qr_y: number | null; qr_size_pct: number | null }[]>();
```

Lines 104-117, replace:

```ts
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
        });
        creativesByTargeting.set(cr.targeting_id as string, list);
      }
```

with:

```ts
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
        });
        creativesByTargeting.set(cr.targeting_id as string, list);
      }
```

- [ ] **Step 3: Forward the per-creative QR override in the multi-creative expansion branch**

Lines 154-165, replace:

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
          });
        }
```

with:

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
          });
        }
```

The single-creative fallback branch (lines 132-144, `assignments.length === 0`) needs no change — it already spreads `...b`, which now includes `qr_x`/`qr_y`/`qr_size_pct` straight from the `bookings` select added in Step 1, and there is no per-screen QR override column on the legacy `campaign_screens` table to prefer instead.

- [ ] **Step 4: Deploy / verify**

Run: whatever this project's usual edge-function deploy or local-serve command is (e.g. `supabase functions deploy display-feed` or `supabase functions serve display-feed`, matching how other `display-feed` changes in this repo's history were shipped)
Expected: no TypeScript errors; a manual `curl` against `/display-feed?token=<test-screen-token>` for a screen with an active paid campaign returns `qr_x`/`qr_y`/`qr_size_pct` in the response body (or `null` if that campaign's creative never set them).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/display-feed/index.ts
git commit -m "feat: forward qr_x/qr_y/qr_size_pct through display-feed"
```

---

### Task 12: `CampaignDetail.jsx` — drop Headline/CTA editing, fix the dead `cta` write

The existing "Edit Creative" save handler writes `{ headline, cta, accent_color }` to `bookings`, but the real column is `cta_text` — `cta` has never been a real column, so that field silently no-ops today. Since headline/CTA are no longer authored anywhere, the fix is to drop both inputs rather than correct the column name.

**Files:**
- Modify: `src/views/operator/CampaignDetail.jsx:29,170,186,195,200-239`

- [ ] **Step 1: Simplify `creativeForm` state to accent colour only**

Replace:

```jsx
  const [creativeForm, setCreativeForm] = useState({ headline: campaign.headline ?? '', cta: campaign.cta ?? '', accent_color: campaign.color ?? '#7c3aed' });
```

with:

```jsx
  const [creativeForm, setCreativeForm] = useState({ accent_color: campaign.color ?? '#7c3aed' });
```

- [ ] **Step 2: Show an em-dash for a missing headline in the read-only summary (legacy campaigns keep their real value; new campaigns show "—" since none is authored anymore)**

Line 186, replace:

```jsx
              {[['Headline', c.headline], ['Category', c.category], ['Accent Colour', c.color || '—'], ['QR Destination', c.destination || '—']].map(([l, v]) => (
```

with:

```jsx
              {[['Headline', c.headline || '—'], ['Category', c.category], ['Accent Colour', c.color || '—'], ['QR Destination', c.destination || '—']].map(([l, v]) => (
```

- [ ] **Step 3: Update the "Edit Creative" button's reset to match the new form shape**

Line 195, replace:

```jsx
              <Btn variant="secondary" size="sm" style={{ alignSelf: 'flex-start' }} onClick={() => { setTab('creative'); setCreativeForm({ headline: c.headline ?? '', cta: c.cta ?? '', accent_color: c.color ?? '#7c3aed' }); setEditingCreative(true); }}>✏ Edit Creative</Btn>
```

with:

```jsx
              <Btn variant="secondary" size="sm" style={{ alignSelf: 'flex-start' }} onClick={() => { setTab('creative'); setCreativeForm({ accent_color: c.color ?? '#7c3aed' }); setEditingCreative(true); }}>✏ Edit Creative</Btn>
```

- [ ] **Step 4: Remove the Headline/CTA inputs and fix the save handler**

Replace the entire edit form block (lines 200-239):

```jsx
          {editingCreative && (
            <div style={{ marginTop: 20, padding: 20, background: C.surface, borderRadius: 12, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 16 }}>Edit Creative</div>
              {[
                { label: 'Headline', key: 'headline', type: 'text' },
                { label: 'Call to Action', key: 'cta', type: 'text' },
              ].map(({ label, key, type }) => (
                <div key={key} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: C.textSub, marginBottom: 4 }}>{label}</div>
                  <input
                    type={type}
                    value={creativeForm[key]}
                    onChange={e => setCreativeForm(f => ({ ...f, [key]: e.target.value }))}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 8,
                      border: `1px solid ${C.border}`, fontFamily: F.sans, fontSize: 13,
                      outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
              ))}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: C.textSub, marginBottom: 4 }}>Accent Colour</div>
                <input
                  type="color"
                  value={creativeForm.accent_color}
                  onChange={e => setCreativeForm(f => ({ ...f, accent_color: e.target.value }))}
                  style={{ width: 48, height: 36, borderRadius: 6, border: `1px solid ${C.border}`, cursor: 'pointer' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <Btn variant="secondary" size="sm" onClick={() => setEditingCreative(false)}>Cancel</Btn>
                <Btn size="sm" onClick={async () => {
                  const { error } = await supabase.from('bookings').update({
                    headline: creativeForm.headline,
                    cta: creativeForm.cta,
                    accent_color: creativeForm.accent_color,
                  }).eq('id', c.id);
                  if (error) { toast.error(`Save failed: ${error.message}`); return; }
                  onUpdate({ ...c, headline: creativeForm.headline, cta: creativeForm.cta, color: creativeForm.accent_color });
                  setEditingCreative(false);
                }}>Save Creative</Btn>
              </div>
            </div>
          )}
```

with:

```jsx
          {editingCreative && (
            <div style={{ marginTop: 20, padding: 20, background: C.surface, borderRadius: 12, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 16 }}>Edit Creative</div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: C.textSub, marginBottom: 4 }}>Accent Colour</div>
                <input
                  type="color"
                  value={creativeForm.accent_color}
                  onChange={e => setCreativeForm(f => ({ ...f, accent_color: e.target.value }))}
                  style={{ width: 48, height: 36, borderRadius: 6, border: `1px solid ${C.border}`, cursor: 'pointer' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <Btn variant="secondary" size="sm" onClick={() => setEditingCreative(false)}>Cancel</Btn>
                <Btn size="sm" onClick={async () => {
                  const { error } = await supabase.from('bookings').update({
                    accent_color: creativeForm.accent_color,
                  }).eq('id', c.id);
                  if (error) { toast.error(`Save failed: ${error.message}`); return; }
                  onUpdate({ ...c, color: creativeForm.accent_color });
                  setEditingCreative(false);
                }}>Save Creative</Btn>
              </div>
            </div>
          )}
```

- [ ] **Step 5: Run this file's test, if one exists**

Run: `find src/views/operator -iname "CampaignDetail*.test.*"`
Then, if found: `npx vitest run <that path>`
Expected: no matches, or PASS if a test file exists

- [ ] **Step 6: Commit**

```bash
git add src/views/operator/CampaignDetail.jsx
git commit -m "fix: drop dead headline/cta edit fields from CampaignDetail (cta was never a real bookings column)"
```

---

### Task 13: Full regression pass

**Files:** none (verification only)

- [ ] **Step 1: Run the entire test suite**

Run: `npx vitest run`
Expected: PASS, zero failures, zero unresolved-import errors

- [ ] **Step 2: Manual smoke test in the browser**

Start the advertiser wizard (`npm run dev` or this project's usual dev command), walk through creating a campaign:
- Confirm the Creative step's card no longer shows Headline, CTA Text, or the template-swatch picker.
- Confirm "Next →" stays disabled until both a destination URL is entered AND an image/video is uploaded.
- Confirm the QR code appears on the preview only after a destination URL is entered, and can be dragged and resized, with the four corner-preset buttons snapping it into place.
- Confirm the accent colour and category fields still work.

Expected: matches the above; no console errors during the walkthrough.

- [ ] **Step 3: Report results**

If anything fails, return to the relevant task above and fix before considering this plan complete — do not mark this task done on a partial pass.

---

## Self-review notes (from the plan author, kept for the executor's context)

- **Spec coverage:** media-required ✅ (Task 8/10), headline/CTA fields dropped ✅ (Task 8), QR draggable ✅ (Task 4/8), QR resizable ✅ (Task 4/8), QR corner-snap presets ✅ (Task 1/8), QR hidden without destination ✅ (Task 3/4/5), QR position persisted on creative/booking row ✅ (Task 2/6/7/10/11), operator display honors position ✅ (Task 5/11).
- **Backward compatibility:** legacy campaigns (headline/cta_text/creative_template/secondary_color already set, no media) keep rendering identically — none of those columns or `getCreativeRenderPlan`'s fallback logic for them was touched, only the *authoring* path was.
- **Out of scope, flagged but not built:** QR-position editing in `CampaignDetail.jsx` post-submit (see "Known limitations" at the top).
