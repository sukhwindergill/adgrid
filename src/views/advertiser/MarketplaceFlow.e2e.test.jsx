import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const listing = { id: 'l1', screen_id: 's1', operator_id: 'op1', price_cents: 50000, start_date: '2026-09-01', end_date: '2026-09-15' };

vi.mock('../../lib/marketplace.js', () => ({
  fetchActiveListings: vi.fn(() => Promise.resolve([listing])),
  fetchListing: vi.fn(() => Promise.resolve(listing)),
  fetchAdvertiserBookings: vi.fn(() => Promise.resolve([])),
  bookListing: vi.fn(() => Promise.resolve({ bookingId: 'b1' })),
  fetchScreenDemographics: vi.fn(() => Promise.resolve({ available: false })),
  fetchOrCreateThread: vi.fn(() => Promise.resolve({ id: 't1' })),
  fetchThreadMessages: vi.fn(() => Promise.resolve([])),
  sendThreadMessage: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: { value: 5 }, error: null }),
          then: (resolve) => Promise.resolve({ data: [], error: null }).then(resolve),
        }),
      }),
    }),
  },
}));
vi.mock('../../components/primitives/Toast.jsx', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { id: 'adv-1' } }),
}));

import { MarketplaceView } from './MarketplaceView.jsx';
import { MarketplaceListingDetail } from './MarketplaceListingDetail.jsx';
import { bookListing } from '../../lib/marketplace.js';

function Flow() {
  const [selected, setSelected] = useState(null);
  return selected
    ? <MarketplaceListingDetail listingId={selected} onBack={() => setSelected(null)} />
    : <MarketplaceView onSelectListing={setSelected} />;
}

describe('marketplace browse-to-book flow', () => {
  it('lets an advertiser go from browse to a confirmed booking', async () => {
    render(<Flow />);
    await waitFor(() => screen.getByText(/\$500/));
    fireEvent.click(screen.getByText(/\$500/));
    await waitFor(() => screen.getByText(/book this placement/i));
    fireEvent.click(screen.getByText(/book this placement/i));
    await waitFor(() => expect(bookListing).toHaveBeenCalledWith('l1', false));
  });

  it('shows the platform fee and passes the auto-renew choice through to bookListing', async () => {
    render(<Flow />);
    await waitFor(() => screen.getByText(/\$500/));
    fireEvent.click(screen.getByText(/\$500/));
    await waitFor(() => screen.getByText(/book this placement/i));

    // Platform fee (5% of $500 = $25) and total ($525) shown before booking.
    await waitFor(() => expect(screen.getByText(/\$25\.00/)).toBeInTheDocument());
    expect(screen.getByText(/\$525\.00/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/auto-renew/i));
    fireEvent.click(screen.getByText(/book this placement/i));
    await waitFor(() => expect(bookListing).toHaveBeenCalledWith('l1', true));
  });
});
