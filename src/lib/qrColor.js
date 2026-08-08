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
