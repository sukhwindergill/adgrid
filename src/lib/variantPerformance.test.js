import { describe, it, expect } from 'vitest';
import { computeVariantPerformance, NO_VARIANT_ID } from './variantPerformance.js';

const creatives = [
  { id: 'c1', label: 'Variant A' },
  { id: 'c2', label: 'Variant B' },
];

describe('computeVariantPerformance', () => {
  it('groups plays and billable scans by creative_id', () => {
    const plays = [
      { creative_id: 'c1' }, { creative_id: 'c1' }, { creative_id: 'c1' }, { creative_id: 'c1' },
      { creative_id: 'c2' }, { creative_id: 'c2' },
    ];
    const scans = [
      { creative_id: 'c1', is_bot: false, is_duplicate: false },
      { creative_id: 'c2', is_bot: false, is_duplicate: false },
    ];
    const result = computeVariantPerformance(creatives, plays, scans);
    const a = result.find((r) => r.id === 'c1');
    const b = result.find((r) => r.id === 'c2');
    expect(a.plays).toBe(4);
    expect(a.scans).toBe(1);
    expect(a.scanRate).toBeCloseTo(0.25);
    expect(b.plays).toBe(2);
    expect(b.scans).toBe(1);
    expect(b.scanRate).toBeCloseTo(0.5);
  });

  it('excludes bot and duplicate scans from the billable count', () => {
    const plays = [{ creative_id: 'c1' }];
    const scans = [
      { creative_id: 'c1', is_bot: true, is_duplicate: false },
      { creative_id: 'c1', is_bot: false, is_duplicate: true },
      { creative_id: 'c1', is_bot: false, is_duplicate: false },
    ];
    const result = computeVariantPerformance(creatives, plays, scans);
    expect(result.find((r) => r.id === 'c1').scans).toBe(1);
  });

  it('buckets plays/scans with a null creative_id under NO_VARIANT_ID', () => {
    const plays = [{ creative_id: null }, { creative_id: null }];
    const scans = [{ creative_id: null, is_bot: false, is_duplicate: false }];
    const result = computeVariantPerformance(creatives, plays, scans);
    const noVariant = result.find((r) => r.id === NO_VARIANT_ID);
    expect(noVariant).toBeTruthy();
    expect(noVariant.label).toBe('No variant');
    expect(noVariant.plays).toBe(2);
    expect(noVariant.scans).toBe(1);
  });

  it('returns a null scanRate-safe zero and null costPerScan when there are no plays', () => {
    const result = computeVariantPerformance(creatives, [], []);
    expect(result).toEqual([]);
  });

  it('apportions campaign spend across variants by share of plays', () => {
    const plays = [
      { creative_id: 'c1' }, { creative_id: 'c1' }, { creative_id: 'c1' },
      { creative_id: 'c2' },
    ];
    const scans = [
      { creative_id: 'c1', is_bot: false, is_duplicate: false },
      { creative_id: 'c2', is_bot: false, is_duplicate: false },
    ];
    const result = computeVariantPerformance(creatives, plays, scans, 100);
    const a = result.find((r) => r.id === 'c1');
    const b = result.find((r) => r.id === 'c2');
    // c1: 3/4 of plays -> 75 of spend / 1 scan = 75
    expect(a.costPerScan).toBeCloseTo(75);
    // c2: 1/4 of plays -> 25 of spend / 1 scan = 25
    expect(b.costPerScan).toBeCloseTo(25);
  });

  it('reports a null costPerScan for a variant with plays but no scans', () => {
    const plays = [{ creative_id: 'c1' }];
    const scans = [];
    const result = computeVariantPerformance(creatives, plays, scans, 50);
    expect(result.find((r) => r.id === 'c1').costPerScan).toBeNull();
  });

  it('sorts variants by play count descending', () => {
    const plays = [{ creative_id: 'c2' }, { creative_id: 'c1' }, { creative_id: 'c1' }];
    const result = computeVariantPerformance(creatives, plays, []);
    expect(result.map((r) => r.id)).toEqual(['c1', 'c2']);
  });

  it('falls back to a generic label for a creative not in the roster', () => {
    const plays = [{ creative_id: 'unknown-id' }];
    const result = computeVariantPerformance(creatives, plays, []);
    expect(result[0].label).toBe('Unknown');
  });
});
