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
