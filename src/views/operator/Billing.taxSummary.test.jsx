import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Story Map (Operator epic): "year-end summary of my AdGrid earnings
// formatted for tax filing" -- the summary action's 20-payout cap wasn't
// enough for a full year, so this exercises the dedicated tax_summary
// fetch that only fires once the tab is opened.

vi.mock('../../components/primitives/Toast.jsx', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [] }) }) }) }),
    auth: { getSession: () => Promise.resolve({ data: { session: { access_token: 'x' } } }) },
  },
}));

const thisYear = new Date().getFullYear();

function mockFetch() {
  global.fetch = vi.fn((url) => {
    if (String(url).includes('action=summary')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ charges: [], payouts: [], balance: null, connectStatus: 'active' }) });
    }
    if (String(url).includes('action=tax_summary')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          year: thisYear,
          payouts: [
            { id: 'po_1', amount: 500, status: 'paid', arrival_date: `${thisYear}-01-15`, currency: 'cad' },
            { id: 'po_2', amount: 300, status: 'paid', arrival_date: `${thisYear}-02-01`, currency: 'cad' },
          ],
        }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

import { Billing } from './Billing.jsx';

describe('Billing tax summary tab', () => {
  it('fetches and totals a full year of payouts only once the tab is opened', async () => {
    mockFetch();
    render(<Billing />);

    await waitFor(() => screen.getByText('Billing & Payouts'));
    expect(global.fetch.mock.calls.some(c => String(c[0]).includes('action=tax_summary'))).toBe(false);

    fireEvent.click(screen.getByText('Tax Summary'));

    await waitFor(() => expect(screen.getByText(`$800 CAD`)).toBeInTheDocument());
    expect(global.fetch.mock.calls.some(c => String(c[0]).includes('action=tax_summary'))).toBe(true);
  });
});
