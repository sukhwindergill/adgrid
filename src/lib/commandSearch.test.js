import { describe, it, expect } from 'vitest';
import { rankMatches } from './commandSearch.js';

const items = ['Alerts & Rules', 'Analytics', 'Live Signals', 'Campaigns', 'Approval Queue'];
const rank = q => rankMatches(q, items, x => x);

describe('rankMatches', () => {
  it('returns everything for an empty query', () => {
    expect(rank('')).toEqual(items);
  });

  it('puts whole-string prefixes before word prefixes before substrings', () => {
    expect(rank('a')[0]).toBe('Alerts & Rules');
    expect(rank('sig')).toEqual(['Live Signals']);
    expect(rank('ign')).toEqual(['Live Signals', 'Campaigns']);
  });

  it('is case-insensitive and drops non-matches', () => {
    expect(rank('QUEUE')).toEqual(['Approval Queue']);
    expect(rank('zzz')).toEqual([]);
  });
});
