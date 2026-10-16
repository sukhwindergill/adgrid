import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../components/primitives/ConfirmModal.jsx', () => ({
  useConfirm: () => vi.fn(() => Promise.resolve(true)),
}));
vi.mock('../../components/primitives/Toast.jsx', () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn(), undo: vi.fn() }),
}));

const row = { id: 'c1', advertiser_name: 'Acme', status: 'active', budget: 100, spent: 0, impressions: 0, scans: 0 };

// Records every bookings read (table or RPC) so the tests can assert that
// scope, status filter, search and paging all reach the server.
const reads = [];
function makeQuery(state) {
  const b = {
    select: (cols, opts) => { state.cols = cols; if (opts) state.opts = opts; return b; },
    eq: (col, val) => { state.eq[col] = val; return b; },
    in: (col, val) => { state.in[col] = val; return b; },
    or: (expr) => { state.or = expr; return b; },
    order: () => b,
    range: (from, to) => { state.range = [from, to]; return b; },
    then: (ok, err) => Promise.resolve(respond(state)).then(ok, err),
  };
  return b;
}
function respond(state) {
  if (state.bookings) {
    reads.push(state);
    if (state.opts?.head) return { count: 3, data: null, error: null };
    return { data: [row], count: 30, error: null };
  }
  return { data: [], error: null };
}

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    from: (table) => makeQuery({ table, bookings: table === 'bookings', eq: {}, in: {} }),
    rpc: (fn, args, opts) => makeQuery({ rpc: fn, args, opts, bookings: true, eq: {}, in: {} }),
  },
}));

import { Campaigns } from './Campaigns.jsx';

const listReads = () => reads.filter(r => !r.opts?.head);

describe('Campaigns — server-side scope, filter, search and paging', () => {
  beforeEach(() => { reads.length = 0; });

  it('advertiser mode filters by advertiser_id on the server with explicit columns', async () => {
    render(<Campaigns advertiserId="adv-1" setCampaigns={() => {}} setDetail={() => {}} />);
    await screen.findByText('Campaigns');
    const first = listReads()[0];
    expect(first.table).toBe('bookings');
    expect(first.eq.advertiser_id).toBe('adv-1');
    expect(first.cols).not.toBe('*');
    expect(first.range).toEqual([0, 24]);
    expect(first.in.id).toBeUndefined();
  });

  it('operator mode reads through the operator_bookings RPC with the visible screen ids', async () => {
    render(<Campaigns operatorScreenIds={['s2', 's1']} setCampaigns={() => {}} setDetail={() => {}} />);
    await screen.findByText('Campaigns');
    const first = listReads()[0];
    expect(first.rpc).toBe('operator_bookings');
    expect(first.args).toEqual({ p_screen_ids: ['s1', 's2'] });
    // Active Now is a COUNT-only query.
    const head = reads.find(r => r.opts?.head);
    expect(head.eq.status).toBe('active');
    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument());
  });

  it('sends status tab and debounced search to the server, and pages with Load more', async () => {
    render(<Campaigns advertiserId="adv-1" setCampaigns={() => {}} setDetail={() => {}} />);
    await screen.findByText('Campaigns');

    fireEvent.click(screen.getByText('Paused'));
    await waitFor(() => expect(listReads().some(r => r.eq.status === 'paused')).toBe(true));

    fireEvent.change(screen.getByLabelText('Search campaigns'), { target: { value: 'acme' } });
    await waitFor(() => expect(listReads().some(r => r.or?.includes('campaign_name.ilike.*acme*') && r.eq.status === 'paused')).toBe(true));

    reads.length = 0;
    fireEvent.click(await screen.findByText(/Load more/));
    await waitFor(() => expect(listReads().some(r => r.range?.[0] === 1)).toBe(true));
  });

  it('shows the empty state and makes no bookings read when the operator has no screens', async () => {
    render(<Campaigns operatorScreenIds={[]} setCampaigns={() => {}} setDetail={() => {}} />);
    await screen.findByText('No campaigns yet');
    expect(reads).toHaveLength(0);
  });
});
