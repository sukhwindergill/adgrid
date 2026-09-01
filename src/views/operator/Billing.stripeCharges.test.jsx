import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../components/primitives/Toast.jsx', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [] }) }) }) }),
    auth: { getSession: () => Promise.resolve({ data: { session: { access_token: 'x' } } }) },
  },
}));

import { Billing } from './Billing.jsx';

const stripeCharges = [
  { id: 'ch_123456789', amount: 500, fee: 60, currency: 'cad', status: 'succeeded', created: '2026-08-15T00:00:00.000Z', description: 'Fall Launch' },
];

describe('Billing Charges tab — get-stripe-charges wiring', () => {
  it('uses the real Stripe-native charge list (with actual fee), not a reimplemented one', async () => {
    global.fetch = vi.fn((url) => {
      if (String(url).includes('get-stripe-charges')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(stripeCharges) });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ charges: [], payouts: [], balance: null, connectStatus: 'active' }),
      });
    });

    render(<Billing />);
    await waitFor(() => screen.getByText('Billing & Payouts'));

    fireEvent.click(screen.getByText('Charges'));

    await waitFor(() => screen.getByText('Fall Launch'));
    expect(screen.getByText('$500')).toBeInTheDocument();
    expect(screen.getByText('$60')).toBeInTheDocument(); // real Stripe application_fee_amount, not a computed 12%
  });
});
