import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdvDashboard } from './AdvDashboard.jsx';

// Story Map (Advertiser epic): "compare performance screen-by-screen" for a
// campaign booked across several screens -- previously only an account-wide
// or per-campaign total existed.

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
let campaignScreenRows = [];
let deliveryRows = [];
let screenNameRows = [];

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    from: vi.fn((table) => {
      if (table === 'bookings') return chain({ data: bookingRows });
      if (table === 'campaign_screens') return chain({ data: campaignScreenRows });
      if (table === 'advertiser_screens') return chain({ data: screenNameRows });
      if (table === 'campaign_delivery_daily') return chain({ data: deliveryRows });
      return chain({ data: [] });
    }),
    rpc: vi.fn(() => Promise.resolve({ data: [{ total_spend: 0, total_scans: 0, total_budget: 0 }], error: null })),
  },
}));

const baseBooking = {
  id: 'c1', advertiser_id: 'adv-1', budget: 1000, spent: 100, impressions: 0, scans: 0,
  city: 'Toronto', category: 'retail', screen_name: '2 screens', currency: 'cad', status: 'active',
  start_date: '2026-08-01', end_date: '2026-09-30',
};

describe('AdvDashboard — compare screens', () => {
  it('shows a per-screen breakdown once expanded for a multi-screen campaign', async () => {
    bookingRows = [baseBooking];
    campaignScreenRows = [
      { campaign_id: 'c1', screen_id: 's1', status: 'approved', review_due_at: null, reject_reason: null },
      { campaign_id: 'c1', screen_id: 's2', status: 'approved', review_due_at: null, reject_reason: null },
    ];
    screenNameRows = [{ id: 's1', name: 'Yonge & Dundas', lat: 1, lon: 1 }, { id: 's2', name: 'King & Bay', lat: 2, lon: 2 }];
    deliveryRows = [
      { campaign_id: 'c1', screen_id: 's1', day: '2026-09-01', plays: 1, impressions: 500, attention_weighted_impressions: 0, basis: 'measured', scans: 1, billable_scans: 1 },
      { campaign_id: 'c1', screen_id: 's2', day: '2026-09-01', plays: 1, impressions: 200, attention_weighted_impressions: 0, basis: 'measured', scans: 0, billable_scans: 0 },
    ];

    render(<AdvDashboard user={{ name: 'Test' }} setAdvNav={() => {}} advertiserId="adv-1" />);

    const toggle = await screen.findByText('Compare screens ▾');
    fireEvent.click(toggle);

    await waitFor(() => expect(screen.getByText('Yonge & Dundas')).toBeInTheDocument());
    expect(screen.getByText('King & Bay')).toBeInTheDocument();
    expect(screen.getByText(/500 impr/)).toBeInTheDocument();
  });

  it('does not show a compare toggle for a single-screen campaign', async () => {
    bookingRows = [{ ...baseBooking, screen_name: 'One Screen' }];
    campaignScreenRows = [{ campaign_id: 'c1', screen_id: 's1', status: 'approved', review_due_at: null, reject_reason: null }];
    screenNameRows = [{ id: 's1', name: 'Yonge & Dundas', lat: 1, lon: 1 }];
    deliveryRows = [];

    render(<AdvDashboard user={{ name: 'Test' }} setAdvNav={() => {}} advertiserId="adv-1" />);

    await waitFor(() => screen.getByText('Welcome back, Test'));
    expect(screen.queryByText('Compare screens ▾')).not.toBeInTheDocument();
  });
});
