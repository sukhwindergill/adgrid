import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../components/primitives/ConfirmModal.jsx', () => ({
  useConfirm: () => vi.fn(() => Promise.resolve(true)),
}));

vi.mock('../../components/primitives/Toast.jsx', () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn(), undo: vi.fn() }),
}));

const bookingRow = {
  id: 'camp-1', advertiser_name: 'Acme', advertiser: 'Acme', status: 'pending_review', category: 'Retail',
  budget: 1000, spent: 0, impressions: 0, scans: 0, start_date: '2026-08-01', end_date: '2026-09-01',
};

// General-purpose query-shape-aware mock: Campaigns.jsx now owns its own
// scoped `bookings` fetch (see PR "server-side pagination for
// Campaigns.jsx") instead of receiving a `campaigns` prop, so this has to
// answer the real query shapes -- campaign_screens (for the
// useOperatorCampaignIds hook), bookings (paginated list + active count),
// campaign_screens again (per-row screen data), and campaigns (parent
// names) -- rather than one flat response.
function makeQuery(state, resolve) {
  const builder = {
    select: (cols, opts) => { state.selectCols = cols; state.selectOpts = opts; return builder; },
    update: (payload) => { state.updatePayload = payload; return builder; },
    in: (col, vals) => { state.filters[col] = { op: 'in', vals }; return builder; },
    eq: (col, val) => { state.filters[col] = { op: 'eq', val }; return builder; },
    order: () => builder,
    range: () => builder,
    then: (onFulfilled, onRejected) => Promise.resolve(resolve(state)).then(onFulfilled, onRejected),
  };
  return builder;
}

function respond(state) {
  const { table, selectOpts, filters, updatePayload } = state;
  if (table === 'campaign_screens') {
    // useOperatorCampaignIds: screen_id -> campaign_id
    if (filters.screen_id) return { data: [{ campaign_id: 'camp-1' }], error: null };
    // per-row screen data (fetchCampaignScreens on the loaded page)
    return { data: [], error: null };
  }
  if (table === 'campaigns') return { data: [], error: null }; // campaign parent names
  if (table === 'bookings') {
    if (updatePayload) return { data: null, error: null };
    if (selectOpts?.head) return { count: 0, data: null, error: null }; // Active Now count
    return { data: [bookingRow], count: 1, error: null }; // paginated list
  }
  return { data: [], error: null };
}

const fromMock = vi.fn((table) => {
  const state = { table, filters: {}, selectCols: null, selectOpts: null, updatePayload: null };
  return makeQuery(state, respond);
});

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    from: (...args) => fromMock(...args),
    auth: { getSession: () => Promise.resolve({ data: { session: { access_token: 'tok' } } }) },
  },
}));

global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));

import { Campaigns } from './Campaigns.jsx';

describe('Campaigns onApprovalChange wiring', () => {
  beforeEach(() => {
    fromMock.mockClear();
    global.fetch.mockClear();
  });

  it('invokes onApprovalChange after approving a pending campaign from the Campaigns list, not just from the Approval Queue', async () => {
    const onApprovalChange = vi.fn();
    render(
      <Campaigns
        operatorScreenIds={['s1']}
        setCampaigns={() => {}}
        setDetail={() => {}}
        canReview
        onApprovalChange={onApprovalChange}
      />
    );

    const approveBtn = await screen.findByText('✓ Approve');
    fireEvent.click(approveBtn);

    await waitFor(() => expect(onApprovalChange).toHaveBeenCalledTimes(1));
  });
});
