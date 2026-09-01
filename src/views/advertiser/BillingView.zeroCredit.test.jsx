import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import BillingView from './BillingView.jsx';
import { ToastProvider } from '../../components/primitives/Toast.jsx';
import { ConfirmProvider } from '../../components/primitives/ConfirmModal.jsx';

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
    from: vi.fn(() => chain({ data: [] })),
  },
}));

describe('BillingView — zero credit balance', () => {
  it('does not show the account credit banner when there is nothing to show', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ invoices: [], paymentMethods: [], portalUrl: null }),
    }));
    render(<ToastProvider><ConfirmProvider><BillingView /></ConfirmProvider></ToastProvider>);
    await waitFor(() => screen.getByText('Billing'));
    expect(screen.queryByText('Account Credit')).not.toBeInTheDocument();
  });
});
