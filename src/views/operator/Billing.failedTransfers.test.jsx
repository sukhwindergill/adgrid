import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// B16: operator_transfers.status = 'failed' rows used to be invisible
// anywhere in the UI. Confirms the Billing page surfaces them in a banner
// instead of only being discoverable via raw SQL.

vi.mock('../../components/primitives/Toast.jsx', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

let failedRows = [];

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    from: (table) => {
      if (table === 'operator_transfers') {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: failedRows }),
            }),
          }),
        };
      }
      return { select: () => ({ eq: () => Promise.resolve({ data: [] }) }) };
    },
    auth: { getSession: () => Promise.resolve({ data: { session: { access_token: 'x' } } }) },
  },
}));

import { Billing } from './Billing.jsx';

function mockSummaryFetch() {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ charges: [], payouts: [], balance: null, connectStatus: 'active' }),
  });
}

describe('Billing failed-transfer visibility', () => {
  beforeEach(() => {
    mockSummaryFetch();
  });

  it('shows a banner naming the failed-transfer total when any exist', async () => {
    failedRows = [
      { id: 't1', booking_id: 'b1', amount: 120, currency: 'cad', created_at: '2026-08-01' },
      { id: 't2', booking_id: 'b2', amount: 80, currency: 'cad', created_at: '2026-08-02' },
    ];
    render(<Billing />);

    await waitFor(() => expect(screen.getByText(/2 payout transfers failed/)).toBeInTheDocument());
    expect(screen.getByText(/\$200/)).toBeInTheDocument();
  });

  it('shows no banner when there are no failed transfers', async () => {
    failedRows = [];
    render(<Billing />);

    await waitFor(() => expect(screen.getByText('Billing & Payouts')).toBeInTheDocument());
    expect(screen.queryByText(/payout transfer.*failed/)).not.toBeInTheDocument();
  });
});
