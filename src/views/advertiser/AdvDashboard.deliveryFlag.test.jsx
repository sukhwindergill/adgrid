import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AdvDashboard } from './AdvDashboard.jsx';

// Spec #1 (proof-of-play): the account-wide DeliveryHealthCard and the
// operator's screen-offline alert already existed. This locks in the
// remaining gap -- flagging WHICH campaign in "Your Campaigns" was actually
// affected, not just an account-wide sum.

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { id: 'adv-1' } }),
}));

function chain(resolveValue) {
  const q = {};
  ['select', 'eq', 'in', 'order', 'limit'].forEach(m => { q[m] = vi.fn(() => q); });
  q.then = (resolve) => Promise.resolve(resolveValue).then(resolve);
  return q;
}

let bookingRows = [];
let healthRows = [];

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    from: vi.fn((table) => {
      if (table === 'bookings') return chain({ data: bookingRows });
      if (table === 'campaign_delivery_health') return chain({ data: healthRows });
      return chain({ data: [] });
    }),
    rpc: vi.fn(() => Promise.resolve({ data: [{ total_spend: 0, total_scans: 0, total_budget: 0 }], error: null })),
  },
}));

const baseBooking = {
  id: 'c1', advertiser_id: 'adv-1', budget: 1000, spent: 100, impressions: 0, scans: 0,
  city: 'Toronto', category: 'retail', screen_name: 'Yonge & Dundas', currency: 'cad', status: 'active',
  start_date: '2026-08-01', end_date: '2026-09-30',
};

describe('AdvDashboard — per-campaign delivery flag', () => {
  it('flags a specific campaign whose screen went offline during its flight', async () => {
    bookingRows = [baseBooking];
    healthRows = [{ campaign_id: 'c1', expected_plays: 100, delivered_plays: 60, delivery_pct: 60, total_credited: 0, offline_days: 2 }];

    render(<AdvDashboard user={{ name: 'Test' }} setAdvNav={() => {}} advertiserId="adv-1" />);

    await waitFor(() => expect(screen.getByText(/Screen offline 2 days during flight/)).toBeInTheDocument());
  });

  it('does not flag a campaign with healthy delivery', async () => {
    bookingRows = [baseBooking];
    healthRows = [{ campaign_id: 'c1', expected_plays: 100, delivered_plays: 98, delivery_pct: 98, total_credited: 0, offline_days: 0 }];

    render(<AdvDashboard user={{ name: 'Test' }} setAdvNav={() => {}} advertiserId="adv-1" />);

    await waitFor(() => screen.getByText('Welcome back, Test'));
    expect(screen.queryByText(/Screen offline/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Delivery at/)).not.toBeInTheDocument();
  });

  it('only flags the affected campaign when a second campaign is healthy', async () => {
    bookingRows = [
      baseBooking,
      { ...baseBooking, id: 'c2', screen_name: 'King & Bay' },
    ];
    healthRows = [
      { campaign_id: 'c1', expected_plays: 100, delivered_plays: 100, delivery_pct: 100, total_credited: 0, offline_days: 0 },
      { campaign_id: 'c2', expected_plays: 100, delivered_plays: 50, delivery_pct: 50, total_credited: 0, offline_days: 0 },
    ];

    render(<AdvDashboard user={{ name: 'Test' }} setAdvNav={() => {}} advertiserId="adv-1" />);

    await waitFor(() => expect(screen.getByText(/Delivery at 50% of scheduled plays/)).toBeInTheDocument());
  });
});
