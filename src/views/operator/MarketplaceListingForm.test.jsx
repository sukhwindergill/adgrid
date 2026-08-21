import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('../../lib/marketplace.js', () => ({
  createListing: vi.fn(() => Promise.resolve({ id: 'l1' })),
}));
import { createListing } from '../../lib/marketplace.js';
vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => Promise.resolve({ data: [{ impressions: 1000 }, { impressions: 1200 }], error: null }) }),
    }),
  },
}));

const toastError = vi.fn();
vi.mock('../../components/primitives/Toast.jsx', () => ({
  useToast: () => ({ success: vi.fn(), error: toastError }),
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

  it('re-enables the submit button and does not call onCreated when createListing rejects', async () => {
    createListing.mockRejectedValueOnce(new Error('boom'));
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onCreated = vi.fn();
    render(<MarketplaceListingForm screenId="s1" onCreated={onCreated} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/price/i), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: '2026-09-15' } });
    const submitBtn = screen.getByText(/create listing/i);
    fireEvent.click(submitBtn);

    await waitFor(() => expect(submitBtn).not.toBeDisabled());
    expect(onCreated).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
