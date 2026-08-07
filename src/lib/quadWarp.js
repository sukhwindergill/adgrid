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
