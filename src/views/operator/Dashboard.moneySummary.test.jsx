import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Dashboard } from './Dashboard.jsx';

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ profile: { connect_status: 'active', owner_revenue_share: 0.55 } }),
}));

const activeBooking = {
  id: 'c1', advertiser_name: 'Acme', status: 'active', category: 'Retail',
  budget: 1000, spent: 1000, impressions: 5000, scans: 10,
  start_date: '2026-08-01', end_date: '2026-09-01', screen_name: 'Yonge', city: 'Toronto',
};

function chain(resolveValue) {
  const q = {};
  ['select', 'gte', 'lt', 'in', 'order'].forEach(m => { q[m] = vi.fn(() => q); });
  q.then = (resolve) => Promise.resolve(resolveValue).then(resolve);
  return q;
}

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    from: vi.fn((table) => {
      if (table === 'campaign_screens') return chain({ data: [{ campaign_id: 'c1' }] }); // useOperatorCampaignIds
      if (table === 'bookings') return chain({ data: [activeBooking] });
      return chain({ data: [] });
    }),
    auth: { getSession: vi.fn(() => Promise.resolve({ data: { session: { access_token: 'tok' } } })) },
  },
}));

const dbScreens = [{ id: 's1', operator_id: 'op-1' }];

describe('Dashboard — money summary card', () => {
  it('shows available/pending balance and real per-operator earnings, with links to Billing and Revenue', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        balance: { available: 320, pending: 75 },
        connectStatus: 'active',
      }),
    }));

    render(<Dashboard dbScreens={dbScreens} setNav={() => {}} loading={false} />);

    await waitFor(() => screen.getByText('Your Money'));
    expect(screen.getByText('$320')).toBeInTheDocument();
    expect(screen.getByText('$75')).toBeInTheDocument();
    // spent 1000, 55% owner share, 12% platform fee: 1000*0.88*0.55 = $484
    await waitFor(() => expect(screen.getByText('$484')).toBeInTheDocument());
    expect(screen.getByText('55% of network spend, after platform fee')).toBeInTheDocument();
    expect(screen.getByText('Billing →')).toBeInTheDocument();
    expect(screen.getByText('Revenue →')).toBeInTheDocument();
  });

  it('prompts to connect payouts instead of showing $0 balances when not connected', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ balance: null, connectStatus: 'pending' }),
    }));

    render(<Dashboard dbScreens={dbScreens} setNav={() => {}} loading={false} />);

    await waitFor(() => screen.getByText('Your Money'));
    expect(screen.getByText(/Connect a payout account/)).toBeInTheDocument();
    expect(screen.queryByText('Available')).not.toBeInTheDocument();
  });
});
