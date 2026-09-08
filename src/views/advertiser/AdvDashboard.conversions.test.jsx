import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Conversion pixel + postback spec (docs/superpowers/specs/2026-09-08-
// conversion-pixel-postback-design.md): "reported conversion data shows up
// in the advertiser's existing dashboard alongside scans/impressions."

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { id: 'adv-1' } }),
}));

function chain(resolveValue) {
  const q = {};
  ['select', 'eq', 'in', 'order', 'limit'].forEach(m => { q[m] = vi.fn(() => q); });
  q.then = (resolve) => Promise.resolve(resolveValue).then(resolve);
  return q;
}

const bookingRow = {
  id: 'c1', advertiser_id: 'adv-1', budget: 1000, spent: 360, impressions: 10000, scans: 18,
  city: 'Toronto', category: 'retail', start_date: '2026-08-01', end_date: '2026-09-01', screen_name: 'Yonge & Dundas', currency: 'cad', status: 'active',
};

const conversionRows = [
  { source: 'scan', order_value: 49.99 },
  { source: 'scan', order_value: 30 },
  { source: 'promo_code', order_value: 20 },
];

function mockSupabase(conversions = conversionRows) {
  return {
    supabase: {
      from: vi.fn((table) => {
        if (table === 'bookings') return chain({ data: [bookingRow] });
        if (table === 'conversions') return chain({ data: conversions });
        return chain({ data: [] });
      }),
      rpc: vi.fn(() => Promise.resolve({ data: [{ total_spend: 360, total_scans: 18, total_budget: 1000 }], error: null })),
    },
  };
}

describe('AdvDashboard — conversions KPI', () => {
  it('shows conversion count, reported value, and the scan/promo-code split', async () => {
    vi.doMock('../../lib/supabase.js', () => mockSupabase());
    vi.resetModules();
    const { AdvDashboard: View } = await import('./AdvDashboard.jsx');
    render(<View user={{ name: 'Test' }} setAdvNav={() => {}} advertiserId="adv-1" />);

    await waitFor(() => expect(screen.getByText('Conversions')).toBeInTheDocument());
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('$99.99 reported value')).toBeInTheDocument();
    expect(screen.getByText('Via QR Scan')).toBeInTheDocument();
    expect(screen.getByText('Via Promo Code')).toBeInTheDocument();
  });

  it('hides the conversions section entirely when none have been reported', async () => {
    vi.doMock('../../lib/supabase.js', () => mockSupabase([]));
    vi.resetModules();
    const { AdvDashboard: View } = await import('./AdvDashboard.jsx');
    render(<View user={{ name: 'Test' }} setAdvNav={() => {}} advertiserId="adv-1" />);

    await waitFor(() => screen.getByText('Spent to Date'));
    expect(screen.queryByText('Conversions')).not.toBeInTheDocument();
  });
});
