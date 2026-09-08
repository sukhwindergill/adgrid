import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import BillingView from './BillingView.jsx';
import { ToastProvider } from '../../components/primitives/Toast.jsx';
import { ConfirmProvider } from '../../components/primitives/ConfirmModal.jsx';

// Story Map (Money & Trust epic): "I want to be warned before a saved
// payment method expires... so a campaign doesn't quietly pause mid-flight
// because a card lapsed." Payment methods were already fetched and shown,
// just never compared against today's date.

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

function renderBilling() {
  return render(<ToastProvider><ConfirmProvider><BillingView /></ConfirmProvider></ToastProvider>);
}

describe('BillingView — default card expiry warning', () => {
  it('warns when the default card is expiring soon, naming the card and days left', async () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 20);
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        invoices: [], portalUrl: null,
        paymentMethods: [{ id: 'pm_1', brand: 'visa', last4: '4242', expMonth: soon.getMonth() + 1, expYear: soon.getFullYear(), isDefault: true }],
      }),
    }));
    renderBilling();
    await waitFor(() => expect(screen.getByText(/expires soon/)).toBeInTheDocument());
    expect(screen.getAllByText(/4242/).length).toBeGreaterThan(0);
  });

  it('shows nothing when the default card is valid well into the future', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        invoices: [], portalUrl: null,
        paymentMethods: [{ id: 'pm_1', brand: 'visa', last4: '4242', expMonth: 6, expYear: new Date().getFullYear() + 3, isDefault: true }],
      }),
    }));
    renderBilling();
    await waitFor(() => screen.getByText('Billing'));
    expect(screen.queryByText(/expires soon/)).not.toBeInTheDocument();
    expect(screen.queryByText(/has expired/)).not.toBeInTheDocument();
  });

  it('does not warn about a non-default card that has already lapsed', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        invoices: [], portalUrl: null,
        paymentMethods: [
          { id: 'pm_1', brand: 'visa', last4: '1111', expMonth: 1, expYear: 2020, isDefault: false },
          { id: 'pm_2', brand: 'mastercard', last4: '9999', expMonth: 6, expYear: new Date().getFullYear() + 3, isDefault: true },
        ],
      }),
    }));
    renderBilling();
    await waitFor(() => screen.getByText('Billing'));
    expect(screen.queryByText(/has expired/)).not.toBeInTheDocument();
  });
});
