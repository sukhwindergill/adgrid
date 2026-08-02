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
    eq: (col, val) => { state.filters[col] = { ...(state.filters[col]?.op === 'eq' ? { multi: true } : {}), op: 'eq', val }; return builder; },
    then: (onFulfilled, onRejected) => Promise.resolve(resolve(state)).then(onFulfilled, onRejected),
  };
  return builder;
}

function respond(state) {
  const { table, selectCols, filters, updatePayload } = state;
  if (table !== 'campaign_screens' && table !== 'campaign_creative_screens') {
    return { data: [], error: null };
  }
  if (table === 'campaign_creative_screens') {
    return { data: [], error: null };
  }
  // campaign_screens
  if (updatePayload) {
    return { data: null, error: null };
  }
  if (selectCols === 'campaign_id') {
    // relevantCampaignIds effect: two pending rows, one per screen, same campaign
    return { data: [{ campaign_id: 'camp-1' }, { campaign_id: 'camp-1' }] };
  }
  if (selectCols === '*') {
    // full row set for the relevant campaign
    return {
      data: [
        { campaign_id: 'camp-1', screen_id: 's1', status: 'pending' },
        { campaign_id: 'camp-1', screen_id: 's2', status: 'pending' },
      ],
    };
  }
  if (selectCols === 'status') {
    // "remaining pending" check after approving s1 — s2 is still pending
    return { data: [{ status: 'pending' }] };
  }
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

const campaigns = [
  { id: 'camp-1', advertiser_name: 'Acme', advertiser_id: 'adv-1', status: 'pending_review', start_when: 'all' },
];
const dbScreens = [
  { id: 's1', operator_id: 'op-1', name: 'Screen One' },
  { id: 's2', operator_id: 'op-1', name: 'Screen Two' },
];

describe('ApprovalQueue onApprovalChange', () => {
  beforeEach(() => {
    fromMock.mockClear();
  });

  it('invokes onApprovalChange after a single-screen approve, so the sidebar badge can invalidate live', async () => {
    const onApprovalChange = vi.fn();
    render(
      <ApprovalQueue campaigns={campaigns} setCampaigns={() => {}} dbScreens={dbScreens} onApprovalChange={onApprovalChange} />
    );

    const approveButtons = await screen.findAllByText('✓ Approve');
    fireEvent.click(approveButtons[0]);

    await waitFor(() => expect(onApprovalChange).toHaveBeenCalledTimes(1));
  });

  it('does not blow up and does not call onApprovalChange before any action is taken', async () => {
    const onApprovalChange = vi.fn();
    render(
      <ApprovalQueue campaigns={campaigns} setCampaigns={() => {}} dbScreens={dbScreens} onApprovalChange={onApprovalChange} />
    );
    await screen.findAllByText('✓ Approve');
    expect(onApprovalChange).not.toHaveBeenCalled();
  });
});
