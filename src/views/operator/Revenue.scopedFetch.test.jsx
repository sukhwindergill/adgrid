import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ profile: { owner_revenue_share: 0.4 } }),
}));

const bookingRows = [
  { id: 'b1', advertiser_name: 'Acme', screen_name: 'Union Station', city: 'Toronto', budget: 1000, start_date: '2026-08-15', status: 'active' },
];

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
  if (state.table === 'campaign_screens') return { data: [{ campaign_id: 'b1' }], error: null }; // useOperatorCampaignIds
  if (state.table === 'bookings') return { data: bookingRows, error: null };
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

describe('Revenue — scoped bookings fetch (no app-wide campaigns array)', () => {
  beforeEach(() => fromMock.mockClear());

  it('renders real rows without ever receiving a `campaigns` prop, defaulting to the bounded 30-day tab', async () => {
    render(<Revenue operatorScreenIds={['s1']} />);
    await waitFor(() => screen.getByText('Acme'));
    expect(screen.getByText('30d')).toBeInTheDocument();
  });

  it('re-queries scoped to the account id set when "All" is selected, not a pre-fetched unbounded array', async () => {
    render(<Revenue operatorScreenIds={['s1']} />);
    await waitFor(() => screen.getByText('Acme'));
    fromMock.mockClear();

    fireEvent.click(screen.getByText('All'));

    await waitFor(() => expect(fromMock).toHaveBeenCalledWith('bookings'));
  });
});
