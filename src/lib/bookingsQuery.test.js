import { describe, it, expect, vi, beforeEach } from 'vitest';

const calls = [];
function builder(root) {
  const b = {};
  ['select', 'eq', 'or', 'order', 'range', 'in'].forEach(m => {
    b[m] = (...args) => { calls.push([root, m, ...args]); return b; };
  });
  return b;
}

vi.mock('./supabase.js', () => ({
  supabase: {
    from: (table) => { calls.push(['from', table]); return builder(table); },
    rpc: (fn, args, opts) => { calls.push(['rpc', fn, args, opts]); return builder(fn); },
  },
}));

import { scopedBookings, applyBookingSearch, sanitizeSearchTerm, BOOKING_LIST_COLUMNS } from './bookingsQuery.js';

describe('bookingsQuery', () => {
  beforeEach(() => { calls.length = 0; });

  it('scopes advertiser reads by advertiser_id with explicit columns', () => {
    scopedBookings({ advertiserId: 'adv-1' }, { count: 'exact' });
    expect(calls).toEqual([
      ['from', 'bookings'],
      ['bookings', 'select', BOOKING_LIST_COLUMNS, { count: 'exact' }],
      ['bookings', 'eq', 'advertiser_id', 'adv-1'],
    ]);
    expect(BOOKING_LIST_COLUMNS).not.toContain('*');
    expect(BOOKING_LIST_COLUMNS).not.toMatch(/stripe_|payment_intent/);
  });

  it('scopes operator reads through the operator_bookings RPC, never a client-side id list', () => {
    scopedBookings({ operatorScreenIds: ['s1', 's2'] }, { columns: 'id', count: 'exact', head: true });
    expect(calls).toEqual([
      ['rpc', 'operator_bookings', { p_screen_ids: ['s1', 's2'] }, { count: 'exact', head: true }],
      ['operator_bookings', 'select', 'id'],
    ]);
  });

  it('builds a case-insensitive OR search across the text columns', () => {
    const q = builder('q');
    applyBookingSearch(q, '  Acme ');
    expect(calls).toEqual([
      ['q', 'or', 'campaign_name.ilike.*Acme*,advertiser_name.ilike.*Acme*,headline.ilike.*Acme*,screen_name.ilike.*Acme*,city.ilike.*Acme*'],
    ]);
  });

  it('skips the filter for blank search and strips PostgREST syntax characters', () => {
    const q = builder('q');
    expect(applyBookingSearch(q, '   ')).toBe(q);
    expect(calls).toEqual([]);
    expect(sanitizeSearchTerm('Acme, Inc (CA) 100%*')).toBe('Acme Inc CA 100');
  });
});
