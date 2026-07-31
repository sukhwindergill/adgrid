import { describe, it, expect } from 'vitest';
import { CREATIVE_ROTATION_SLOTS, expandCreativeAssignments } from './creativeSelection.ts';

describe('expandCreativeAssignments', () => {
  it('returns empty for no assignments', () => {
    expect(expandCreativeAssignments([])).toEqual([]);
  });

  it('returns a single-entry list for one assignment, regardless of weight', () => {
    expect(expandCreativeAssignments([{ creative_id: 'a', weight: 37 }])).toEqual(['a']);
  });

  it('splits two equal weights into an even, interleaved rotation', () => {
    const result = expandCreativeAssignments([
      { creative_id: 'a', weight: 50 },
      { creative_id: 'b', weight: 50 },
    ]);
    expect(result).toHaveLength(CREATIVE_ROTATION_SLOTS);
    expect(result.filter(id => id === 'a')).toHaveLength(CREATIVE_ROTATION_SLOTS / 2);
    expect(result.filter(id => id === 'b')).toHaveLength(CREATIVE_ROTATION_SLOTS / 2);
    // interleaved, not block-repeated
    expect(result).toEqual(['a', 'b', 'a', 'b', 'a', 'b', 'a', 'b', 'a', 'b']);
  });

  it('produces exact proportional counts for a 70/30 split', () => {
    const result = expandCreativeAssignments([
      { creative_id: 'a', weight: 70 },
      { creative_id: 'b', weight: 30 },
    ]);
    expect(result.filter(id => id === 'a')).toHaveLength(7);
    expect(result.filter(id => id === 'b')).toHaveLength(3);
  });

  it('guarantees every assignment appears at least once even when weights round to zero slots', () => {
    const result = expandCreativeAssignments([
      { creative_id: 'a', weight: 95 },
      { creative_id: 'b', weight: 1 },
    ]);
    expect(result.filter(id => id === 'b').length).toBeGreaterThanOrEqual(1);
  });

  it('distributes rounding remainder to the largest fractional share, keeping the total at 10', () => {
    // 33/33/34 -> shares 3.3/3.3/3.4 -> floors 3/3/3 = 9, +1 remainder goes to the 3.4 share
    const result = expandCreativeAssignments([
      { creative_id: 'a', weight: 33 },
      { creative_id: 'b', weight: 33 },
      { creative_id: 'c', weight: 34 },
    ]);
    expect(result).toHaveLength(10);
    expect(result.filter(id => id === 'c')).toHaveLength(4);
    expect(result.filter(id => id === 'a')).toHaveLength(3);
    expect(result.filter(id => id === 'b')).toHaveLength(3);
  });

  it('ignores assignments with zero, negative, or non-finite weight', () => {
    const result = expandCreativeAssignments([
      { creative_id: 'a', weight: 100 },
      { creative_id: 'b', weight: 0 },
      { creative_id: 'c', weight: -5 },
      { creative_id: 'd', weight: NaN },
    ]);
    expect(result).toEqual(['a']);
  });

  it('ignores assignments with no creative_id', () => {
    const result = expandCreativeAssignments([{ creative_id: null, weight: 100 }]);
    expect(result).toEqual([]);
  });

  it('keeps the total bounded at 10 when many low-weight assignments would otherwise force overflow', () => {
    // 1 assignment at weight 91 + 9 at weight 1 each = 10 assignments.
    // Forced Math.max(1, ...) minimums alone would previously sum past 10.
    const assignments = [
      { creative_id: 'dominant', weight: 91 },
      ...Array.from({ length: 9 }, (_, i) => ({ creative_id: `low-${i}`, weight: 1 })),
    ];
    const result = expandCreativeAssignments(assignments);
    expect(result).toHaveLength(CREATIVE_ROTATION_SLOTS);
    for (const a of assignments) {
      expect(result.filter(id => id === a.creative_id).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('never exceeds CREATIVE_ROTATION_SLOTS total when there are more assignments than slots', () => {
    // 11 equal-weight assignments cannot all fit in 10 slots; some legitimately get none.
    const assignments = Array.from({ length: 11 }, (_, i) => ({ creative_id: `c-${i}`, weight: 1 }));
    const result = expandCreativeAssignments(assignments);
    expect(result).toHaveLength(CREATIVE_ROTATION_SLOTS);
  });

  it('preserves proportionality for a skewed 5-way split while still guaranteeing a slot for everyone', () => {
    const result = expandCreativeAssignments([
      { creative_id: 'dominant', weight: 80 },
      { creative_id: 'b', weight: 5 },
      { creative_id: 'c', weight: 5 },
      { creative_id: 'd', weight: 5 },
      { creative_id: 'e', weight: 5 },
    ]);
    expect(result).toHaveLength(CREATIVE_ROTATION_SLOTS);
    const counts = ['dominant', 'b', 'c', 'd', 'e'].map(
      id => result.filter(r => r === id).length,
    );
    for (const c of counts) {
      expect(c).toBeGreaterThanOrEqual(1);
    }
    const [dominantCount, ...restCounts] = counts;
    for (const c of restCounts) {
      expect(dominantCount).toBeGreaterThan(c * 2);
    }
  });
});
