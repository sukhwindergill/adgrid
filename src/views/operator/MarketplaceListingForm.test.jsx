import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('../../lib/marketplace.js', () => ({
  createListing: vi.fn(() => Promise.resolve({ id: 'l1' })),
}));
vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => Promise.resolve({ data: [{ impressions: 1000 }, { impressions: 1200 }], error: null }) }),
    }),
  },
}));

import { MarketplaceListingForm } from './MarketplaceListingForm.jsx';

describe('MarketplaceListingForm', () => {
  it('shows a projected shared-rotation estimate before submit', async () => {
    render(<MarketplaceListingForm screenId="s1" onCreated={vi.fn()} onCancel={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/projected shared-rotation/i)).toBeInTheDocument());
  });

  it('submits with entered price and dates', async () => {
    const onCreated = vi.fn();
    render(<MarketplaceListingForm screenId="s1" onCreated={onCreated} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/price/i), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: '2026-09-15' } });
    fireEvent.click(screen.getByText(/create listing/i));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
  });
});
