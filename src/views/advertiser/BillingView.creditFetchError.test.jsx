import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import BillingView from './BillingView.jsx';
import { ToastProvider } from '../../components/primitives/Toast.jsx';
import { ConfirmProvider } from '../../components/primitives/ConfirmModal.jsx';

function renderBillingView() {
  return render(<ToastProvider><ConfirmProvider><BillingView /></ConfirmProvider></ToastProvider>);
}

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ profile: { id: 'adv-1', credits: 0 } }),
}));

function chain(resolveValue) {
  const q = {};
  ['select', 'eq', 'gt', 'not', 'order', 'limit', 'in'].forEach(m => { q[m] = vi.fn(() => q); });
  q.then = (resolve) => Promise.resolve(resolveValue).then(resolve);
  return q;
}

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    auth: { getSession: vi.fn(() => Promise.resolve({ data: { session: { access_token: 'tok' } } })) },
    from: vi.fn((table) => {
      if (table === 'delivery_reconciliation') {
        return chain({ data: null, error: { message: 'RLS denied' } });
      }
      return chain({ data: [] });
    }),
  },
}));

describe('BillingView — delivery credit fetch failure', () => {
  it('shows an error notice instead of silently rendering as zero credits', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ invoices: [], paymentMethods: [], portalUrl: null }),
    }));
    renderBillingView();
    await waitFor(() => screen.getByText(/Couldn't load your delivery credits/));
    // B: previously this exact scenario (a failed delivery_reconciliation
    // query) rendered with no error indicator at all -- indistinguishable
    // from a genuinely empty credits list.
    expect(screen.queryByText('Delivery Credits')).not.toBeInTheDocument();
  });
});
