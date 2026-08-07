import { describe, it, expect } from 'vitest';
import {
  solveLinearSystem,
  computeHomography,
  applyHomography,
  cssMatrix3dString,
  validateQuadOrientation,
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
