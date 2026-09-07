import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Spec #4: payouts are on-demand, not a fixed cadence — this locks in that
// the Connect Balance card tells the operator what's actually true instead
// of nothing: a payout already in flight with its real arrival date, or how
// long it's been since the last one landed.

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

function mockSummaryFetch(payouts) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ charges: [], payouts, balance: { available: 500, pending: 0 }, connectStatus: 'active' }),
  });
}

describe('Billing payout status', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('shows the in-flight payout with its real arrival date', async () => {
    mockSummaryFetch([{ id: 'po_1', amount: 500, status: 'pending', arrival_date: '2026-09-12' }]);
    render(<Billing />);

    await waitFor(() => expect(screen.getByText(/Next payout/)).toBeInTheDocument());
    expect(screen.getByText(/2026-09-12/)).toBeInTheDocument();
  });

  it('says no payout is scheduled and names the last one when nothing is in flight', async () => {
    mockSummaryFetch([{ id: 'po_1', amount: 300, status: 'paid', arrival_date: '2026-08-01' }]);
    render(<Billing />);

    await waitFor(() => expect(screen.getByText(/No payout scheduled/)).toBeInTheDocument());
    expect(screen.getByText(/\$300/)).toBeInTheDocument();
  });

  it('gives a first-payout-appropriate message when there is no payout history at all', async () => {
    mockSummaryFetch([]);
    render(<Billing />);

    await waitFor(() => expect(screen.getByText(/No payout scheduled/)).toBeInTheDocument());
    expect(screen.getByText(/whenever you want available funds sent/)).toBeInTheDocument();
  });
});
