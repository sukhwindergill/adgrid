import React from 'react';
import { render } from '@testing-library/react-native';
import BillingScreen from '../../app/(tabs)/more/billing';
import { createClient } from '@supabase/supabase-js';

const mockSupabase = createClient('', '');

beforeEach(() => {
  jest.clearAllMocks();
  mockSupabase.auth.getSession.mockResolvedValue({
    data: { session: { access_token: 'tok_123' } }, error: null,
  });
  global.fetch = jest.fn();
});

describe('BillingScreen', () => {
  it('shows Not connected and a Connect Stripe CTA when not connected', async () => {
    global.fetch.mockResolvedValue({
      ok: true, json: async () => ({ connectStatus: null, payouts: [], balance: null, charges: [] }),
    });
    const { findByText } = render(<BillingScreen />);
    expect(await findByText('Not connected')).toBeTruthy();
    expect(await findByText('Connect Stripe →')).toBeTruthy();
    expect(await findByText('Connect your Stripe account to see payout history.')).toBeTruthy();
  });

  it('shows payout history rows when connected with payouts', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        connectStatus: 'active',
        payouts: [{ id: 'po_1', amount: 42, status: 'paid', arrival_date: '2026-07-01', currency: 'cad' }],
        balance: null, charges: [],
      }),
    });
    const { findByText } = render(<BillingScreen />);
    expect(await findByText('Connected')).toBeTruthy();
    expect(await findByText('$42.00 CAD')).toBeTruthy();
    expect(await findByText('2026-07-01')).toBeTruthy();
    expect(await findByText('paid')).toBeTruthy();
  });

  it('shows an empty state when connected with no payouts', async () => {
    global.fetch.mockResolvedValue({
      ok: true, json: async () => ({ connectStatus: 'active', payouts: [], balance: null, charges: [] }),
    });
    const { findByText } = render(<BillingScreen />);
    expect(await findByText('No payouts yet. Your first payout will appear here once initiated.')).toBeTruthy();
  });
});
