# Ad Render Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an advertiser see their uploaded creative perspective-warped onto a real photo of the physical screen before booking, and let an operator mark the 4 corners of the screen within an uploaded photo to make that possible.

**Architecture:** Operator marks 4 normalized corners per photo (`screen_photo_frames jsonb` on `screens`). A pure-math lib (`quadWarp.js`) computes a 4-point homography; a presentational component (`AdRenderPreview`) uses it to draw the creative into a `<canvas>` (images, via 2-triangle affine warp) or apply a CSS `matrix3d` to a `<video>` (videos, live playback). Advertiser triggers this from a "Preview" button on each screen's picker card once they've uploaded a creative.

**Tech Stack:** React (JSX, no TS), Vite, Supabase (Postgres + Storage), Vitest + @testing-library/react + jsdom.

---

## Spec

Full design: [docs/superpowers/specs/2026-08-07-ad-render-preview-design.md](../specs/2026-08-07-ad-render-preview-design.md)

## File Structure

**New:**
- `supabase/migrations/20260807000000_screen_photo_frames.sql` — new column + view update
- `src/lib/quadWarp.js` — homography/affine math, CSS matrix3d conversion, quad validation, canvas warp
- `src/lib/quadWarp.test.js`
- `src/components/shared/AdRenderPreview.jsx` — warps a creative onto a photo given 4 corners
- `src/components/shared/AdRenderPreview.test.jsx`
- `src/components/shared/AdRenderPreviewModal.jsx` — modal shell + photo switcher around `AdRenderPreview`
- `src/components/shared/AdRenderPreviewModal.test.jsx`
- `src/components/screens/CornerMarker.jsx` — drag-4-corners UI
- `src/components/screens/CornerMarker.test.jsx`
- `src/components/screens/ScreenPhotoManager.jsx` — photo upload/remove + corner marking (replaces duplicated `PhotoUpload`/`DetailsTab` photo logic)
- `src/components/screens/ScreenPhotoManager.test.jsx`
- `src/views/advertiser/createCampaign/ScreenPickerCard.test.jsx`
- `src/views/advertiser/createCampaign/StepCreative.creativeForScreen.test.jsx`

**Modified:**
- `vitest.setup.js` — add a default no-op `ResizeObserver` stub
- `src/views/operator/ScreenOnboard.jsx` — remove local `PhotoUpload`, use `ScreenPhotoManager`
- `src/views/operator/ScreenDetail.jsx` — remove inline photo block in `DetailsTab`, use `ScreenPhotoManager`
- `src/views/advertiser/createCampaign/ScreenPickerCard.jsx` — add Preview button + modal
- `src/views/advertiser/createCampaign/StepCreative.jsx` — pass the right creative to each card
- `src/App.jsx` — add `screen_photo_frames` to the `advertiser_screens` select column list

---

### Task 1: Database — `screen_photo_frames` column + view

**Files:**
- Create: `supabase/migrations/20260807000000_screen_photo_frames.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Ad render preview (2026-08-07 design spec): lets an advertiser see their
-- creative warped onto a photo of the actual screen before booking. Each
-- entry pairs a screen_photos URL with the 4 corners (normalized 0-1,
-- [TL, TR, BR, BL]) the operator marked around the physical screen in that
-- photo. A photo with no entry here simply isn't preview-eligible --
-- marking corners is optional per photo (see ScreenPhotoManager).

ALTER TABLE screens
  ADD COLUMN IF NOT EXISTS screen_photo_frames jsonb NOT NULL DEFAULT '[]';

CREATE OR REPLACE VIEW public.advertiser_screens AS
SELECT
  id, name, owner_id, owner_name, owner_type, city_id, city, location, status,
  lat, lon, impressions, own_slots, blocked_categories,
  max_ad_duration, min_dwell_time, allow_competitors, created_at, updated_at,
  operator_id, cpm_floor, display_size, monthly_traffic_estimate,
  content_categories_blocked, operating_hours_start, operating_hours_end, lng,
  last_seen, health_status, venue_category, venue_subtype, environment,
  screen_position, state, country, screen_photos, auto_approve, timezone,
  resolution_w, resolution_h, accepted_formats, max_file_mb, screen_photo_frames
FROM public.screens
WHERE status = 'live';

GRANT SELECT ON public.advertiser_screens TO authenticated;
```

- [ ] **Step 2: Verify the column list matches (manual check, no automated test)**

Migrations aren't unit tested in this repo. Instead, diff the view's column list against the prior migration to confirm only `screen_photo_frames` was added:

```bash
git diff --no-index supabase/migrations/20260727000002_advertiser_screens_view_creative_spec.sql supabase/migrations/20260807000000_screen_photo_frames.sql
```

Expected: the only `SELECT` list change is the trailing `, screen_photo_frames`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260807000000_screen_photo_frames.sql
git commit -m "feat: add screen_photo_frames column for ad render preview"
```

---

### Task 2: `lib/quadWarp.js` — homography math

**Files:**
- Create: `src/lib/quadWarp.js`
- Test: `src/lib/quadWarp.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// src/lib/quadWarp.test.js
import { describe, it, expect } from 'vitest';
import {
  solveLinearSystem,
  computeHomography,
  applyHomography,
  affineFromTriangle,
  cssMatrix3dString,
  validateQuadOrientation,
  drawWarpedImageToCanvas,
} from './quadWarp.js';

describe('solveLinearSystem', () => {
  it('solves a simple known 3x3 system', () => {
    // x + y + z = 6, 2y + 5z = -4, 2x + 5y - z = 27
    const A = [[1, 1, 1], [0, 2, 5], [2, 5, -1]];
    const b = [6, -4, 27];
    const [x, y, z] = solveLinearSystem(A, b);
    expect(x).toBeCloseTo(5, 6);
    expect(y).toBeCloseTo(3, 6);
    expect(z).toBeCloseTo(-2, 6);
  });

  it('throws on a singular (degenerate) matrix', () => {
    const A = [[1, 1], [2, 2]];
    const b = [1, 2];
    expect(() => solveLinearSystem(A, b)).toThrow(/singular/);
  });
});

describe('computeHomography / applyHomography', () => {
  const UNIT_SQUARE = [[0, 0], [1, 0], [1, 1], [0, 1]];

  it('produces an identity mapping when src equals dst', () => {
    const h = computeHomography(UNIT_SQUARE, UNIT_SQUARE);
    const [x, y] = applyHomography(h, [0.3, 0.7]);
    expect(x).toBeCloseTo(0.3, 6);
    expect(y).toBeCloseTo(0.7, 6);
  });

  it('maps all 4 correspondences exactly for a general (skewed) quad', () => {
    const dst = [[10, 20], [110, 15], [120, 90], [5, 95]];
    const h = computeHomography(UNIT_SQUARE, dst);
    UNIT_SQUARE.forEach((src, i) => {
      const [x, y] = applyHomography(h, src);
      expect(x).toBeCloseTo(dst[i][0], 4);
      expect(y).toBeCloseTo(dst[i][1], 4);
    });
  });
});

describe('affineFromTriangle', () => {
  it('recovers a known scale (no rotation/skew)', () => {
    const src = [[0, 0], [1, 0], [0, 1]];
    const dst = [[0, 0], [2, 0], [0, 3]];
    const { a, b, c, d, e, f } = affineFromTriangle(src, dst);
    expect(a).toBeCloseTo(2, 6);
    expect(b).toBeCloseTo(0, 6);
    expect(c).toBeCloseTo(0, 6);
    expect(d).toBeCloseTo(3, 6);
    expect(e).toBeCloseTo(0, 6);
    expect(f).toBeCloseTo(0, 6);
  });

  it('recovers a known translation', () => {
    const src = [[0, 0], [1, 0], [0, 1]];
    const dst = [[5, 8], [6, 8], [5, 9]];
    const { a, b, c, d, e, f } = affineFromTriangle(src, dst);
    expect(a).toBeCloseTo(1, 6);
    expect(b).toBeCloseTo(0, 6);
    expect(c).toBeCloseTo(0, 6);
    expect(d).toBeCloseTo(1, 6);
    expect(e).toBeCloseTo(5, 6);
    expect(f).toBeCloseTo(8, 6);
  });
});

describe('cssMatrix3dString', () => {
  it('places the homography terms in column-major matrix3d order', () => {
    const h = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const str = cssMatrix3dString(h);
    expect(str).toBe('matrix3d(1,4,0,7,2,5,0,8,0,0,1,0,3,6,0,9)');
  });
});

describe('validateQuadOrientation', () => {
  it('accepts a simple non-crossing rectangle', () => {
    expect(validateQuadOrientation([[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]])).toBe(true);
  });

  it('rejects a quad with a duplicate/collinear corner', () => {
    expect(validateQuadOrientation([[0.9, 0.9], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]])).toBe(false);
  });

  it('rejects anything that is not exactly 4 corners', () => {
    expect(validateQuadOrientation([[0, 0], [1, 0], [1, 1]])).toBe(false);
  });
});

describe('drawWarpedImageToCanvas', () => {
  it('clips and draws exactly two triangles covering the destination quad', () => {
    const calls = { moveTo: [], clip: 0, drawImage: 0, transform: [] };
    const ctx = {
      save: () => {}, restore: () => {},
      beginPath: () => {},
      moveTo: (x, y) => calls.moveTo.push([x, y]),
      lineTo: () => {}, closePath: () => {},
      clip: () => { calls.clip += 1; },
      transform: (a, b, c, d, e, f) => calls.transform.push([a, b, c, d, e, f]),
      drawImage: () => { calls.drawImage += 1; },
    };
    const image = { naturalWidth: 200, naturalHeight: 100 };
    const dstCorners = [[0, 0], [300, 0], [300, 150], [0, 150]];

    drawWarpedImageToCanvas(ctx, image, dstCorners);

    expect(calls.clip).toBe(2);
    expect(calls.drawImage).toBe(2);
    expect(calls.transform).toHaveLength(2);
    expect(calls.moveTo).toEqual([[0, 0], [0, 0]]); // both triangles start at dstCorners[0] (TL)
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/quadWarp.test.js
```

Expected: FAIL — `Cannot find module './quadWarp.js'` (or similar).

- [ ] **Step 3: Write the implementation**

```js
// src/lib/quadWarp.js
//
// Perspective-warp math for the ad-render preview feature. Pure — no DOM
// dependency except drawWarpedImageToCanvas, which only calls methods on
// whatever 2D-context-shaped object it's given (easy to fake in tests).
//
// Coordinate convention throughout: a "quad" is 4 [x, y] points in
// [TL, TR, BR, BL] order.

// Generic Gaussian elimination with partial pivoting. A is an n x n array of
// arrays, b is length n. Returns the length-n solution. Used by both
// computeHomography (n=8) and affineFromTriangle (n=3, called twice).
export function solveLinearSystem(A, b) {
  const n = b.length;
  const M = A.map(row => row.slice());
  const v = b.slice();

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[pivotRow][col])) pivotRow = row;
    }
    if (pivotRow !== col) {
      [M[col], M[pivotRow]] = [M[pivotRow], M[col]];
      [v[col], v[pivotRow]] = [v[pivotRow], v[col]];
    }
    const pivot = M[col][col];
    if (Math.abs(pivot) < 1e-12) {
      throw new Error('solveLinearSystem: singular matrix (degenerate corners)');
    }
    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / pivot;
      for (let k = col; k < n; k++) M[row][k] -= factor * M[col][k];
      v[row] -= factor * v[col];
    }
  }

  const x = new Array(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let sum = v[row];
    for (let k = row + 1; k < n; k++) sum -= M[row][k] * x[k];
    x[row] = sum / M[row][row];
  }
  return x;
}

// 4-point direct linear transform (DLT). Returns a flat 9-element row-major
// 3x3 matrix [h11,h12,h13, h21,h22,h23, h31,h32,h33] (h33 fixed to 1) mapping
// src -> dst in homogeneous coordinates.
export function computeHomography(src, dst) {
  const A = [];
  const b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [X, Y] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -X * x, -X * y]);
    b.push(X);
    A.push([0, 0, 0, x, y, 1, -Y * x, -Y * y]);
    b.push(Y);
  }
  const [h11, h12, h13, h21, h22, h23, h31, h32] = solveLinearSystem(A, b);
  return [h11, h12, h13, h21, h22, h23, h31, h32, 1];
}

export function applyHomography(m, [x, y]) {
  const [h11, h12, h13, h21, h22, h23, h31, h32, h33] = m;
  const w = h31 * x + h32 * y + h33;
  return [(h11 * x + h12 * y + h13) / w, (h21 * x + h22 * y + h23) / w];
}

// 3-point affine fit: finds [a,b,c,d,e,f] such that X = a*x + c*y + e and
// Y = b*x + d*y + f for each of the 3 correspondences -- the exact argument
// order Canvas2D's ctx.transform(a,b,c,d,e,f) expects. The X and Y equations
// decouple (each only depends on a shared [x,y,1] basis), so this is two
// independent 3x3 solves rather than one 6x6.
export function affineFromTriangle(src3, dst3) {
  const M = src3.map(([x, y]) => [x, y, 1]);
  const X = dst3.map(([px]) => px);
  const Y = dst3.map(([, py]) => py);
  const [a, c, e] = solveLinearSystem(M, X);
  const [b, d, f] = solveLinearSystem(M, Y);
  return { a, b, c, d, e, f };
}

// Converts a 2D homography (flat 9-element row-major 3x3, z=0 plane) into a
// CSS matrix3d(...) string. CSS matrix3d's 16 arguments are column-major:
// matrix3d(a1,b1,c1,d1, a2,b2,c2,d2, a3,b3,c3,d3, a4,b4,c4,d4) is applied as
// [x',y',z',w']^T = M . [x,y,z,1]^T. With z always 0 for a flat element, the
// z-row/column just need to preserve z through: row3 = [0,0,1,0].
export function cssMatrix3dString(m) {
  const [h11, h12, h13, h21, h22, h23, h31, h32, h33] = m;
  const values = [
    h11, h21, 0, h31,
    h12, h22, 0, h32,
    0, 0, 1, 0,
    h13, h23, 0, h33,
  ];
  return `matrix3d(${values.join(',')})`;
}

function signedArea(corners) {
  let sum = 0;
  for (let i = 0; i < corners.length; i++) {
    const [x1, y1] = corners[i];
    const [x2, y2] = corners[(i + 1) % corners.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

// A quad is valid if it has non-negligible area and turns consistently in
// one direction at every corner (i.e. it's convex, which for exactly 4
// points also rules out the self-intersecting "bowtie" case and duplicate/
// collinear corners).
export function validateQuadOrientation(corners) {
  if (!Array.isArray(corners) || corners.length !== 4) return false;
  if (Math.abs(signedArea(corners)) < 1e-6) return false;

  let sign = null;
  for (let i = 0; i < 4; i++) {
    const p0 = corners[i];
    const p1 = corners[(i + 1) % 4];
    const p2 = corners[(i + 2) % 4];
    const cross = (p1[0] - p0[0]) * (p2[1] - p1[1]) - (p1[1] - p0[1]) * (p2[0] - p1[0]);
    if (Math.abs(cross) < 1e-9) return false;
    const s = cross > 0;
    if (sign === null) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

// Draws `image` warped onto `dstCorners` ([TL,TR,BR,BL] pixel coords on
// `ctx`'s canvas) by splitting the quad into 2 triangles and affine-mapping
// each -- Canvas2D has no native quad/perspective primitive, so this is the
// standard workaround. Imperceptible seam along the diagonal for a flat ad
// graphic at typical preview sizes.
export function drawWarpedImageToCanvas(ctx, image, dstCorners) {
  const iw = image.naturalWidth ?? image.width;
  const ih = image.naturalHeight ?? image.height;
  const srcTL = [0, 0], srcTR = [iw, 0], srcBR = [iw, ih], srcBL = [0, ih];
  const [dstTL, dstTR, dstBR, dstBL] = dstCorners;

  const triangles = [
    { src: [srcTL, srcTR, srcBR], dst: [dstTL, dstTR, dstBR] },
    { src: [srcTL, srcBR, srcBL], dst: [dstTL, dstBR, dstBL] },
  ];

  for (const { src, dst } of triangles) {
    const { a, b, c, d, e, f } = affineFromTriangle(src, dst);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(dst[0][0], dst[0][1]);
    ctx.lineTo(dst[1][0], dst[1][1]);
    ctx.lineTo(dst[2][0], dst[2][1]);
    ctx.closePath();
    ctx.clip();
    ctx.transform(a, b, c, d, e, f);
    ctx.drawImage(image, 0, 0, iw, ih);
    ctx.restore();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/quadWarp.test.js
```

Expected: PASS — all cases green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/quadWarp.js src/lib/quadWarp.test.js
git commit -m "feat: add quadWarp homography/affine math for ad render preview"
```

---

### Task 3: `AdRenderPreview` component

**Files:**
- Modify: `vitest.setup.js`
- Create: `src/components/shared/AdRenderPreview.jsx`
- Test: `src/components/shared/AdRenderPreview.test.jsx`

- [ ] **Step 1: Add a default `ResizeObserver` stub to the test environment**

jsdom has no `ResizeObserver`. `AdRenderPreview` (and everything that renders it) needs one defined globally or it throws on mount. Individual tests that need to *drive* it override `global.ResizeObserver` locally; this default keeps every other test from crashing.

```js
// vitest.setup.js — append to the existing file
if (typeof globalThis.ResizeObserver !== 'function') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
```

- [ ] **Step 2: Write the failing tests**

```jsx
// src/components/shared/AdRenderPreview.test.jsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AdRenderPreview } from './AdRenderPreview.jsx';

// Local capturing mock -- lets tests fire a resize with a controlled box
// size, overriding the harmless global no-op stub from vitest.setup.js.
let roCallback = null;
class CapturingResizeObserver {
  constructor(cb) { roCallback = cb; }
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  roCallback = null;
  global.ResizeObserver = CapturingResizeObserver;
});

const CORNERS = [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]];

describe('AdRenderPreview', () => {
  it('shows a loading state before the photo has a measured size', () => {
    render(
      <AdRenderPreview photoUrl="https://example.com/photo.jpg" corners={CORNERS}
        mediaUrl="https://example.com/ad.png" mediaType="image" />
    );
    expect(screen.getByText('Loading preview…')).toBeInTheDocument();
  });

  it('renders a canvas overlay once sized, for an image creative', () => {
    const { container } = render(
      <AdRenderPreview photoUrl="https://example.com/photo.jpg" corners={CORNERS}
        mediaUrl="https://example.com/ad.png" mediaType="image" />
    );
    act(() => { roCallback([{ contentRect: { width: 400, height: 300 } }]); });
    expect(container.querySelector('canvas')).toBeInTheDocument();
  });

  it('renders a warped <video> element once sized, for a video creative', () => {
    const { container } = render(
      <AdRenderPreview photoUrl="https://example.com/photo.jpg" corners={CORNERS}
        mediaUrl="https://example.com/ad.mp4" mediaType="video" />
    );
    act(() => { roCallback([{ contentRect: { width: 400, height: 300 } }]); });
    const video = container.querySelector('video');
    expect(video).toBeInTheDocument();
    expect(video.getAttribute('style')).toMatch(/matrix3d\(/);
  });

  it('renders neither overlay when corners are missing/invalid', () => {
    const { container } = render(
      <AdRenderPreview photoUrl="https://example.com/photo.jpg" corners={[]}
        mediaUrl="https://example.com/ad.png" mediaType="image" />
    );
    act(() => { roCallback([{ contentRect: { width: 400, height: 300 } }]); });
    expect(container.querySelector('canvas')).not.toBeInTheDocument();
    expect(container.querySelector('video')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx vitest run src/components/shared/AdRenderPreview.test.jsx
```

Expected: FAIL — module not found.

- [ ] **Step 4: Write the implementation**

```jsx
// src/components/shared/AdRenderPreview.jsx
import { useEffect, useRef, useState } from 'react';
import { C, F } from '../../design/tokens.js';
import { drawWarpedImageToCanvas, computeHomography, cssMatrix3dString } from '../../lib/quadWarp.js';

// Composites an advertiser's creative onto an operator-uploaded photo of the
// physical board, warped to the 4 corners the operator marked. Pure
// presentational -- caller decides which photo/corners/creative to show.
//
// corners: 4 normalized [x,y] points ([TL,TR,BR,BL], each 0-1) or an empty/
// invalid array, in which case only the plain photo renders.
export function AdRenderPreview({ photoUrl, corners, mediaUrl, mediaType }) {
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const [box, setBox] = useState({ width: 0, height: 0 });

  const hasCorners = Array.isArray(corners) && corners.length === 4;

  // Track the photo's rendered pixel size -- corners are normalized 0-1 and
  // must be scaled to whatever size the photo actually renders at.
  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setBox({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [photoUrl]);

  const dstCorners = hasCorners ? corners.map(([nx, ny]) => [nx * box.width, ny * box.height]) : [];
  const ready = hasCorners && box.width > 0 && box.height > 0;
  const dstCornersKey = JSON.stringify(dstCorners);

  // Image creative: draw the warped image into a canvas overlay whenever the
  // image or the destination quad changes.
  useEffect(() => {
    if (!ready || mediaType !== 'image') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = box.width;
    canvas.height = box.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return; // jsdom under test has no real canvas backend
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawWarpedImageToCanvas(ctx, img, dstCorners);
    };
    img.src = mediaUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, mediaType, mediaUrl, dstCornersKey]);

  // Video creative: warp the live <video> element via a CSS matrix3d built
  // from the homography mapping the video's own box onto dstCorners. Pure
  // derived value -- no imperative work needed, so no effect.
  let videoTransform = null;
  if (ready && mediaType === 'video') {
    const srcCorners = [[0, 0], [box.width, 0], [box.width, box.height], [0, box.height]];
    videoTransform = cssMatrix3dString(computeHomography(srcCorners, dstCorners));
  }

  return (
    <div style={{ position: 'relative', width: '100%', lineHeight: 0 }}>
      <img ref={imgRef} src={photoUrl} alt="Screen placement"
        style={{ width: '100%', display: 'block', borderRadius: 8 }} />
      {ready && mediaType === 'image' && (
        <canvas ref={canvasRef}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
      )}
      {ready && mediaType === 'video' && (
        <video
          src={mediaUrl} muted loop autoPlay playsInline
          style={{
            position: 'absolute', top: 0, left: 0, width: box.width, height: box.height,
            transformOrigin: '0 0', transform: videoTransform, pointerEvents: 'none',
          }}
        />
      )}
      {!ready && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, color: C.textMuted, fontFamily: F.sans,
        }}>
          Loading preview…
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/components/shared/AdRenderPreview.test.jsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add vitest.setup.js src/components/shared/AdRenderPreview.jsx src/components/shared/AdRenderPreview.test.jsx
git commit -m "feat: add AdRenderPreview component (warped image/video over a photo)"
```

---

### Task 4: `CornerMarker` component

**Files:**
- Create: `src/components/screens/CornerMarker.jsx`
- Test: `src/components/screens/CornerMarker.test.jsx`

- [ ] **Step 1: Write the failing tests**

```jsx
// src/components/screens/CornerMarker.test.jsx
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CornerMarker } from './CornerMarker.jsx';

beforeAll(() => {
  // jsdom's getBoundingClientRect always returns zeros -- stub a fixed box
  // so drag math in the component under test is deterministic.
  Element.prototype.getBoundingClientRect = () => ({
    left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100, x: 0, y: 0, toJSON() {},
  });
});

describe('CornerMarker', () => {
  it('seeds a default inset rectangle and enables Save', () => {
    render(<CornerMarker photoUrl="https://example.com/p.jpg" initialCorners={null} onSave={() => {}} onSkip={() => {}} />);
    expect(screen.getByRole('button', { name: 'Save corners' })).toBeEnabled();
  });

  it('calls onSave with the current corners when Save is clicked', () => {
    const onSave = vi.fn();
    render(<CornerMarker photoUrl="https://example.com/p.jpg" initialCorners={null} onSave={onSave} onSkip={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save corners' }));
    expect(onSave).toHaveBeenCalledWith([[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]]);
  });

  it('calls onSkip when "Skip — no clear screen edge" is clicked', () => {
    const onSkip = vi.fn();
    render(<CornerMarker photoUrl="https://example.com/p.jpg" initialCorners={null} onSave={() => {}} onSkip={onSkip} />);
    fireEvent.click(screen.getByText('Skip — no clear screen edge'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('disables Save and shows a warning once a drag collapses the quad', () => {
    render(
      <CornerMarker
        photoUrl="https://example.com/p.jpg"
        initialCorners={[[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]]}
        onSave={() => {}} onSkip={() => {}}
      />
    );
    const topLeftHandle = screen.getByTitle('Top-left');
    // Drag the top-left handle exactly onto the bottom-right corner
    // (0.9, 0.9 in a 200x100 box = clientX 180, clientY 90) -- makes two
    // consecutive edges collinear, a guaranteed-degenerate quad.
    fireEvent.pointerDown(topLeftHandle);
    fireEvent.pointerMove(window, { clientX: 180, clientY: 90 });
    fireEvent.pointerUp(window);

    expect(screen.getByRole('button', { name: 'Save corners' })).toBeDisabled();
    expect(screen.getByText(/Corners cross over each other/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/screens/CornerMarker.test.jsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```jsx
// src/components/screens/CornerMarker.jsx
import { useRef, useState } from 'react';
import { C, F } from '../../design/tokens.js';
import { Btn } from '../primitives/Btn.jsx';
import { validateQuadOrientation } from '../../lib/quadWarp.js';

const DEFAULT_CORNERS = [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]];
const HANDLE_LABELS = ['Top-left', 'Top-right', 'Bottom-right', 'Bottom-left'];

// Lets an operator mark the 4 corners of the actual screen within an
// uploaded photo, so AdRenderPreview can later warp an advertiser's
// creative onto exactly that quad.
export function CornerMarker({ photoUrl, initialCorners, onSave, onSkip }) {
  const containerRef = useRef(null);
  const [corners, setCorners] = useState(initialCorners ?? DEFAULT_CORNERS);
  const [draggingIndex, setDraggingIndex] = useState(null);

  const clamp01 = (n) => Math.min(1, Math.max(0, n));

  const moveHandle = (index, clientX, clientY) => {
    const rect = containerRef.current.getBoundingClientRect();
    const nx = clamp01((clientX - rect.left) / rect.width);
    const ny = clamp01((clientY - rect.top) / rect.height);
    setCorners(prev => prev.map((c, i) => (i === index ? [nx, ny] : c)));
  };

  const handlePointerDown = (index) => (e) => {
    e.preventDefault();
    setDraggingIndex(index);
    const onMove = (moveEvent) => moveHandle(index, moveEvent.clientX, moveEvent.clientY);
    const onUp = () => {
      setDraggingIndex(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const valid = validateQuadOrientation(corners);

  return (
    <div>
      <div ref={containerRef} style={{ position: 'relative', width: '100%', lineHeight: 0, borderRadius: 8, overflow: 'hidden' }}>
        <img src={photoUrl} alt="Mark the screen's corners" draggable={false}
          style={{ width: '100%', display: 'block', userSelect: 'none' }} />
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          <polygon
            points={corners.map(([x, y]) => `${x * 100}%,${y * 100}%`).join(' ')}
            fill="rgba(123,47,255,0.15)"
            stroke={valid ? C.purple : C.red}
            strokeWidth={2}
          />
        </svg>
        {corners.map(([x, y], i) => (
          <div
            key={i}
            onPointerDown={handlePointerDown(i)}
            title={HANDLE_LABELS[i]}
            style={{
              position: 'absolute', left: `${x * 100}%`, top: `${y * 100}%`,
              width: 20, height: 20, marginLeft: -10, marginTop: -10,
              borderRadius: '50%', background: C.surface, border: `3px solid ${C.purple}`,
              cursor: draggingIndex === i ? 'grabbing' : 'grab', touchAction: 'none',
            }}
          />
        ))}
      </div>

      {!valid && (
        <div style={{ fontSize: 12, color: C.red, fontFamily: F.sans, marginTop: 8 }}>
          Corners cross over each other — drag them so they form a simple, non-crossing shape around the screen.
        </div>
      )}

      <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginTop: 8, marginBottom: 16 }}>
        Drag each dot onto the actual edge of the screen in the photo.
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button type="button" onClick={onSkip} style={{ background: 'none', border: 'none', fontSize: 12, color: C.textMuted, cursor: 'pointer', fontFamily: F.sans }}>
          Skip — no clear screen edge
        </button>
        <div style={{ flex: 1 }} />
        <Btn onClick={() => onSave(corners)} disabled={!valid}>Save corners</Btn>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/components/screens/CornerMarker.test.jsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/screens/CornerMarker.jsx src/components/screens/CornerMarker.test.jsx
git commit -m "feat: add CornerMarker drag-to-mark-corners component"
```

---

### Task 5: `ScreenPhotoManager` component (extraction + corner marking)

**Files:**
- Create: `src/components/screens/ScreenPhotoManager.jsx`
- Test: `src/components/screens/ScreenPhotoManager.test.jsx`

- [ ] **Step 1: Write the failing tests**

```jsx
// src/components/screens/ScreenPhotoManager.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const uploadMock = vi.fn(() => Promise.resolve({ error: null }));
const getPublicUrlMock = vi.fn((path) => ({ data: { publicUrl: `https://cdn.test/${path}` } }));
const eqMock = vi.fn(() => Promise.resolve({ error: null }));
const updateMock = vi.fn(() => ({ eq: eqMock }));

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    storage: { from: () => ({ upload: uploadMock, getPublicUrl: getPublicUrlMock }) },
    from: () => ({ update: updateMock }),
  },
}));

import { ScreenPhotoManager } from './ScreenPhotoManager.jsx';

beforeEach(() => {
  uploadMock.mockClear();
  getPublicUrlMock.mockClear();
  updateMock.mockClear();
  eqMock.mockClear();
});

const EXISTING_URL = 'https://cdn.test/scr-1/existing.jpg';

describe('ScreenPhotoManager', () => {
  it('uploading a photo persists screen_photos and opens the corner marker for it', async () => {
    render(<ScreenPhotoManager screenId="scr-1" photos={[]} frames={[]} onChange={() => {}} />);
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ screen_photos: expect.any(Array) })));
    expect(screen.getByRole('button', { name: 'Save corners' })).toBeInTheDocument();
  });

  it('saving corners persists screen_photo_frames and calls onChange', async () => {
    const onChange = vi.fn();
    render(<ScreenPhotoManager screenId="scr-1" photos={[EXISTING_URL]} frames={[]} onChange={onChange} />);
    fireEvent.click(screen.getByTitle('Mark corners'));
    fireEvent.click(await screen.findByRole('button', { name: 'Save corners' }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ screen_photo_frames: [{ url: EXISTING_URL, corners: [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]] }] })
    ));
    expect(onChange).toHaveBeenCalledWith({ photos: [EXISTING_URL], frames: [{ url: EXISTING_URL, corners: [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]] }] });
  });

  it('skipping the corner marker persists nothing', async () => {
    render(<ScreenPhotoManager screenId="scr-1" photos={[EXISTING_URL]} frames={[]} onChange={() => {}} />);
    fireEvent.click(screen.getByTitle('Mark corners'));
    fireEvent.click(await screen.findByText('Skip — no clear screen edge'));

    expect(updateMock).not.toHaveBeenCalledWith(expect.objectContaining({ screen_photo_frames: expect.anything() }));
    expect(screen.queryByRole('button', { name: 'Save corners' })).not.toBeInTheDocument();
  });

  it('removing a photo prunes both its URL and its frame entry', async () => {
    const frames = [{ url: EXISTING_URL, corners: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]] }];
    render(<ScreenPhotoManager screenId="scr-1" photos={[EXISTING_URL]} frames={frames} onChange={() => {}} />);
    fireEvent.click(screen.getByText('×'));

    await waitFor(() => expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ screen_photos: [], screen_photo_frames: [] })
    ));
  });

  it('shows "✓ Corners" instead of "Mark corners" once a photo has a saved frame', () => {
    const frames = [{ url: EXISTING_URL, corners: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]] }];
    render(<ScreenPhotoManager screenId="scr-1" photos={[EXISTING_URL]} frames={frames} onChange={() => {}} />);
    expect(screen.getByTitle('Edit corners')).toBeInTheDocument();
    expect(screen.queryByTitle('Mark corners')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/screens/ScreenPhotoManager.test.jsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```jsx
// src/components/screens/ScreenPhotoManager.jsx
import { useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F } from '../../design/tokens.js';
import { CornerMarker } from './CornerMarker.jsx';

// Owns a screen's photos (screen_photos) and the corner-marking overlay
// that produces screen_photo_frames. Used both by the registration wizard
// (ScreenOnboard) and the operator's screen detail page (ScreenDetail) --
// previously this logic was copy-pasted between the two.
export function ScreenPhotoManager({ screenId, photos: initialPhotos, frames: initialFrames, onChange }) {
  const [photos, setPhotos] = useState(initialPhotos || []);
  const [frames, setFrames] = useState(initialFrames || []);
  const [uploading, setUploading] = useState(false);
  const [markingUrl, setMarkingUrl] = useState(null);

  const frameFor = (url) => frames.find(f => f.url === url);

  const persistPhotos = (updated) => supabase.from('screens').update({ screen_photos: updated }).eq('id', screenId);
  const persistFrames = (updated) => supabase.from('screens').update({ screen_photo_frames: updated }).eq('id', screenId);

  const handleFiles = async (files) => {
    if (photos.length >= 4) return;
    const toUpload = Array.from(files).slice(0, 4 - photos.length);
    setUploading(true);
    const newUrls = [];
    for (const file of toUpload) {
      const path = `${screenId}/${crypto.randomUUID()}`;
      const { error } = await supabase.storage.from('screen-photos').upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from('screen-photos').getPublicUrl(path);
        newUrls.push(data.publicUrl);
      }
    }
    const updated = [...photos, ...newUrls];
    setPhotos(updated);
    await persistPhotos(updated);
    onChange({ photos: updated, frames });
    setUploading(false);
    // Prompt for corners on the first newly uploaded photo -- if several
    // were uploaded at once, the rest still get the pencil affordance below.
    if (newUrls.length > 0) setMarkingUrl(newUrls[0]);
  };

  const removePhoto = async (url) => {
    const updatedPhotos = photos.filter(p => p !== url);
    const updatedFrames = frames.filter(f => f.url !== url);
    setPhotos(updatedPhotos);
    setFrames(updatedFrames);
    await supabase.from('screens').update({ screen_photos: updatedPhotos, screen_photo_frames: updatedFrames }).eq('id', screenId);
    onChange({ photos: updatedPhotos, frames: updatedFrames });
    if (markingUrl === url) setMarkingUrl(null);
  };

  const saveFrame = async (url, corners) => {
    const updated = [...frames.filter(f => f.url !== url), { url, corners }];
    setFrames(updated);
    await persistFrames(updated);
    onChange({ photos, frames: updated });
    setMarkingUrl(null);
  };

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>
        Add photos of your screen
      </div>
      <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginBottom: 12 }}>
        Advertisers use these to verify placement before booking, and can preview their ad on any photo with marked corners. Up to 4 photos.
      </div>

      {photos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          {photos.map((url, i) => (
            <div key={url} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
              <img src={url} alt={`Screen photo ${i + 1}`} style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }} />
              <button onClick={() => removePhoto(url)} style={{
                position: 'absolute', top: 4, right: 4,
                background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%',
                width: 22, height: 22, color: '#fff', cursor: 'pointer', fontSize: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
              }}>×</button>
              <button
                onClick={() => setMarkingUrl(url)}
                title={frameFor(url) ? 'Edit corners' : 'Mark corners'}
                style={{
                  position: 'absolute', bottom: 4, left: 4,
                  background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 6,
                  color: '#fff', cursor: 'pointer', fontSize: 10, fontFamily: F.sans, padding: '3px 7px',
                }}
              >
                {frameFor(url) ? '✓ Corners' : '✏ Mark corners'}
              </button>
            </div>
          ))}
        </div>
      )}

      {photos.length < 4 && (
        <label style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `2px dashed ${C.border}`, borderRadius: 10, padding: '20px',
          cursor: uploading ? 'default' : 'pointer', background: C.surfaceAlt,
          fontSize: 13, color: C.textSub, fontFamily: F.sans, gap: 8,
        }}>
          <input type="file" accept="image/*" multiple style={{ display: 'none' }}
            disabled={uploading}
            onChange={e => handleFiles(e.target.files)} />
          {uploading ? 'Uploading…' : '+ Add photos'}
        </label>
      )}

      {markingUrl && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: C.surface, borderRadius: 14, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 24px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: F.sans }}>Mark the screen's corners</div>
              <button onClick={() => setMarkingUrl(null)} style={{ background: 'none', border: 'none', fontSize: 20, color: C.textMuted, cursor: 'pointer' }}>×</button>
            </div>
            <CornerMarker
              photoUrl={markingUrl}
              initialCorners={frameFor(markingUrl)?.corners ?? null}
              onSave={(corners) => saveFrame(markingUrl, corners)}
              onSkip={() => setMarkingUrl(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/components/screens/ScreenPhotoManager.test.jsx
```

Expected: PASS. (The "removing a photo" test's `×` selector also matches the corner-marker modal's close button when open — the test doesn't open the marker, so only the one photo-remove `×` exists at that point.)

- [ ] **Step 5: Commit**

```bash
git add src/components/screens/ScreenPhotoManager.jsx src/components/screens/ScreenPhotoManager.test.jsx
git commit -m "feat: add ScreenPhotoManager (photo upload + corner marking)"
```

---

### Task 6: Wire `ScreenPhotoManager` into `ScreenOnboard.jsx`

**Files:**
- Modify: `src/views/operator/ScreenOnboard.jsx`

- [ ] **Step 1: Remove the local `PhotoUpload` function**

Delete the entire `PhotoUpload` function (currently `src/views/operator/ScreenOnboard.jsx:488-558` — from `function PhotoUpload({ screen }) {` through its closing `}`).

- [ ] **Step 2: Import `ScreenPhotoManager`**

```js
// Add near the top with the other component imports
import { ScreenPhotoManager } from '../../components/screens/ScreenPhotoManager.jsx';
```

- [ ] **Step 3: Replace the `<PhotoUpload>` usage in `StepSetup`**

Find (in `StepSetup`):
```jsx
        <PhotoUpload screen={screen} />
```
Replace with:
```jsx
        <div style={{ marginBottom: 28, paddingBottom: 28, borderBottom: `1px solid ${C.border}` }}>
          <ScreenPhotoManager
            screenId={screen.id}
            photos={screen.screen_photos || []}
            frames={screen.screen_photo_frames || []}
            onChange={() => {}}
          />
        </div>
```

- [ ] **Step 4: Confirm existing tests still pass**

```bash
npx vitest run src/lib/screenGoLive.test.js
```

There's no dedicated `ScreenOnboard` test file today; this confirms the module the wizard depends on (`checkAndGoLive`) is untouched. Also run a full build to catch any syntax/import error from the edit:

```bash
npx vite build
```

Expected: PASS / build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/views/operator/ScreenOnboard.jsx
git commit -m "refactor: use shared ScreenPhotoManager in screen registration wizard"
```

---

### Task 7: Wire `ScreenPhotoManager` into `ScreenDetail.jsx`

**Files:**
- Modify: `src/views/operator/ScreenDetail.jsx`

- [ ] **Step 1: Remove the inline photo state and handlers from `DetailsTab`**

Delete these from `DetailsTab` (currently `src/views/operator/ScreenDetail.jsx:64-128`):
- `const [photos, setPhotos] = useState(screen.screen_photos || []);`
- `const [uploading, setUploading] = useState(false);`
- `const handleUpload = async (files) => { ... };`
- `const removePhoto = async (url) => { ... };`

Keep the rest of `DetailsTab` (the `fields`/`saving`/`msg` state and `handleSave`) unchanged.

- [ ] **Step 2: Import `ScreenPhotoManager`**

```js
// Add near the top with the other component imports
import { ScreenPhotoManager } from '../../components/screens/ScreenPhotoManager.jsx';
```

- [ ] **Step 3: Replace the Photos `<Card>` block**

Find the `{/* Photos */}` `<Card>` block (currently lines 133-170) and replace its contents:

```jsx
      {/* Photos */}
      <Card style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>Photos</div>
        <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginBottom: 16 }}>
          Advertisers see these before booking, and can preview their ad on any photo with marked corners. Up to 4 photos.
        </div>
        <ScreenPhotoManager
          screenId={screen.id}
          photos={screen.screen_photos || []}
          frames={screen.screen_photo_frames || []}
          onChange={({ photos, frames }) => onSaved?.({ ...screen, screen_photos: photos, screen_photo_frames: frames })}
        />
      </Card>
```

(`ScreenPhotoManager` renders its own "Add photos of your screen" heading/description internally — drop the old block's duplicate heading so it isn't shown twice; the `Card`'s own "Photos" heading above stays as the tab-level label, matching the tab's existing "Venue Details" card pattern below it.)

- [ ] **Step 4: Verify the build**

```bash
npx vite build
```

Expected: build succeeds, no unused-variable lint errors for the removed `photos`/`uploading` state.

- [ ] **Step 5: Commit**

```bash
git add src/views/operator/ScreenDetail.jsx
git commit -m "refactor: use shared ScreenPhotoManager in screen detail page"
```

---

### Task 8: `AdRenderPreviewModal` component

**Files:**
- Create: `src/components/shared/AdRenderPreviewModal.jsx`
- Test: `src/components/shared/AdRenderPreviewModal.test.jsx`

- [ ] **Step 1: Write the failing tests**

```jsx
// src/components/shared/AdRenderPreviewModal.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdRenderPreviewModal } from './AdRenderPreviewModal.jsx';

const PHOTOS = [
  { url: 'https://example.com/a.jpg', corners: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]] },
  { url: 'https://example.com/b.jpg', corners: [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]] },
];

describe('AdRenderPreviewModal', () => {
  it('shows the screen name and a thumbnail strip when there are multiple marked photos', () => {
    render(<AdRenderPreviewModal screenName="Corner Brew" markedPhotos={PHOTOS} mediaUrl="https://example.com/ad.png" mediaType="image" onClose={() => {}} />);
    expect(screen.getByText('Corner Brew')).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: /Photo \d/ })).toHaveLength(2);
  });

  it('does not show a thumbnail strip with only one marked photo', () => {
    render(<AdRenderPreviewModal screenName="Corner Brew" markedPhotos={[PHOTOS[0]]} mediaUrl="https://example.com/ad.png" mediaType="image" onClose={() => {}} />);
    expect(screen.queryByRole('img', { name: /Photo \d/ })).not.toBeInTheDocument();
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(<AdRenderPreviewModal screenName="Corner Brew" markedPhotos={PHOTOS} mediaUrl="https://example.com/ad.png" mediaType="image" onClose={onClose} />);
    fireEvent.click(container.firstChild);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the × button is clicked', () => {
    const onClose = vi.fn();
    render(<AdRenderPreviewModal screenName="Corner Brew" markedPhotos={PHOTOS} mediaUrl="https://example.com/ad.png" mediaType="image" onClose={onClose} />);
    fireEvent.click(screen.getByText('×'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/shared/AdRenderPreviewModal.test.jsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```jsx
// src/components/shared/AdRenderPreviewModal.jsx
import { useState } from 'react';
import { C, F } from '../../design/tokens.js';
import { AdRenderPreview } from './AdRenderPreview.jsx';

// Modal shell around AdRenderPreview -- lets the advertiser switch between
// a screen's marked photos (if it has more than one) while previewing.
export function AdRenderPreviewModal({ screenName, markedPhotos, mediaUrl, mediaType, onClose }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = markedPhotos[activeIndex];

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
      onClick={onClose}
    >
      <div
        style={{ background: C.surface, borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 24px 60px rgba(0,0,0,0.15)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: F.sans }}>{screenName}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: C.textMuted, cursor: 'pointer' }}>×</button>
        </div>

        <AdRenderPreview photoUrl={active.url} corners={active.corners} mediaUrl={mediaUrl} mediaType={mediaType} />

        {markedPhotos.length > 1 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {markedPhotos.map((p, i) => (
              <button
                key={p.url}
                onClick={() => setActiveIndex(i)}
                style={{
                  width: 56, height: 40, borderRadius: 6, overflow: 'hidden', padding: 0, cursor: 'pointer',
                  border: `2px solid ${i === activeIndex ? C.purple : C.border}`, background: 'none',
                }}
              >
                <img src={p.url} alt={`Photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </button>
            ))}
          </div>
        )}

        <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 12, lineHeight: 1.5 }}>
          Approximate preview — actual on-screen appearance depends on your display's brightness, viewing angle, and ambient light.
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/components/shared/AdRenderPreviewModal.test.jsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/AdRenderPreviewModal.jsx src/components/shared/AdRenderPreviewModal.test.jsx
git commit -m "feat: add AdRenderPreviewModal (photo switcher + preview shell)"
```

---

### Task 9: Wire the Preview button into `ScreenPickerCard.jsx`

**Files:**
- Modify: `src/views/advertiser/createCampaign/ScreenPickerCard.jsx`
- Test: `src/views/advertiser/createCampaign/ScreenPickerCard.test.jsx`

- [ ] **Step 1: Write the failing tests**

```jsx
// src/views/advertiser/createCampaign/ScreenPickerCard.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScreenPickerCard } from './ScreenPickerCard.jsx';

const BASE_SCREEN = {
  id: 'scr-1', name: 'Corner Brew — King St', city: 'Toronto', environment: 'indoor',
  impressions: 84200, venue_category: 'cafe',
  screen_photos: ['https://example.com/a.jpg'],
};
const MARKED = {
  ...BASE_SCREEN,
  screen_photo_frames: [{ url: 'https://example.com/a.jpg', corners: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]] }],
};
const IMAGE_CREATIVE = { media_url: 'https://example.com/ad.png', media_type: 'image' };
const NO_CREATIVE = { media_url: '', media_type: '' };

describe('ScreenPickerCard preview button', () => {
  it('shows no Preview button when the screen has no marked photos', () => {
    render(<ScreenPickerCard screen={BASE_SCREEN} selected={[]} onToggle={() => {}} creative={IMAGE_CREATIVE} />);
    expect(screen.queryByText('👁 Preview')).not.toBeInTheDocument();
  });

  it('shows a disabled Preview button when marked but no creative is uploaded yet', () => {
    render(<ScreenPickerCard screen={MARKED} selected={[]} onToggle={() => {}} creative={NO_CREATIVE} />);
    expect(screen.getByText('👁 Preview')).toBeDisabled();
  });

  it('opens the preview modal when clicked with a marked photo and an uploaded creative', () => {
    render(<ScreenPickerCard screen={MARKED} selected={[]} onToggle={() => {}} creative={IMAGE_CREATIVE} />);
    fireEvent.click(screen.getByText('👁 Preview'));
    expect(screen.getByText(/Approximate preview/)).toBeInTheDocument();
  });

  it('clicking Preview does not toggle the card selection', () => {
    const onToggle = vi.fn();
    render(<ScreenPickerCard screen={MARKED} selected={[]} onToggle={onToggle} creative={IMAGE_CREATIVE} />);
    fireEvent.click(screen.getByText('👁 Preview'));
    expect(onToggle).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/views/advertiser/createCampaign/ScreenPickerCard.test.jsx
```

Expected: FAIL — no "👁 Preview" text rendered yet.

- [ ] **Step 3: Write the implementation**

```jsx
// src/views/advertiser/createCampaign/ScreenPickerCard.jsx
import { useState } from 'react';
import { C, F } from '../../../design/tokens.js';
import { AdRenderPreviewModal } from '../../../components/shared/AdRenderPreviewModal.jsx';

export function ScreenPickerCard({ screen, selected, onToggle, creative }) {
  const [showPreview, setShowPreview] = useState(false);
  const firstPhoto = screen.screen_photos?.[0];
  const venueLabel = screen.venue_subtype || screen.venue_category;
  const isSelected = selected.includes(screen.id);

  const markedPhotos = (screen.screen_photo_frames ?? []).filter(f => screen.screen_photos?.includes(f.url));
  const canPreview = markedPhotos.length > 0;
  const hasCreativeMedia = Boolean(creative?.media_url);

  return (
    <div
      onClick={() => onToggle(screen.id)}
      style={{
        border: `2px solid ${isSelected ? C.purple : C.border}`,
        borderRadius: 10, overflow: 'hidden', cursor: 'pointer',
        background: isSelected ? C.purpleSoft : C.surface,
        transition: 'all 0.15s', position: 'relative',
      }}
    >
      {firstPhoto && (
        <div style={{ position: 'relative' }}>
          <img src={firstPhoto} alt={screen.name} style={{ width: '100%', height: 72, objectFit: 'cover', display: 'block' }} />
          {canPreview && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); if (hasCreativeMedia) setShowPreview(true); }}
              disabled={!hasCreativeMedia}
              title={hasCreativeMedia ? 'Preview your ad on this screen' : 'Upload your creative to preview'}
              style={{
                position: 'absolute', bottom: 6, right: 6,
                padding: '4px 9px', borderRadius: 14, border: 'none',
                background: hasCreativeMedia ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.35)',
                color: '#fff', fontSize: 11, fontFamily: F.sans,
                cursor: hasCreativeMedia ? 'pointer' : 'not-allowed',
              }}
            >
              👁 Preview
            </button>
          )}
        </div>
      )}
      <div style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.sans, lineHeight: 1.3 }}>{screen.name}</div>
          <div style={{
            width: 18, height: 18, borderRadius: 4, border: `2px solid ${isSelected ? C.purple : C.border}`,
            background: isSelected ? C.purple : 'transparent', flexShrink: 0, marginLeft: 8, marginTop: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {isSelected && <span style={{ color: '#fff', fontSize: 11, lineHeight: 1 }}>✓</span>}
          </div>
        </div>
        <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 2 }}>
          {screen.city}{screen.environment ? ` · ${screen.environment === 'indoor' ? 'Indoor' : 'Outdoor'}` : ''}
        </div>
        {venueLabel && (
          <span style={{ display: 'inline-block', marginTop: 6, fontSize: 10, fontWeight: 600, background: C.blueSoft, color: C.blue, padding: '1px 7px', borderRadius: 10, fontFamily: F.sans }}>
            {venueLabel}
          </span>
        )}
        <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 4 }}>
          ~{screen.impressions > 0 ? `${(screen.impressions / 1000).toFixed(0)}K impr/mo` : 'No data yet'}
        </div>
      </div>

      {showPreview && (
        <AdRenderPreviewModal
          screenName={screen.name}
          markedPhotos={markedPhotos}
          mediaUrl={creative.media_url}
          mediaType={creative.media_type}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/views/advertiser/createCampaign/ScreenPickerCard.test.jsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/views/advertiser/createCampaign/ScreenPickerCard.jsx src/views/advertiser/createCampaign/ScreenPickerCard.test.jsx
git commit -m "feat: add ad render Preview button to ScreenPickerCard"
```

---

### Task 10: Wire the right creative into each card from `StepCreative.jsx`

**Files:**
- Modify: `src/views/advertiser/createCampaign/StepCreative.jsx`
- Test: `src/views/advertiser/createCampaign/StepCreative.creativeForScreen.test.jsx`

- [ ] **Step 1: Write the failing tests**

```jsx
// src/views/advertiser/createCampaign/StepCreative.creativeForScreen.test.jsx
// Dedicated coverage for which creative StepCreative hands each
// ScreenPickerCard for the ad-render preview button.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../lib/supabase.js', () => ({
  supabase: { storage: { from: vi.fn() } },
}));
vi.mock('../../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { id: 'u-1' } }),
}));

import { StepCreative } from './StepCreative.jsx';
import { makeBlankCreative } from '../../../lib/creativeAssignment.js';

const SCREEN_A = {
  id: 'scr-1', name: 'Corner Brew — Oxford St', city: 'London', environment: 'indoor',
  impressions: 84200, resolution_w: 1920, resolution_h: 1080, accepted_formats: ['jpg', 'mp4'], max_file_mb: 50,
  screen_photos: ['https://example.com/a.jpg'],
  screen_photo_frames: [{ url: 'https://example.com/a.jpg', corners: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]] }],
};
const SCREEN_B = {
  id: 'scr-2', name: 'Canary Wharf Plaza', city: 'London', environment: 'outdoor',
  impressions: 210000, resolution_w: 1080, resolution_h: 1920, accepted_formats: ['jpg', 'mp4'], max_file_mb: 50,
};

describe('StepCreative creative-per-screen wiring', () => {
  it('gives every screen the single default creative when there is only one', () => {
    const form = {
      selected_screen_ids: [SCREEN_A.id],
      env_filter: 'any', duration: 15,
      creatives: [makeBlankCreative({ id: 'c1', media_url: 'https://example.com/ad.png', media_type: 'image' })],
    };
    render(<StepCreative form={form} setForm={() => {}} matchedScreens={[SCREEN_A, SCREEN_B]} />);
    expect(screen.getByText('👁 Preview')).toBeEnabled();
  });

  it('falls back to the first creative for a screen no creative has explicitly claimed', () => {
    const c1 = makeBlankCreative({ id: 'c1', media_url: 'https://example.com/ad1.png', media_type: 'image', assigned_screen_ids: [] });
    const c2 = makeBlankCreative({ id: 'c2', media_url: 'https://example.com/ad2.png', media_type: 'image', assigned_screen_ids: [] });
    const form = {
      selected_screen_ids: [SCREEN_A.id],
      env_filter: 'any', duration: 15,
      creatives: [c1, c2],
    };
    render(<StepCreative form={form} setForm={() => {}} matchedScreens={[SCREEN_A, SCREEN_B]} />);
    // SCREEN_A is unassigned in this multi-creative campaign -- falls back
    // to creatives[0] (c1), which has media, so Preview is enabled.
    expect(screen.getByText('👁 Preview')).toBeEnabled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/views/advertiser/createCampaign/StepCreative.creativeForScreen.test.jsx
```

Expected: FAIL — `ScreenPickerCard` never receives `creative`, so no "👁 Preview" button renders.

- [ ] **Step 3: Add `creativeForScreen` and pass it down**

In `src/views/advertiser/createCampaign/StepCreative.jsx`, after the existing `const unassigned = ...` line, add:

```js
  const creativeForScreen = (screenId) => {
    if (!isMulti) return creatives[0];
    return creatives.find(c => c.assigned_screen_ids.includes(screenId)) ?? creatives[0];
  };
```

Then update the screens grid:

```jsx
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 28 }}>
            {matchedScreens.map(s => (
              <ScreenPickerCard key={s.id} screen={s} selected={form.selected_screen_ids} onToggle={toggleScreen} creative={creativeForScreen(s.id)} />
            ))}
          </div>
```

(This only changes the `ScreenPickerCard` line to add `creative={creativeForScreen(s.id)}` — everything else in that block is unchanged.)

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/views/advertiser/createCampaign/StepCreative.creativeForScreen.test.jsx src/views/advertiser/createCampaign/StepCreative.smoke.test.jsx
```

Expected: PASS for both files (the pre-existing smoke test must still pass unmodified).

- [ ] **Step 5: Commit**

```bash
git add src/views/advertiser/createCampaign/StepCreative.jsx src/views/advertiser/createCampaign/StepCreative.creativeForScreen.test.jsx
git commit -m "feat: pass each screen's assigned creative to its picker card"
```

---

### Task 11: Expose `screen_photo_frames` to the advertiser dashboard query

**Files:**
- Modify: `src/App.jsx:164`

- [ ] **Step 1: Add the column to the explicit select list**

Find (in `src/App.jsx`, inside the `useEffect` that loads dashboard data):

```js
      supabase.from('advertiser_screens').select('id,name,owner_name,owner_type,city,state,country,location,status,lat,lon,venue_category,venue_subtype,environment,screen_position,display_size,monthly_traffic_estimate,cpm_floor,operating_hours_start,operating_hours_end,auto_approve,screen_photos,content_categories_blocked,timezone,max_ad_duration,operator_id,last_seen,health_status,resolution_w,resolution_h,accepted_formats,max_file_mb').order('name'),
```

Replace with (only the select-string change: `screen_photos` becomes `screen_photos,screen_photo_frames`):

```js
      supabase.from('advertiser_screens').select('id,name,owner_name,owner_type,city,state,country,location,status,lat,lon,venue_category,venue_subtype,environment,screen_position,display_size,monthly_traffic_estimate,cpm_floor,operating_hours_start,operating_hours_end,auto_approve,screen_photos,screen_photo_frames,content_categories_blocked,timezone,max_ad_duration,operator_id,last_seen,health_status,resolution_w,resolution_h,accepted_formats,max_file_mb').order('name'),
```

This is exactly the class of bug the `20260727000002` migration's comment documents (a view column that exists but was never added to this explicit select list, so the frontend never sees it) — don't repeat it.

- [ ] **Step 2: Verify the build**

```bash
npx vite build
```

Expected: build succeeds (this is a string literal change with no type surface to break).

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "fix: include screen_photo_frames in advertiser_screens dashboard query"
```

---

### Task 12: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

```bash
npx vitest run
```

Expected: PASS — every test file green, including all new files from Tasks 2–10 and every pre-existing test (especially `CreativeCard.test.jsx`, `StepCreative.smoke.test.jsx`, `screenGoLive.test.js`).

- [ ] **Step 2: Run the linter**

```bash
npm run lint
```

Expected: no errors (in particular: no unused-variable warnings from the `ScreenOnboard.jsx`/`ScreenDetail.jsx` extractions in Tasks 6–7).

- [ ] **Step 3: Run a production build**

```bash
npm run build
```

Expected: build succeeds with no import errors.

- [ ] **Step 4: Manual smoke check (optional but recommended before merging)**

Using the `run` skill or a local dev server: register a new screen, upload a photo, mark its corners, save; then as an advertiser start a campaign, upload a creative, and confirm the "👁 Preview" button appears on that screen's card and opens a modal showing the creative warped onto the photo.

- [ ] **Step 5: Final commit (only if Steps 1-3 required fixes)**

```bash
git add -A
git commit -m "chore: fix verification issues from ad render preview implementation"
```
