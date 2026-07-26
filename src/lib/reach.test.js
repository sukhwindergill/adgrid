import { describe, it, expect } from 'vitest';
import { overlapFactor, estimateReach, averageFrequency, OVERLAP_FULL_KM, OVERLAP_NONE_KM } from './reach.js';

describe('overlapFactor', () => {
  it('is total for screens in the same doorway', () => {
    expect(overlapFactor(0)).toBe(1);
    expect(overlapFactor(OVERLAP_FULL_KM)).toBe(1);
  });

  it('is zero beyond the far threshold', () => {
    expect(overlapFactor(OVERLAP_NONE_KM)).toBe(0);
    expect(overlapFactor(50)).toBe(0);
  });

  it('falls off between the thresholds', () => {
    const mid = overlapFactor((OVERLAP_FULL_KM + OVERLAP_NONE_KM) / 2);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });

  it('decreases monotonically with distance', () => {
    expect(overlapFactor(0.5)).toBeGreaterThan(overlapFactor(1.5));
  });

  it('treats an unknown distance as no overlap rather than full overlap', () => {
    // Unknown must not collapse reach to a single screen.
    expect(overlapFactor(null)).toBe(0);
    expect(overlapFactor(undefined)).toBe(0);
    expect(overlapFactor(NaN)).toBe(0);
  });
});

describe('estimateReach', () => {
  const far = [
    { screen_id: 'a', impressions: 1000, lat: 43.65, lon: -79.38 },
    { screen_id: 'b', impressions: 1000, lat: 45.50, lon: -73.57 },
  ];

  it('sums impressions when screens do not overlap', () => {
    expect(estimateReach(far).reach).toBe(2000);
  });

  it('discounts heavily when screens are on top of each other', () => {
    const near = [
      { screen_id: 'a', impressions: 1000, lat: 43.6532, lon: -79.3832 },
      { screen_id: 'b', impressions: 1000, lat: 43.6533, lon: -79.3833 },
    ];
    const r = estimateReach(near).reach;
    expect(r).toBeGreaterThanOrEqual(1000);
    expect(r).toBeLessThan(1600);
  });

  it('returns the single screen impressions for one screen', () => {
    expect(estimateReach([far[0]]).reach).toBe(1000);
  });

  it('returns 0 reach for no screens', () => {
    expect(estimateReach([]).reach).toBe(0);
    expect(estimateReach(null).reach).toBe(0);
  });

  it('never reports reach above total impressions', () => {
    const r = estimateReach(far);
    expect(r.reach).toBeLessThanOrEqual(r.impressions);
  });

  it('counts screens with unknown coordinates without collapsing them together', () => {
    const unknown = [
      { screen_id: 'a', impressions: 1000, lat: null, lon: null },
      { screen_id: 'b', impressions: 1000, lat: null, lon: null },
    ];
    expect(estimateReach(unknown).reach).toBe(2000);
  });

  it('flags whether any coordinate was missing so the UI can caveat it', () => {
    expect(estimateReach([{ screen_id: 'a', impressions: 10, lat: null, lon: null }]).hasUnknownPositions).toBe(true);
    expect(estimateReach(far).hasUnknownPositions).toBe(false);
  });

  it('reports total impressions alongside reach', () => {
    expect(estimateReach(far).impressions).toBe(2000);
  });
});

describe('averageFrequency', () => {
  it('is impressions divided by reach', () => {
    expect(averageFrequency(3000, 1000)).toBe(3);
  });

  it('is null when reach is zero', () => {
    expect(averageFrequency(3000, 0)).toBeNull();
  });

  it('is null for non-numeric input', () => {
    expect(averageFrequency(null, 1000)).toBeNull();
  });

  it('rounds to one decimal', () => {
    expect(averageFrequency(1000, 300)).toBe(3.3);
  });
});
