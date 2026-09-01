import { describe, it, expect, vi } from 'vitest';

const mockBooking = {
  id: 'b1', listing_id: 'l1', advertiser_id: 'adv-1',
  price_cents: 50000, platform_fee_cents: 2500, status: 'confirmed',
};
const mockListing = {
  id: 'l1', screen_id: 's1', is_bundle: false,
  start_date: '2026-09-01', end_date: '2026-09-15', status: 'booked', operator_id: 'op-1',
};
const mockScreen = { id: 's1', name: 'Corner Brew — King St' };

function tableMock(table) {
  if (table === 'marketplace_bookings') {
    return {
      select: () => ({
        eq: (col) => ({
          order: () => Promise.resolve({ data: [mockBooking], error: null }),
        }),
        in: () => ({ order: () => Promise.resolve({ data: [mockBooking], error: null }) }),
      }),
    };
  }
  if (table === 'marketplace_listings') {
    return {
      select: () => ({
        in: () => Promise.resolve({ data: [mockListing], error: null }),
        eq: () => Promise.resolve({ data: [mockListing], error: null }),
      }),
    };
  }
  if (table === 'advertiser_screens') {
    return { select: () => ({ in: () => Promise.resolve({ data: [mockScreen], error: null }) }) };
  }
  if (table === 'marketplace_operator_transfers') {
    return { select: () => ({ in: () => Promise.resolve({ data: [{ booking_id: 'b1', status: 'transferred' }], error: null }) }) };
  }
  throw new Error(`unexpected table: ${table}`);
}

vi.mock('./supabase.js', () => ({
  supabase: { from: (table) => tableMock(table) },
}));

import { fetchAdvertiserBookings, fetchOperatorBookings } from './marketplace.js';

describe('fetchAdvertiserBookings', () => {
  it('joins each booking to its listing and screen name', async () => {
    const result = await fetchAdvertiserBookings('adv-1');
    expect(result).toEqual([{
      ...mockBooking,
      listing: mockListing,
      screen_name: 'Corner Brew — King St',
    }]);
  });

  it('returns an empty array with no bookings, without querying listings', async () => {
    const { supabase } = await import('./supabase.js');
    const spy = vi.spyOn(supabase, 'from').mockImplementation((table) => {
      if (table === 'marketplace_bookings') {
        return { select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) };
      }
      throw new Error(`should not query ${table} when there are no bookings`);
    });
    try {
      const result = await fetchAdvertiserBookings('adv-1');
      expect(result).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('fetchOperatorBookings', () => {
  it('joins each booking to its listing and the operator\'s own payout status', async () => {
    const result = await fetchOperatorBookings('op-1');
    expect(result).toEqual([{ ...mockBooking, listing: mockListing, payout_status: 'transferred' }]);
  });

  it('reports payout_status null when no transfer row exists yet (still in flight)', async () => {
    const { supabase } = await import('./supabase.js');
    const spy = vi.spyOn(supabase, 'from').mockImplementation((table) => {
      if (table === 'marketplace_operator_transfers') {
        return { select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) };
      }
      return tableMock(table);
    });
    try {
      const result = await fetchOperatorBookings('op-1');
      expect(result[0].payout_status).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });
});
