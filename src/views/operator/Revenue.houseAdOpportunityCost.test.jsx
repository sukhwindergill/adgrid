import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Revenue } from './Revenue.jsx';

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ profile: { owner_revenue_share: 0.4 } }),
}));

vi.mock('../../hooks/useOperatorCampaignIds.js', () => ({
  useOperatorCampaignIds: () => new Set(['b1', 'b2']),
}));

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    from: (table) => {
      if (table === 'bookings') {
        return {
          select: () => ({
            in: () => ({
              gte: () => Promise.resolve({
                data: [
                  { id: 'b1', budget: 500, city: 'Toronto', is_house_ad: false, impressions: 10000, status: 'active', start_date: new Date().toISOString() },
                  { id: 'b2', budget: 0, city: 'Toronto', is_house_ad: true, impressions: 4000, status: 'active', start_date: new Date().toISOString() },
                ],
              }),
            }),
          }),
        };
      }
      if (table === 'screens') {
        return { select: () => ({ in: () => Promise.resolve({ data: [{ id: 's1', cpm_floor: 3.0 }] }) }) };
      }
      return { select: () => ({ in: () => Promise.resolve({ data: [] }) }) };
    },
  },
}));

describe('Revenue house-ad opportunity cost', () => {
  it('shows an estimated $ figure for house-ad play time, separate from paid ad spend', async () => {
    render(<Revenue operatorScreenIds={['s1']} />);
    await waitFor(() => expect(screen.getByText(/Given Up to House Ads/i)).toBeInTheDocument());
    // 4000 impressions / 1000 * $3.00 cpm_floor = $12
    expect(screen.getByText('$12')).toBeInTheDocument();
    // Total Ad Spend must reflect only the paid booking's budget, not the house ad's $0.
    // (Also appears in the per-campaign table's Gross column, so allow multiple matches.)
    expect(screen.getAllByText('$500').length).toBeGreaterThan(0);
  });
});
