import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('../../lib/marketplace.js', () => ({
  fetchActiveListings: vi.fn(() => Promise.resolve([
    { id: 'l1', screen_id: 's1', price_cents: 50000, start_date: '2026-09-01', end_date: '2026-09-15' },
  ])),
  fetchAdvertiserBookings: vi.fn(() => Promise.resolve([
    {
      id: 'b1', listing_id: 'l1', price_cents: 50000, platform_fee_cents: 2500, status: 'confirmed',
      screen_name: 'Corner Brew — King St',
      listing: { id: 'l1', is_bundle: false, start_date: '2026-09-01', end_date: '2026-09-15' },
    },
  ])),
}));

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { id: 'adv-1' } }),
}));

import { MarketplaceView } from './MarketplaceView.jsx';
import { fetchAdvertiserBookings } from '../../lib/marketplace.js';

describe('MarketplaceView', () => {
  it('renders listing cards and calls onSelectListing on click', async () => {
    const onSelect = vi.fn();
    render(<MarketplaceView onSelectListing={onSelect} />);
    await waitFor(() => expect(screen.getByText(/\$500/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/\$500/));
    expect(onSelect).toHaveBeenCalledWith('l1');
  });

  it('switches to My Bookings and shows the advertiser\'s own bookings', async () => {
    const onSelect = vi.fn();
    render(<MarketplaceView onSelectListing={onSelect} />);
    await waitFor(() => screen.getByText(/\$500/));

    fireEvent.click(screen.getByText('My Bookings'));
    await waitFor(() => expect(fetchAdvertiserBookings).toHaveBeenCalledWith('adv-1'));
    await waitFor(() => expect(screen.getByText(/Corner Brew/)).toBeInTheDocument());

    // price + fee total, not just the listing price
    expect(screen.getByText(/\$525\.00 total/)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Corner Brew/));
    expect(onSelect).toHaveBeenCalledWith('l1');
  });

  it('shows an empty state when the advertiser has no bookings', async () => {
    fetchAdvertiserBookings.mockResolvedValueOnce([]);
    render(<MarketplaceView onSelectListing={vi.fn()} />);
    await waitFor(() => screen.getByText(/\$500/));

    fireEvent.click(screen.getByText('My Bookings'));
    await waitFor(() => expect(screen.getByText(/haven't booked/)).toBeInTheDocument());
  });
});
