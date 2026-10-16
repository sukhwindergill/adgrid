import { describe, it, expect } from 'vitest';
import {
  normalizeCategory,
  isCategoryBlocked,
  partitionScreensByCategory,
  parseFrequencyCap,
  toggleBlockedCategory,
  MAX_FREQUENCY_CAP,
} from './adGuardrails.js';

describe('normalizeCategory', () => {
  it('trims and lowercases', () => {
    expect(normalizeCategory('  Alcohol ')).toBe('alcohol');
  });
  it('returns null for blank or non-string input', () => {
    expect(normalizeCategory('')).toBeNull();
    expect(normalizeCategory('   ')).toBeNull();
    expect(normalizeCategory(null)).toBeNull();
    expect(normalizeCategory(undefined)).toBeNull();
  });
});

describe('isCategoryBlocked', () => {
  it('matches case- and whitespace-insensitively', () => {
    expect(isCategoryBlocked('Alcohol', ['alcohol '])).toBe(true);
    expect(isCategoryBlocked('cannabis', ['Gambling', 'Cannabis'])).toBe(true);
  });
  it('is false when the category is not in the list', () => {
    expect(isCategoryBlocked('Technology', ['Alcohol'])).toBe(false);
  });
  it('never blocks a campaign without a category', () => {
    expect(isCategoryBlocked(null, ['Alcohol'])).toBe(false);
    expect(isCategoryBlocked('', [''])).toBe(false);
  });
  it('treats a missing blocked list as nothing blocked', () => {
    expect(isCategoryBlocked('Alcohol', null)).toBe(false);
    expect(isCategoryBlocked('Alcohol', undefined)).toBe(false);
  });
});

describe('partitionScreensByCategory', () => {
  const screens = [
    { id: 'a', content_categories_blocked: ['Alcohol'] },
    { id: 'b', content_categories_blocked: [] },
    { id: 'c', content_categories_blocked: null },
    { id: 'd', content_categories_blocked: ['Gambling', 'alcohol'] },
  ];
  it('separates screens that exclude the category', () => {
    const { allowed, blocked } = partitionScreensByCategory(screens, 'Alcohol');
    expect(allowed.map(s => s.id)).toEqual(['b', 'c']);
    expect(blocked.map(s => s.id)).toEqual(['a', 'd']);
  });
  it('allows everything for an unrestricted category', () => {
    const { allowed, blocked } = partitionScreensByCategory(screens, 'Technology');
    expect(allowed).toHaveLength(4);
    expect(blocked).toHaveLength(0);
  });
});

describe('parseFrequencyCap', () => {
  it('treats blank as no cap', () => {
    expect(parseFrequencyCap('')).toEqual({ value: null, error: null });
    expect(parseFrequencyCap('  ')).toEqual({ value: null, error: null });
    expect(parseFrequencyCap(null)).toEqual({ value: null, error: null });
  });
  it('accepts whole numbers in range', () => {
    expect(parseFrequencyCap('4')).toEqual({ value: 4, error: null });
    expect(parseFrequencyCap(12)).toEqual({ value: 12, error: null });
    expect(parseFrequencyCap(String(MAX_FREQUENCY_CAP)).value).toBe(MAX_FREQUENCY_CAP);
  });
  it('rejects zero, negatives, fractions, junk and too-large values', () => {
    for (const bad of ['0', '-3', '2.5', 'abc', String(MAX_FREQUENCY_CAP + 1)]) {
      const r = parseFrequencyCap(bad);
      expect(r.value).toBeNull();
      expect(r.error).toMatch(/whole number/);
    }
  });
});

describe('toggleBlockedCategory', () => {
  it('adds a category not yet blocked', () => {
    expect(toggleBlockedCategory(['Alcohol'], 'Cannabis')).toEqual(['Alcohol', 'Cannabis']);
  });
  it('removes a blocked category regardless of stored spelling', () => {
    expect(toggleBlockedCategory(['alcohol', 'Gambling', 'ALCOHOL '], 'Alcohol')).toEqual(['Gambling']);
  });
  it('handles a null list', () => {
    expect(toggleBlockedCategory(null, 'Gambling')).toEqual(['Gambling']);
  });
});
