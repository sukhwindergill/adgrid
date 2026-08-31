import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../lib/marketplace.js', () => ({
  fetchOperatorListings: vi.fn(() => Promise.resolve([])),
  cancelListing: vi.fn(),
  createListing: vi.fn(),
  createBundleListing: vi.fn(() => Promise.resolve({ id: 'bundle-1' })),
}));
vi.mock('../../components/primitives/Toast.jsx', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));

import { MarketplaceListingsView } from './MarketplaceListingsView.jsx';

const myScreens = [
  { id: 's1', name: 'Corner Brew' },
  { id: 's2', name: 'Canary Wharf Plaza' },
  { id: 's3', name: 'King & Bay' },
];

describe('MarketplaceListingsView bundle picker', () => {
  it('gates Continue behind selecting at least 2 screens', async () => {
    render(<MarketplaceListingsView operatorId="op1" myScreens={myScreens} />);
    fireEvent.click(await screen.findByText('+ Create bundle listing'));

    expect(screen.getByRole('button', { name: /Continue with 0 screens/ })).toBeDisabled();

    fireEvent.click(screen.getByText('Corner Brew'));
    expect(screen.getByRole('button', { name: /Continue with 1 screen$/ })).toBeDisabled();

    fireEvent.click(screen.getByText('Canary Wharf Plaza'));
    expect(screen.getByRole('button', { name: /Continue with 2 screens/ })).not.toBeDisabled();
  });

  it('opens the bundle form with exactly the selected screens once confirmed', async () => {
    render(<MarketplaceListingsView operatorId="op1" myScreens={myScreens} />);
    fireEvent.click(await screen.findByText('+ Create bundle listing'));
    fireEvent.click(screen.getByText('Corner Brew'));
    fireEvent.click(screen.getByText('King & Bay'));
    fireEvent.click(screen.getByText(/Continue with 2 screens/));

    await waitFor(() => expect(screen.getByText(/Bundle of 2 screens/)).toBeInTheDocument());
    expect(screen.getByText(/Corner Brew, King & Bay/)).toBeInTheDocument();
  });
});
