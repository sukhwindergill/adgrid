import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

function makeQuery(state, resolve) {
  const builder = {
    select: (cols) => { state.selectCols = cols; return builder; },
    eq: (col, val) => { state.filters[col] = { op: 'eq', val }; return builder; },
    in: (col, vals) => { state.filters[col] = { op: 'in', vals }; return builder; },
    gte: (col, val) => { state.filters[col] = { op: 'gte', val }; return builder; },
    lte: (col, val) => { state.filters[col] = { op: 'lte', val }; return builder; },
    lt: (col, val) => { state.filters[col] = { op: 'lt', val }; return builder; },
    order: () => builder,
    limit: () => builder,
    maybeSingle: () => Promise.resolve(resolve(state)),
    then: (onFulfilled, onRejected) => Promise.resolve(resolve(state)).then(onFulfilled, onRejected),
  };
  return builder;
}

const bookingRows = [
  { id: 'b1', advertiser_name: 'Acme', screen_name: 'Union Station', city: 'Toronto', budget: 1000, impressions: 5000, scans: 20, status: 'active' },
];

function respond(state) {
  if (state.table === 'campaign_screens') return { data: [{ campaign_id: 'b1' }], error: null };
  if (state.table === 'bookings') return { data: bookingRows, error: null };
  if (state.table === 'benchmark_stats') return { data: null, error: null };
  if (state.table === 'impression_events') return { data: [], error: null };
  return { data: [], error: null };
}

const fromMock = vi.fn((table) => {
  const state = { table, filters: {}, selectCols: null };
  return makeQuery(state, respond);
});

vi.mock('../../lib/supabase.js', () => ({
  supabase: { from: (...args) => fromMock(...args) },
}));

import { Analytics } from './Analytics.jsx';

describe('Analytics — scoped bookings fetch (no app-wide campaigns array)', () => {
  it('operator mode: renders recent campaign rows without a `campaigns` prop', async () => {
    render(<Analytics operatorScreenIds={['s1']} />);
    await waitFor(() => expect(screen.getAllByText('Acme').length).toBeGreaterThan(0));
  });

  it('advertiser mode: fetches by advertiser_id instead of the operator screen-id path', async () => {
    fromMock.mockClear();
    render(<Analytics advertiserId="adv-1" />);
    await waitFor(() => expect(screen.getAllByText('Acme').length).toBeGreaterThan(0));
    const bookingsCall = fromMock.mock.calls.find(([t]) => t === 'bookings');
    expect(bookingsCall).toBeTruthy();
  });
});
