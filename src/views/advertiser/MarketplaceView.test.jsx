import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('../../lib/marketplace.js', () => ({
  fetchActiveListings: vi.fn(() => Promise.resolve([
    { id: 'l1', screen_id: 's1', price_cents: 50000, start_date: '2026-09-01', end_date: '2026-09-15' },
  ])),
}));

import { MarketplaceView } from './MarketplaceView.jsx';

describe('MarketplaceView', () => {
  it('renders listing cards and calls onSelectListing on click', async () => {
    const onSelect = vi.fn();
    render(<MarketplaceView onSelectListing={onSelect} />);
    await waitFor(() => expect(screen.getByText(/\$500/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/\$500/));
    expect(onSelect).toHaveBeenCalledWith('l1');
  });
});
