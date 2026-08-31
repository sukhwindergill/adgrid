import { describe, it, expect, vi } from 'vitest';

const insertedListing = { id: 'listing-1' };
let listingUpdateCalls = [];
let screensInsertResult = { data: null, error: null };
let getUserResult = { id: 'op-1' };

vi.mock('./supabase.js', () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: getUserResult } }) },
    from: (table) => {
      if (table === 'marketplace_listings') {
        return {
          insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: insertedListing, error: null }) }) }),
          update: (patch) => ({ eq: (col, val) => { listingUpdateCalls.push({ patch, col, val }); return Promise.resolve({ error: null }); } }),
        };
      }
      if (table === 'marketplace_listing_screens') {
        return { insert: () => Promise.resolve(screensInsertResult), select: () => ({ eq: () => Promise.resolve({ data: [{ screen_id: 's1' }, { screen_id: 's2' }], error: null }) }) };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  },
}));

import { createBundleListing, fetchListingScreens } from './marketplace.js';

describe('createBundleListing', () => {
  it('rejects fewer than 2 screens', async () => {
    await expect(createBundleListing({ screenIds: ['s1'], priceCents: 1000, startDate: '2026-09-01', endDate: '2026-09-30' }))
      .rejects.toThrow('at least 2 screens');
  });

  it('creates the listing and inserts a row per screen', async () => {
    listingUpdateCalls = [];
    screensInsertResult = { data: null, error: null };
    const listing = await createBundleListing({ screenIds: ['s1', 's2'], priceCents: 5000, startDate: '2026-09-01', endDate: '2026-09-30' });
    expect(listing).toEqual(insertedListing);
    expect(listingUpdateCalls).toHaveLength(0);
  });

  it('cancels the listing if the per-screen insert fails', async () => {
    listingUpdateCalls = [];
    screensInsertResult = { data: null, error: new Error('constraint violation') };
    await expect(createBundleListing({ screenIds: ['s1', 's2'], priceCents: 5000, startDate: '2026-09-01', endDate: '2026-09-30' }))
      .rejects.toThrow('constraint violation');
    expect(listingUpdateCalls).toHaveLength(1);
    expect(listingUpdateCalls[0].patch).toEqual({ status: 'cancelled' });
    expect(listingUpdateCalls[0].val).toBe('listing-1');
  });
});

describe('fetchListingScreens', () => {
  it('returns the screen ids for a listing', async () => {
    const ids = await fetchListingScreens('listing-1');
    expect(ids).toEqual(['s1', 's2']);
  });
});
