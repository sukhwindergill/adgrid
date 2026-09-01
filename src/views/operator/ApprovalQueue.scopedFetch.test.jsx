import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// ApprovalQueue used to receive the app-wide `campaigns` array (App.jsx's
// unbounded, unpaginated fetch of every booking ever made) and filter it
// client-side. It now fetches only the booking rows for campaigns with a
// pending screen among the operator's own -- this proves that decoupling:
// the component renders correctly with NO `campaigns` prop at all, driven
// entirely by its own scoped `bookings` query.

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { id: 'op-1' } }),
}));

vi.mock('../../components/primitives/ConfirmModal.jsx', () => ({
  useConfirm: () => vi.fn(() => Promise.resolve(true)),
}));

let bookingsCallArgs = null;

function makeQuery(state, resolve) {
  const builder = {
    select: (cols) => { state.selectCols = cols; return builder; },
    update: (payload) => { state.updatePayload = payload; return builder; },
    in: (col, vals) => {
      state.filters[col] = { op: 'in', vals };
      if (state.table === 'bookings' && col === 'id') bookingsCallArgs = vals;
      return builder;
    },
    eq: (col, val) => { state.filters[col] = { op: 'eq', val }; return builder; },
    then: (onFulfilled, onRejected) => Promise.resolve(resolve(state)).then(onFulfilled, onRejected),
  };
  return builder;
}

function respond(state) {
  const { table, selectCols, filters, updatePayload } = state;
  if (table === 'bookings') {
    return { data: [{ id: 'camp-1', advertiser_name: 'Acme', advertiser_id: 'adv-1', status: 'pending_review', start_when: 'all', budget: 500 }], error: null };
  }
  if (table === 'campaign_creative_screens') return { data: [], error: null };
  if (table !== 'campaign_screens') return { data: [], error: null };
  if (updatePayload) return { data: null, error: null };
  if (selectCols === 'campaign_id') return { data: [{ campaign_id: 'camp-1' }] };
  if (selectCols === '*') return { data: [{ campaign_id: 'camp-1', screen_id: 's1', status: 'pending' }] };
  return { data: [] };
}

const fromMock = vi.fn((table) => {
  const state = { table, filters: {}, selectCols: null, updatePayload: null };
  return makeQuery(state, respond);
});

vi.mock('../../lib/supabase.js', () => ({
  supabase: { from: (...args) => fromMock(...args) },
}));

import { ApprovalQueue } from './ApprovalQueue.jsx';

const dbScreens = [{ id: 's1', operator_id: 'op-1', name: 'Screen One' }];

describe('ApprovalQueue — scoped bookings fetch (no app-wide campaigns array)', () => {
  beforeEach(() => { fromMock.mockClear(); bookingsCallArgs = null; });

  it('renders the pending campaign without ever receiving a `campaigns` prop', async () => {
    render(<ApprovalQueue setCampaigns={() => {}} dbScreens={dbScreens} onApprovalChange={() => {}} />);
    await waitFor(() => expect(screen.getAllByText('Acme').length).toBeGreaterThan(0));
  });

  it('fetches bookings scoped to exactly the relevant campaign ids, not the full account history', async () => {
    render(<ApprovalQueue setCampaigns={() => {}} dbScreens={dbScreens} onApprovalChange={() => {}} />);
    await waitFor(() => expect(bookingsCallArgs).toEqual(['camp-1']));
  });
});
