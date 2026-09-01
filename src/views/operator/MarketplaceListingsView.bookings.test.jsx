import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../lib/marketplace.js', () => ({
  fetchOperatorListings: vi.fn(() => Promise.resolve([])),
  fetchOperatorBookings: vi.fn(() => Promise.resolve([
    {
      id: 'b1', price_cents: 50000, payment_status: 'paid', status: 'confirmed',
      listing: { id: 'l1', is_bundle: false, start_date: '2026-09-01', end_date: '2026-09-15' },
    },
  ])),
  cancelListing: vi.fn(),
  createListing: vi.fn(),
  createBundleListing: vi.fn(),
}));
vi.mock('../../components/primitives/Toast.jsx', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));

import { MarketplaceListingsView } from './MarketplaceListingsView.jsx';
import { fetchOperatorBookings } from '../../lib/marketplace.js';

describe('MarketplaceListingsView bookings tab', () => {
  it('does not fetch bookings until the Bookings tab is opened', async () => {
    render(<MarketplaceListingsView operatorId="op1" myScreens={[]} />);
    await waitFor(() => screen.getByText('Listings'));
    expect(fetchOperatorBookings).not.toHaveBeenCalled();
  });

  it('shows bookings on operator listings, without exposing advertiser identity', async () => {
    render(<MarketplaceListingsView operatorId="op1" myScreens={[]} />);
    fireEvent.click(await screen.findByText('Bookings'));

    await waitFor(() => expect(fetchOperatorBookings).toHaveBeenCalledWith('op1'));
    await waitFor(() => expect(screen.getByText(/\$500/)).toBeInTheDocument());
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
  });

  it('shows an empty state when no listings have been booked', async () => {
    fetchOperatorBookings.mockResolvedValueOnce([]);
    render(<MarketplaceListingsView operatorId="op1" myScreens={[]} />);
    fireEvent.click(await screen.findByText('Bookings'));
    await waitFor(() => expect(screen.getByText(/have been booked/)).toBeInTheDocument());
  });
});
