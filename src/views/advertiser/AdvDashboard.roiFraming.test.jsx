import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AdvDashboard } from './AdvDashboard.jsx';

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { id: 'adv-1' } }),
}));

function chain(resolveValue) {
  const q = {};
  ['select', 'eq', 'in', 'order'].forEach(m => { q[m] = vi.fn(() => q); });
  q.then = (resolve) => Promise.resolve(resolveValue).then(resolve);
  return q;
}

const deliveryRows = [
  { campaign_id: 'c1', day: '2026-08-20', plays: 10, impressions: 4000, attention_weighted_impressions: 4000, basis: 'measured', scans: 12, billable_scans: 10 },
  { campaign_id: 'c1', day: '2026-08-21', plays: 12, impressions: 6000, attention_weighted_impressions: 6000, basis: 'measured', scans: 8, billable_scans: 8 },
];

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    from: vi.fn((table) => {
      if (table === 'campaign_delivery_daily') return chain({ data: deliveryRows });
      if (table === 'campaign_screens') return chain({ data: [] });
      if (table === 'campaign_delivery_health') return chain({ data: [] });
      return chain({ data: [] });
    }),
  },
}));

const campaigns = [{
  id: 'c1', advertiser_id: 'adv-1', budget: 1000, spent: 360, impressions: 10000, scans: 18,
  city: 'Toronto', category: 'retail', start: '2026-08-01', end: '2026-09-01', screen: 'Yonge & Dundas', currency: 'cad', status: 'active',
}];

describe('AdvDashboard — CPM, cost-per-scan, and trend sparklines', () => {
  it('shows CPM and cost-per-scan computed from real spend and delivery totals', async () => {
    render(<AdvDashboard user={{ name: 'Test' }} campaigns={campaigns} setAdvNav={() => {}} advertiserId="adv-1" />);

    await waitFor(() => screen.getByText('CPM'));
    // spend $360, impressions 10000 → CPM = 360/10000*1000 = $36.00
    expect(screen.getByText('$36.00')).toBeInTheDocument();
    // billable scans 18 → cost per scan = 360/18 = $20.00
    expect(screen.getByText('$20.00')).toBeInTheDocument();
  });

  it('renders the 30-day impressions and scans trend cards once delivery data exists', async () => {
    render(<AdvDashboard user={{ name: 'Test' }} campaigns={campaigns} setAdvNav={() => {}} advertiserId="adv-1" />);

    await waitFor(() => screen.getByText('Impressions — last 30 days'));
    expect(screen.getByText('Billable scans — last 30 days')).toBeInTheDocument();
  });
});
