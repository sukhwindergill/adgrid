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
