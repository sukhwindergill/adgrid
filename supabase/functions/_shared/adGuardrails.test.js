import { describe, it, expect } from 'vitest';
import {
  isCategoryBlocked,
  dropBlockedCategories,
  applyFrequencyCap,
  isCompetitiveClash,
  separateCompetitors,
} from './adGuardrails.ts';

const ids = (list) => list.map((e) => e.id);

function hasAdjacentClash(loop) {
  if (loop.length < 2) return false;
  return loop.some((e, i) => isCompetitiveClash(e, loop[(i + 1) % loop.length]));
}

describe('isCategoryBlocked', () => {
  it('matches case-insensitively and ignores null categories', () => {
    expect(isCategoryBlocked('Alcohol', [' alcohol'])).toBe(true);
    expect(isCategoryBlocked(null, ['Alcohol'])).toBe(false);
    expect(isCategoryBlocked('Alcohol', null)).toBe(false);
  });
});

describe('dropBlockedCategories', () => {
  it("removes entries whose category the screen excludes", () => {
    const entries = [
      { id: 'a', category: 'Alcohol' },
      { id: 'b', category: 'Technology' },
      { id: 'c', category: null },
      { id: 'd', category: 'gambling' },
    ];
    expect(ids(dropBlockedCategories(entries, ['Alcohol', 'Gambling']))).toEqual(['b', 'c']);
  });
  it('returns the input untouched when nothing is blocked', () => {
    const entries = [{ id: 'a', category: 'Alcohol' }];
    expect(dropBlockedCategories(entries, [])).toBe(entries);
    expect(dropBlockedCategories(entries, null)).toBe(entries);
  });
});

describe('applyFrequencyCap', () => {
  it('leaves uncapped campaigns alone', () => {
    const entries = [{ id: 'a' }, { id: 'a' }, { id: 'b', frequency_cap_per_hour: null }];
    expect(applyFrequencyCap(entries, new Map([['a', 999]]))).toEqual(entries);
  });

  it('drops a campaign that already hit its cap this hour', () => {
    const entries = [{ id: 'a', frequency_cap_per_hour: 4 }, { id: 'b' }];
    expect(ids(applyFrequencyCap(entries, new Map([['a', 4]])))).toEqual(['b']);
    expect(ids(applyFrequencyCap(entries, new Map([['a', 9]])))).toEqual(['b']);
  });

  it('keeps only the remaining plays for a campaign under its cap', () => {
    const entries = [
      { id: 'a', frequency_cap_per_hour: 3, creative_id: 'c1' },
      { id: 'b' },
      { id: 'a', frequency_cap_per_hour: 3, creative_id: 'c2' },
      { id: 'a', frequency_cap_per_hour: 3, creative_id: 'c3' },
    ];
    const out = applyFrequencyCap(entries, new Map([['a', 1]]));
    expect(out.map((e) => e.creative_id ?? e.id)).toEqual(['c1', 'b', 'c2']);
  });

  it('treats no recorded plays as zero', () => {
    const entries = [{ id: 'a', frequency_cap_per_hour: 1 }, { id: 'a', frequency_cap_per_hour: 1 }];
    expect(applyFrequencyCap(entries, new Map())).toHaveLength(1);
  });
});

describe('isCompetitiveClash', () => {
  it('is a clash for same category, different advertisers', () => {
    expect(isCompetitiveClash({ category: 'Automotive', advertiser_id: 'x' }, { category: 'automotive', advertiser_id: 'y' })).toBe(true);
  });
  it('is not a clash for the same advertiser', () => {
    expect(isCompetitiveClash({ category: 'Automotive', advertiser_id: 'x' }, { category: 'Automotive', advertiser_id: 'x' })).toBe(false);
  });
  it('is not a clash when either side has no category', () => {
    expect(isCompetitiveClash({ category: null, advertiser_id: 'x' }, { category: null, advertiser_id: 'y' })).toBe(false);
  });
});

describe('separateCompetitors', () => {
  it('keeps order when nothing clashes', () => {
    const loop = [
      { id: 'a', category: 'Auto', advertiser_id: '1' },
      { id: 'b', category: 'Food', advertiser_id: '2' },
      { id: 'c', category: 'Auto', advertiser_id: '3' },
      { id: 'd', category: 'Tech', advertiser_id: '4' },
    ];
    expect(ids(separateCompetitors(loop))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('pulls a non-competing ad between two competitors', () => {
    const loop = [
      { id: 'a', category: 'Auto', advertiser_id: '1' },
      { id: 'b', category: 'Auto', advertiser_id: '2' },
      { id: 'c', category: 'Food', advertiser_id: '3' },
      { id: 'd', category: 'Tech', advertiser_id: '4' },
    ];
    const out = separateCompetitors(loop);
    expect(ids(out)).toEqual(['a', 'c', 'b', 'd']);
    expect(hasAdjacentClash(out)).toBe(false);
  });

  it('drops a competitor in a 3-ad loop, where every pair is adjacent', () => {
    const loop = [
      { id: 'a', category: 'Auto', advertiser_id: '1' },
      { id: 'b', category: 'Auto', advertiser_id: '2' },
      { id: 'c', category: 'Food', advertiser_id: '3' },
    ];
    const out = separateCompetitors(loop);
    expect(ids(out)).toEqual(['a', 'c']);
  });

  it('rotates which competitor sits out so none is starved forever', () => {
    const loop = [
      { id: 'a', category: 'Auto', advertiser_id: '1' },
      { id: 'b', category: 'Auto', advertiser_id: '2' },
      { id: 'c', category: 'Food', advertiser_id: '3' },
    ];
    const aired = new Set();
    for (let minute = 0; minute < 3; minute++) {
      const out = separateCompetitors(loop, minute);
      expect(hasAdjacentClash(out)).toBe(false);
      ids(out).forEach((id) => aired.add(id));
    }
    expect([...aired].sort()).toEqual(['a', 'b', 'c']);
  });

  it('ignores rotation when nothing needs dropping', () => {
    const loop = [
      { id: 'a', category: 'Auto', advertiser_id: '1' },
      { id: 'b', category: 'Food', advertiser_id: '2' },
    ];
    expect(ids(separateCompetitors(loop, 7))).toEqual(['a', 'b']);
  });

  it('allows one advertiser’s own creatives back to back', () => {
    const loop = [
      { id: 'a', creative_id: 'c1', category: 'Auto', advertiser_id: '1' },
      { id: 'a', creative_id: 'c2', category: 'Auto', advertiser_id: '1' },
    ];
    expect(separateCompetitors(loop)).toEqual(loop);
  });

  it('drops an entry that can only sit next to a competitor', () => {
    const loop = [
      { id: 'a', category: 'Auto', advertiser_id: '1' },
      { id: 'b', category: 'Auto', advertiser_id: '2' },
    ];
    const out = separateCompetitors(loop);
    expect(out).toHaveLength(1);
    expect(hasAdjacentClash(out)).toBe(false);
  });

  it('checks the loop wrap-around (last plays before first)', () => {
    const loop = [
      { id: 'a', category: 'Auto', advertiser_id: '1' },
      { id: 'b', category: 'Food', advertiser_id: '2' },
      { id: 'c', category: 'Auto', advertiser_id: '3' },
    ];
    const out = separateCompetitors(loop);
    expect(hasAdjacentClash(out)).toBe(false);
  });

  it('never emits an adjacent clash for random loops', () => {
    let seed = 42;
    const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    const cats = ['Auto', 'Food', null];
    for (let run = 0; run < 300; run++) {
      const n = 1 + Math.floor(rand() * 9);
      const loop = Array.from({ length: n }, (_, i) => ({
        id: `e${i}`,
        category: cats[Math.floor(rand() * cats.length)],
        advertiser_id: `adv${Math.floor(rand() * 4)}`,
      }));
      const out = separateCompetitors(loop);
      expect(hasAdjacentClash(out)).toBe(false);
      // Output is a subset of the input -- nothing invented or duplicated.
      expect(new Set(ids(out)).size).toBe(out.length);
      for (const e of out) expect(loop).toContain(e);
    }
  });
});
