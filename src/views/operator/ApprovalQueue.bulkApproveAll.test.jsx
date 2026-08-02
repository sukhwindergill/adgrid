import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

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
  const { table, selectCols, updatePayload } = state;
  if (table === 'campaign_creative_screens') return { data: [], error: null };
  if (table !== 'campaign_screens') return { data: [], error: null };
  if (updatePayload) return { data: null, error: null };
  if (selectCols === 'campaign_id') {
    // relevantCampaignIds: two campaigns, each with a pending row per my screen
    return {
      data: [
        { campaign_id: 'camp-1' }, { campaign_id: 'camp-1' },
        { campaign_id: 'camp-2' }, { campaign_id: 'camp-2' },
      ],
    };
  }
  if (selectCols === '*') {
    return {
      data: [
        { campaign_id: 'camp-1', screen_id: 's1', status: 'pending' },
        { campaign_id: 'camp-1', screen_id: 's2', status: 'pending' },
        { campaign_id: 'camp-2', screen_id: 's1', status: 'pending' },
        { campaign_id: 'camp-2', screen_id: 's2', status: 'pending' },
      ],
    };
  }
  if (selectCols === 'status') {
    // remaining-pending check after approving -- nothing left, all cleared
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
  { id: 's2', operator_id: 'op-1', name: 'Screen Two' },
];

describe('ApprovalQueue bulkApproveAll', () => {
  beforeEach(() => {
    fromMock.mockClear();
  });

  it('invokes onApprovalChange exactly once for a bulk approve spanning multiple campaigns and rows', async () => {
    const onApprovalChange = vi.fn();
    render(
      <ApprovalQueue campaigns={campaigns} setCampaigns={() => {}} dbScreens={dbScreens} onApprovalChange={onApprovalChange} />
    );

    const bulkBtn = await screen.findByText(/Approve all pending/);
    fireEvent.click(bulkBtn);

    await waitFor(() => expect(onApprovalChange).toHaveBeenCalledTimes(1));
    // give any stray extra calls a chance to show up before asserting the final count
    await new Promise(r => setTimeout(r, 50));
    expect(onApprovalChange).toHaveBeenCalledTimes(1);
  });
});
