import { describe, it, expect, vi } from 'vitest';

const mockListings = [{ id: 'l1', status: 'active', price_cents: 50000 }];

vi.mock('./supabase.js', () => ({
  supabase: {
    from: (table) => {
      if (table === 'marketplace_listings') {
        return {
          select: () => ({
            eq: () => ({ order: () => Promise.resolve({ data: mockListings, error: null }) }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  },
}));

import { fetchActiveListings } from './marketplace.js';

describe('fetchActiveListings', () => {
  it('returns active listings', async () => {
    const result = await fetchActiveListings();
    expect(result).toEqual(mockListings);
  });
});
