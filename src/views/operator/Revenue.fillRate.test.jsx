import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Story Map (Operator epic) / churn-prevention.md: "fill rate" is named
// directly as a leading indicator of operator churn -- this locks in that
// a real drop actually gets flagged on the Revenue page, not just tracked
// silently in the opportunity-cost math.

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ profile: { owner_revenue_share: 0.4 } }),
}));

const now = new Date();
const daysAgo = n => new Date(now.getTime() - n * 86_400_000).toISOString();

let bookingRows = [];
let deliveryRows = [];

function makeQuery(state, resolve) {
  const builder = {
    select: (cols) => { state.selectCols = cols; return builder; },
    in: (col, vals) => { state.filters[col] = { op: 'in', vals }; return builder; },
    gte: (col, val) => { state.filters[col] = { op: 'gte', val }; return builder; },
    then: (onFulfilled, onRejected) => Promise.resolve(resolve(state)).then(onFulfilled, onRejected),
  };
  return builder;
}

function respond(state) {
  if (state.table === 'campaign_screens') return { data: [{ campaign_id: 'paid1' }, { campaign_id: 'house1' }], error: null };
  if (state.table === 'bookings') return { data: bookingRows, error: null };
  if (state.table === 'campaign_delivery_daily') return { data: deliveryRows, error: null };
  if (state.table === 'screens') return { data: [{ id: 's1', cpm_floor: 3 }], error: null };
  return { data: [], error: null };
}

const fromMock = vi.fn((table) => {
  const state = { table, filters: {}, selectCols: null };
  return makeQuery(state, respond);
});

vi.mock('../../lib/supabase.js', () => ({
  supabase: { from: (...args) => fromMock(...args) },
}));

import { Revenue } from './Revenue.jsx';

describe('Revenue — fill rate flag', () => {
  it('flags a real fill-rate drop with the actual before/after percentages', async () => {
    bookingRows = [
      { id: 'paid1', advertiser_name: 'Acme', screen_name: 'Union Station', city: 'Toronto', budget: 500, start_date: daysAgo(5), status: 'active', is_house_ad: false },
      { id: 'house1', advertiser_name: 'AdGrid House', screen_name: 'Union Station', city: 'Toronto', budget: 0, start_date: daysAgo(5), status: 'active', is_house_ad: true },
    ];
    deliveryRows = [
      // Prior 30-60 days ago: paid dominated (90/10).
      { campaign_id: 'paid1', day: daysAgo(45), impressions: 900 },
      { campaign_id: 'house1', day: daysAgo(45), impressions: 100 },
      // Last 30 days: house ads now dominate (20/80) -- a real drop.
      { campaign_id: 'paid1', day: daysAgo(5), impressions: 200 },
      { campaign_id: 'house1', day: daysAgo(5), impressions: 800 },
    ];

    render(<Revenue operatorScreenIds={['s1']} />);

    await waitFor(() => expect(screen.getByText(/Fill rate dropped/)).toBeInTheDocument());
    expect(screen.getByText(/70 points/)).toBeInTheDocument();
  });

  it('shows no flag when fill rate is stable', async () => {
    bookingRows = [
      { id: 'paid1', advertiser_name: 'Acme', screen_name: 'Union Station', city: 'Toronto', budget: 500, start_date: daysAgo(5), status: 'active', is_house_ad: false },
    ];
    deliveryRows = [
      { campaign_id: 'paid1', day: daysAgo(45), impressions: 500 },
      { campaign_id: 'paid1', day: daysAgo(5), impressions: 500 },
    ];

    render(<Revenue operatorScreenIds={['s1']} />);

    await waitFor(() => screen.getByText('Acme'));
    expect(screen.queryByText(/Fill rate dropped/)).not.toBeInTheDocument();
  });
});
