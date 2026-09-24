import { describe, it, expect, vi } from 'vitest';
import { summarizePublicScreens, fetchPublicScreens } from './publicScreens.js';

describe('summarizePublicScreens', () => {
  it('rolls rows up by city, venue label and price range', () => {
    const s = summarizePublicScreens([
      { city: 'Toronto', venue_category: 'fitness', cpm_floor: 4 },
      { city: 'Toronto', venue_category: 'food_drink', cpm_floor: '6.5' },
      { city: 'Vancouver', venue_category: 'fitness', cpm_floor: 3 },
      { city: null, venue_category: 'nonsense', cpm_floor: null },
    ]);
    expect(s.cities).toEqual([{ name: 'Toronto', count: 2 }, { name: 'Vancouver', count: 1 }]);
    expect(s.venues[0]).toEqual({ name: 'Fitness & Wellness', count: 2 });
    expect(s.venues.map(v => v.name)).toContain('Other');
    expect(s.cpmRange).toEqual({ min: 3, max: 6.5 });
  });

  it('handles no rows', () => {
    expect(summarizePublicScreens([])).toEqual({ cities: [], venues: [], cpmRange: null });
  });
});

describe('fetchPublicScreens', () => {
  it('only calls the anon-safe RPCs', async () => {
    const rpc = vi.fn(name => Promise.resolve({ data: name === 'live_screen_count' ? 30 : [{ city: 'Toronto' }], error: null }));
    const from = vi.fn();
    const r = await fetchPublicScreens({ rpc, from });
    expect(rpc.mock.calls.map(c => c[0]).sort()).toEqual(['live_screen_count', 'public_screen_map']);
    expect(from).not.toHaveBeenCalled();
    expect(r).toEqual({ count: 30, rows: [{ city: 'Toronto' }] });
  });

  it('throws when either RPC fails', async () => {
    const rpc = vi.fn(name => Promise.resolve(name === 'public_screen_map' ? { data: null, error: new Error('x') } : { data: 1, error: null }));
    await expect(fetchPublicScreens({ rpc })).rejects.toThrow('x');
  });
});
