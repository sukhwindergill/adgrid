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
});
