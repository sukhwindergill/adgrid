import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../components/primitives/ConfirmModal.jsx', () => ({
  useConfirm: () => vi.fn(() => Promise.resolve(true)),
}));

vi.mock('../../components/primitives/Toast.jsx', () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn(), undo: vi.fn() }),
}));

const bookingRows = [
  { id: 'c1', advertiser_name: 'Acme', status: 'active', category: 'Retail', budget: 1000, spent: 500, impressions: 10000, scans: 25, start_date: '2026-08-01', end_date: '2026-09-01' },
  { id: 'c2', advertiser_name: 'Widgetco', status: 'active', category: 'Tech', budget: 2000, spent: 400, impressions: 5000, scans: 10, start_date: '2026-08-01', end_date: '2026-09-01' },
];

// Campaigns.jsx now owns its own scoped `bookings` fetch instead of a
// `campaigns` prop -- see PR "server-side pagination for Campaigns.jsx".
function makeQuery(state, resolve) {
  const builder = {
    select: (cols, opts) => { state.selectCols = cols; state.selectOpts = opts; return builder; },
    in: (col, vals) => { state.filters[col] = { op: 'in', vals }; return builder; },
    eq: (col, val) => { state.filters[col] = { op: 'eq', val }; return builder; },
    order: () => builder,
    range: () => builder,
    then: (onFulfilled, onRejected) => Promise.resolve(resolve(state)).then(onFulfilled, onRejected),
  };
  return builder;
}

function respond(state) {
  const { table, selectOpts } = state;
  if (table === 'campaign_screens') {
    // useOperatorCampaignIds hook + per-row screen data -- both empty is fine for this test.
    return { data: [{ campaign_id: 'c1' }, { campaign_id: 'c2' }], error: null };
  }
  if (table === 'campaigns') return { data: [], error: null };
  if (table === 'bookings') {
    if (selectOpts?.head) return { count: 0, data: null, error: null };
    return { data: bookingRows, count: bookingRows.length, error: null };
  }
  return { data: [], error: null };
}

const fromMock = vi.fn((table) => {
  const state = { table, filters: {}, selectCols: null, selectOpts: null };
  return makeQuery(state, respond);
});

vi.mock('../../lib/supabase.js', () => ({
  supabase: { from: (...args) => fromMock(...args) },
}));

import { Campaigns } from './Campaigns.jsx';

function renderCampaigns(props = {}) {
  return render(<Campaigns operatorScreenIds={['s1']} setCampaigns={() => {}} setDetail={() => {}} {...props} />);
}

describe('Campaigns — compare mode', () => {
  beforeEach(() => fromMock.mockClear());

  it('shows a prompt with no selection, then a comparison table with real CPM/cost-per-scan once two campaigns are checked', async () => {
    renderCampaigns();
    await waitFor(() => screen.getByText('Campaigns'));

    fireEvent.click(screen.getByText('⇄ Compare'));
    await waitFor(() => expect(screen.getByText(/Select two or more campaigns/)).toBeInTheDocument());

    await waitFor(() => screen.getByLabelText('Select Acme for comparison'));
    fireEvent.click(screen.getByLabelText('Select Acme for comparison'));
    fireEvent.click(screen.getByLabelText('Select Widgetco for comparison'));

    await waitFor(() => screen.getByText('Comparing 2 campaigns'));
    expect(screen.getAllByText('Acme').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Widgetco').length).toBeGreaterThan(0);
    // Acme: $500/10000 impr *1000 = $50.00 CPM; $500/25 scans = $20.00/scan
    expect(screen.getByText('$50.00')).toBeInTheDocument();
    expect(screen.getByText('$20.00')).toBeInTheDocument();
  });

  it('checking a row does not open its detail view', async () => {
    const setDetail = vi.fn();
    renderCampaigns({ setDetail });
    await waitFor(() => screen.getByText('Campaigns'));

    fireEvent.click(screen.getByText('⇄ Compare'));
    await waitFor(() => screen.getByLabelText('Select Acme for comparison'));
    fireEvent.click(screen.getByLabelText('Select Acme for comparison'));

    expect(setDetail).not.toHaveBeenCalled();
  });

  it('exiting compare mode clears the selection', async () => {
    renderCampaigns();
    await waitFor(() => screen.getByText('Campaigns'));

    fireEvent.click(screen.getByText('⇄ Compare'));
    await waitFor(() => screen.getByLabelText('Select Acme for comparison'));
    fireEvent.click(screen.getByLabelText('Select Acme for comparison'));
    await waitFor(() => screen.getByText('Comparing 1 campaign'));

    fireEvent.click(screen.getByText('✕ Exit Compare'));
    expect(screen.queryByText(/Comparing/)).not.toBeInTheDocument();
  });
});
