import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AdvDashboard } from './AdvDashboard.jsx';

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

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    from: vi.fn((table) => {
      if (table === 'bookings') return chain({ data: bookingRows });
      return chain({ data: [] });
    }),
    rpc: vi.fn(() => Promise.resolve({ data: [{ total_spend: 0, total_scans: 0, total_budget: 0 }], error: null })),
  },
}));

describe('AdvDashboard — budget pacing forecast', () => {
  it('surfaces PacingCard on the dashboard landing page, not just on click-through into a campaign', async () => {
    bookingRows = [{
      id: 'c1', advertiser_id: 'adv-1', budget: 1000, spent: 100, impressions: 0, scans: 0,
      city: 'Toronto', category: 'retail', screen_name: 'Yonge & Dundas', currency: 'cad', status: 'active',
      start_date: '2026-08-01', end_date: '2026-09-30',
    }];

    render(<AdvDashboard user={{ name: 'Test' }} setAdvNav={() => {}} advertiserId="adv-1" />);

    await waitFor(() => screen.getByText('Pacing'));
    expect(screen.getByText(/Projected final spend/)).toBeInTheDocument();
  });

  it('does not render a pacing section when there are no active campaigns', async () => {
    bookingRows = [{
      id: 'c1', advertiser_id: 'adv-1', budget: 1000, spent: 1000, impressions: 0, scans: 0,
      city: 'Toronto', category: 'retail', screen_name: 'Yonge & Dundas', currency: 'cad', status: 'completed',
      start_date: '2026-01-01', end_date: '2026-02-01',
    }];

    render(<AdvDashboard user={{ name: 'Test' }} setAdvNav={() => {}} advertiserId="adv-1" />);

    await waitFor(() => screen.getByText('Welcome back, Test'));
    expect(screen.queryByText('Pacing')).not.toBeInTheDocument();
  });
});
