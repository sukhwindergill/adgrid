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
