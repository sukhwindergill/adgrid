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
