import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const listing = { id: 'l1', screen_id: 's1', operator_id: 'op1', price_cents: 50000, start_date: '2026-09-01', end_date: '2026-09-15' };

vi.mock('../../lib/marketplace.js', () => ({
  fetchActiveListings: vi.fn(() => Promise.resolve([listing])),
  fetchListing: vi.fn(() => Promise.resolve(listing)),
  bookListing: vi.fn(() => Promise.resolve({ bookingId: 'b1' })),
  fetchScreenDemographics: vi.fn(() => Promise.resolve({ available: false })),
  fetchOrCreateThread: vi.fn(() => Promise.resolve({ id: 't1' })),
  fetchThreadMessages: vi.fn(() => Promise.resolve([])),
  sendThreadMessage: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../lib/supabase.js', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) },
}));
vi.mock('../../components/primitives/Toast.jsx', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));

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
    await waitFor(() => expect(bookListing).toHaveBeenCalledWith('l1'));
  });
});
