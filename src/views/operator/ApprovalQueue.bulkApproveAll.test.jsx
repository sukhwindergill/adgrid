import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const confirmMock = vi.hoisted(() => vi.fn(() => Promise.resolve(true)));
const sessionState = vi.hoisted(() => ({ session: null }));

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { id: 'op-1' } }),
}));

vi.mock('../../components/primitives/ConfirmModal.jsx', () => ({
  useConfirm: () => confirmMock,
}));

const capturedStates = [];

function makeQuery(state, resolve) {
  capturedStates.push(state);
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
  if (table === 'bookings') return { data: null, error: null };
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
    auth: { getSession: () => Promise.resolve({ data: { session: sessionState.session } }) },
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
    confirmMock.mockClear();
    confirmMock.mockImplementation(() => Promise.resolve(true));
    capturedStates.length = 0;
    sessionState.session = null;
    vi.unstubAllGlobals();
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

  // Regression test for a real bug (S21/area 3): bulkApproveAll had the
  // same "no payment method on file" charge-failure check as the solo
  // approveScreen/approveAll path, but skipped the confirm() gate the solo
  // path uses before scheduling anyway -- every unpaid campaign in a bulk
  // batch got silently scheduled with zero operator awareness. Fixed by
  // collecting unpaid campaigns instead of scheduling them inline, then
  // asking once via a single batched confirm listing every affected
  // advertiser -- not one modal per campaign.
  it('asks once, batched, before scheduling unpaid campaigns -- does not silently schedule like it used to', async () => {
    sessionState.session = { access_token: 'tok' };
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: false,
      json: () => Promise.resolve({ error: 'Advertiser has no card on file. Ask them to add a payment method.' }),
    })));

    render(
      <ApprovalQueue campaigns={campaigns} setCampaigns={() => {}} dbScreens={dbScreens} onApprovalChange={() => {}} />
    );

    const bulkBtn = await screen.findByText(/Approve all pending/);
    fireEvent.click(bulkBtn);

    // one confirm for "approve all pending?", a second batched one for the
    // no-payment case -- never one per affected campaign.
    await waitFor(() => expect(confirmMock).toHaveBeenCalledTimes(2));
    const consentCall = confirmMock.mock.calls[1][0];
    expect(consentCall.title).toMatch(/without charging/i);
    expect(consentCall.message).toContain('Acme');
    expect(consentCall.message).toContain('Globex');

    // and only after that confirm resolves does it actually schedule them
    await waitFor(() => {
      const bookingSchedules = capturedStates.filter(s =>
        s.table === 'bookings' && s.updatePayload?.status === 'scheduled'
      );
      expect(bookingSchedules.length).toBe(2);
    });
  });

  it('does not schedule unpaid campaigns if the batched consent is declined', async () => {
    sessionState.session = { access_token: 'tok' };
    confirmMock.mockImplementation((opts) =>
      Promise.resolve(!/without charging/i.test(opts?.title ?? ''))
    );
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: false,
      json: () => Promise.resolve({ error: 'Advertiser has no card on file.' }),
    })));

    render(
      <ApprovalQueue campaigns={campaigns} setCampaigns={() => {}} dbScreens={dbScreens} onApprovalChange={() => {}} />
    );

    const bulkBtn = await screen.findByText(/Approve all pending/);
    fireEvent.click(bulkBtn);

    await waitFor(() => expect(confirmMock).toHaveBeenCalledTimes(2));
    await new Promise(r => setTimeout(r, 50));
    const bookingSchedules = capturedStates.filter(s =>
      s.table === 'bookings' && s.updatePayload?.status === 'scheduled'
    );
    expect(bookingSchedules.length).toBe(0);
  });
});
