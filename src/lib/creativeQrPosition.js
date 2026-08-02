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
