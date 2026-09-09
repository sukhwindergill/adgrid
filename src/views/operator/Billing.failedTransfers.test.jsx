import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

// B16: operator_transfers.status = 'failed' rows used to be invisible
// anywhere in the UI. Confirms the Billing page surfaces them in a banner
// instead of only being discoverable via raw SQL.
//
// Product-audit finding (later session): visibility alone left the
// operator with nowhere to go but "contact support" -- trigger-payout, the
// edge function documented as the retry path, had no caller. These tests
// also confirm the added Retry button actually calls it.

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

  it('retries a failed transfer via trigger-payout using the booking period', async () => {
    failedRows = [
      {
        id: 't1', booking_id: 'b1', amount: 120, currency: 'cad', created_at: '2026-08-01',
        bookings: { start_date: '2026-08-01', end_date: '2026-08-15', advertiser_name: 'Acme Co' },
      },
    ];
    global.fetch = vi.fn((url) => {
      if (String(url).includes('trigger-payout')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, transfers: [{}], failures: [] }) });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ charges: [], payouts: [], balance: null, connectStatus: 'active' }),
      });
    });

    render(<Billing />);
    await waitFor(() => expect(screen.getByText(/Acme Co/)).toBeInTheDocument());

    fireEvent.click(screen.getByText('Retry'));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/trigger-payout'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer x' }),
      }),
    ));
    const call = global.fetch.mock.calls.find(([url]) => String(url).includes('trigger-payout'));
    const body = JSON.parse(call[1].body);
    expect(body).toEqual({ periodStart: '2026-08-01', periodEnd: '2026-08-15' });
  });

  it('reports a retry failure without pretending it succeeded', async () => {
    failedRows = [
      {
        id: 't1', booking_id: 'b1', amount: 120, currency: 'cad', created_at: '2026-08-01',
        bookings: { start_date: '2026-08-01', end_date: '2026-08-15', advertiser_name: 'Acme Co' },
      },
    ];
    global.fetch = vi.fn((url) => {
      if (String(url).includes('trigger-payout')) {
        return Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'Stripe Connect account not active' }) });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ charges: [], payouts: [], balance: null, connectStatus: 'active' }),
      });
    });

    render(<Billing />);
    await waitFor(() => expect(screen.getByText(/Acme Co/)).toBeInTheDocument());
    fireEvent.click(screen.getByText('Retry'));

    // The row must still be present -- a failed retry does not clear it.
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.getByText(/Acme Co/)).toBeInTheDocument();
  });
});
