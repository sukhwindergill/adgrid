import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('../../lib/marketplace.js', () => ({
  createListing: vi.fn(() => Promise.resolve({ id: 'l1' })),
  createBundleListing: vi.fn(() => Promise.resolve({ id: 'bundle-1' })),
}));
import { createBundleListing } from '../../lib/marketplace.js';
vi.mock('../../lib/supabase.js', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) },
}));
vi.mock('../../components/primitives/Toast.jsx', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

import { MarketplaceListingForm } from './MarketplaceListingForm.jsx';

const bundleScreens = [{ id: 's1', name: 'Corner Brew' }, { id: 's2', name: 'Canary Wharf Plaza' }];

describe('MarketplaceListingForm bundle mode', () => {
  it('shows the bundle screen list and no single-screen projection', async () => {
    render(<MarketplaceListingForm bundleScreens={bundleScreens} onCreated={vi.fn()} onCancel={vi.fn()} />);
    expect(await screen.findByText(/Bundle of 2 screens/)).toBeInTheDocument();
    expect(screen.queryByText(/projected shared-rotation/i)).not.toBeInTheDocument();
  });

  it('submits via createBundleListing with every screen id', async () => {
    const onCreated = vi.fn();
    render(<MarketplaceListingForm bundleScreens={bundleScreens} onCreated={onCreated} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/price/i), { target: { value: '900' } });
    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: '2026-09-15' } });
    fireEvent.click(screen.getByText(/create bundle listing/i));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ id: 'bundle-1' }));
    expect(createBundleListing).toHaveBeenCalledWith(expect.objectContaining({ screenIds: ['s1', 's2'], priceCents: 90000 }));
  });
});
