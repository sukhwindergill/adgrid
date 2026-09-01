import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// S21: bulkApproveAll previously never checked the result of the
// campaign_screens UPDATE, so a failed write for one campaign in a batch
// was silently reported as a success. This test forces one campaign's
// update to fail and confirms it (a) doesn't get optimistically marked
// approved and (b) surfaces in a visible error banner instead of vanishing.

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { id: 'op-1' } }),
}));

vi.mock('../../components/primitives/ConfirmModal.jsx', () => ({
  useConfirm: () => vi.fn(() => Promise.resolve(true)),
}));

function makeQuery(state, resolve) {
  const builder = {
    select: (cols) => { state.selectCols = cols; return builder; },
    update: (payload) => { state.updatePayload = payload; return builder; },
    in: (col, vals) => { state.filters[col] = { op: 'in', vals }; return builder; },
    eq: (col, val) => { state.filters[col] = { op: 'eq', val }; return builder; },
    then: (onFulfilled, onRejected) => Promise.resolve(resolve(state)).then(onFulfilled, onRejected),
  };
  return builder;
}

function respond(state) {
  const { table, selectCols, updatePayload, filters } = state;
  if (table === 'campaign_creative_screens') return { data: [], error: null };
  if (table === 'bookings') {
    return { data: campaigns.filter(c => (filters.id?.vals ?? []).includes(c.id)), error: null };
  }
  if (table !== 'campaign_screens') return { data: [], error: null };

  if (updatePayload) {
    // camp-2's update fails; camp-1's succeeds.
    if (filters.campaign_id?.val === 'camp-2') {
      return { data: null, error: { message: 'connection timeout' } };
    }
    return { data: null, error: null };
  }
  if (selectCols === 'campaign_id') {
    return {
      data: [
        { campaign_id: 'camp-1' },
        { campaign_id: 'camp-2' },
      ],
    };
  }
  if (selectCols === '*') {
    return {
      data: [
        { campaign_id: 'camp-1', screen_id: 's1', status: 'pending' },
        { campaign_id: 'camp-2', screen_id: 's1', status: 'pending' },
      ],
    };
  }
  if (selectCols === 'status') {
    return { data: [] };
  }
  return { data: [] };
}

const fromMock = vi.fn((table) => {
  const state = { table, filters: {}, selectCols: null, updatePayload: null };
  return makeQuery(state, respond);
});

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    from: (...args) => fromMock(...args),
    auth: { getSession: () => Promise.resolve({ data: { session: null } }) },
  },
}));

import { ApprovalQueue } from './ApprovalQueue.jsx';

const campaigns = [
  { id: 'camp-1', advertiser_name: 'Acme', advertiser_id: 'adv-1', status: 'pending_review', start_when: 'all' },
  { id: 'camp-2', advertiser_name: 'Globex', advertiser_id: 'adv-2', status: 'pending_review', start_when: 'all' },
];
const dbScreens = [
  { id: 's1', operator_id: 'op-1', name: 'Screen One' },
];

describe('ApprovalQueue bulkApproveAll partial failure', () => {
  beforeEach(() => {
    fromMock.mockClear();
  });

  it('leaves a failed campaign pending and shows it in an error banner instead of silently succeeding', async () => {
    const onApprovalChange = vi.fn();
    render(
      <ApprovalQueue setCampaigns={() => {}} dbScreens={dbScreens} onApprovalChange={onApprovalChange} />
    );

    const bulkBtn = await screen.findByText(/Approve all pending/);
    fireEvent.click(bulkBtn);

    // Error banner names the campaign that failed and why.
    await waitFor(() => expect(screen.getByText(/1 approval failed/)).toBeInTheDocument());
    expect(screen.getByText(/Globex: connection timeout/)).toBeInTheDocument();

    // Bulk action still completes (doesn't hang/throw) and reports back once.
    expect(onApprovalChange).toHaveBeenCalledTimes(1);
  });
});
