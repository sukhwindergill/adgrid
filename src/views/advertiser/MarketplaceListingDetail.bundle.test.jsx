import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const bundleListing = { id: 'l1', screen_id: 's1', operator_id: 'op1', price_cents: 90000, start_date: '2026-09-01', end_date: '2026-09-15', is_bundle: true };

vi.mock('../../lib/marketplace.js', () => ({
  fetchListing: vi.fn(() => Promise.resolve(bundleListing)),
  fetchListingScreens: vi.fn(() => Promise.resolve(['s1', 's2'])),
  bookListing: vi.fn(),
}));
vi.mock('../../components/primitives/Toast.jsx', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock('../../components/marketplace/ScreenAnalyticsPanel.jsx', () => ({ ScreenAnalyticsPanel: () => <div /> }));
vi.mock('../../components/marketplace/MarketplaceThread.jsx', () => ({ MarketplaceThread: () => <div /> }));
vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    from: (table) => {
      if (table === 'platform_config') {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { value: 5 } }) }) }) };
      }
      if (table === 'advertiser_screens') {
        return { select: () => ({ in: () => Promise.resolve({ data: [{ id: 's1', name: 'Corner Brew' }, { id: 's2', name: 'Canary Wharf Plaza' }] }) }) };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  },
}));

import { MarketplaceListingDetail } from './MarketplaceListingDetail.jsx';

describe('MarketplaceListingDetail bundle', () => {
  it('shows the bundle heading and every included screen', async () => {
    render(<MarketplaceListingDetail listingId="l1" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText(/Bundle placement/)).toBeInTheDocument());
    expect(await screen.findByText(/2 screens included: Corner Brew, Canary Wharf Plaza/)).toBeInTheDocument();
  });
});
