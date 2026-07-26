// Unique reach and average frequency.
//
// Summing impressions across screens double-counts anyone who passes several
// of them — the reason a 14-screen downtown buy overstates the people reached.
// Each screen is discounted by its overlap with screens already counted.
//
// The overlap curve is a modelled approximation, not a measurement. Anything
// derived from it must be labelled as an estimate.

import { haversineKm } from './geo.js';

export const OVERLAP_FULL_KM = 0.1;  // same block: essentially the same people
export const OVERLAP_NONE_KM = 2.0;  // beyond this: treat as distinct audiences

export function overlapFactor(distanceKm) {
  // Unknown distance means unknown overlap. Assume none: collapsing two
  // uncoordinated screens into one would understate reach dramatically.
  if (distanceKm === null || distanceKm === undefined) return 0;
  const d = Number(distanceKm);
  if (!Number.isFinite(d)) return 0;
  if (d <= OVERLAP_FULL_KM) return 1;
  if (d >= OVERLAP_NONE_KM) return 0;
  return (OVERLAP_NONE_KM - d) / (OVERLAP_NONE_KM - OVERLAP_FULL_KM);
}

export function estimateReach(screens) {
  const list = Array.isArray(screens) ? screens : [];
  const impressions = list.reduce((a, s) => a + (Number(s.impressions) || 0), 0);
  const hasUnknownPositions = list.some(
    s => !Number.isFinite(Number(s.lat)) || !Number.isFinite(Number(s.lon))
      || s.lat === null || s.lon === null
  );

  if (list.length === 0) return { reach: 0, impressions: 0, hasUnknownPositions: false };

  // Greedy: each screen contributes what it adds beyond the screens already
  // counted, discounted by its strongest overlap with any of them.
  const counted = [];
  let reach = 0;

  for (const s of list) {
    const own = Number(s.impressions) || 0;
    let strongestOverlap = 0;
    for (const prev of counted) {
      const factor = overlapFactor(haversineKm(s.lat, s.lon, prev.lat, prev.lon));
      if (factor > strongestOverlap) strongestOverlap = factor;
    }
    reach += own * (1 - strongestOverlap);
    counted.push(s);
  }

  return { reach: Math.round(reach), impressions, hasUnknownPositions };
}

export function averageFrequency(impressions, reach) {
  const i = Number(impressions);
  const r = Number(reach);
  if (impressions === null || impressions === undefined) return null;
  if (!Number.isFinite(i) || !Number.isFinite(r) || r <= 0) return null;
  return Math.round((i / r) * 10) / 10;
}
