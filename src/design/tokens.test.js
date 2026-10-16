import { describe, it, expect } from 'vitest';
import { C, T, alpha, readable } from './tokens.js';

// WCAG 2.x relative luminance / contrast ratio.
function luminance(hex) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

describe('design tokens', () => {
  it.each([
    ['greenText', 'greenSoft'], ['amberText', 'amberSoft'], ['redText', 'redSoft'], ['blueText', 'blueSoft'],
    ['greenText', 'surface'], ['amberText', 'surface'], ['redText', 'surface'], ['blueText', 'surface'],
    ['amberText', 'amberWash'],
    ['textMuted', 'surface'], ['textMuted', 'bg'], ['textMuted', 'surfaceAlt'], ['textMuted', 'purpleSoft'],
    ['textSub', 'surfaceAlt'], ['purple', 'purpleSoft'],
    ['white', 'purple'], ['white', 'purpleDark'], ['white', 'redStrong'],
  ])('%s on %s meets WCAG AA for body text', (fg, bg) => {
    expect(contrast(C[fg], C[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it('readable() swaps status fills for their text tokens and passes others through', () => {
    expect(readable(C.green)).toBe(C.greenText);
    expect(readable(C.amber)).toBe(C.amberText);
    expect(readable(C.red)).toBe(C.redText);
    expect(readable(C.blue)).toBe(C.blueText);
    expect(readable(C.text)).toBe(C.text);
  });

  it('alpha() builds rgba from hex', () => {
    expect(alpha('#7B2FFF', 0.12)).toBe('rgba(123,47,255,0.12)');
    expect(alpha('#fff', 0.5)).toBe('rgba(255,255,255,0.5)');
  });

  it('type scale never goes below the 11px floor', () => {
    expect(Math.min(...Object.values(T))).toBe(11);
  });
});
