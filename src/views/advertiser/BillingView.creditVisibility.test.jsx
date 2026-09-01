import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import BillingView from './BillingView.jsx';
import { ToastProvider } from '../../components/primitives/Toast.jsx';
import { ConfirmProvider } from '../../components/primitives/ConfirmModal.jsx';

function renderBillingView() {
  return render(<ToastProvider><ConfirmProvider><BillingView /></ConfirmProvider></ToastProvider>);
}

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ profile: { id: 'adv-1', credits: 42.5 } }),
}));

const reconRows = [
  { campaign_id: 'camp-1', screen_id: 'scr-1', day: '2026-08-20', reason: 'screen_offline', credit_amount: 30, currency: 'cad', credited_at: '2026-08-21T00:00:00Z' },
  { campaign_id: 'camp-2', screen_id: 'scr-2', day: '2026-08-18', reason: 'underdelivered', credit_amount: 12.5, currency: 'cad', credited_at: '2026-08-19T00:00:00Z' },
];
const bookingRows = [
  { id: 'camp-1', campaign_name: 'Back to School', screen_name: 'Yonge & Dundas' },
  { id: 'camp-2', campaign_name: 'Fall Launch', screen_name: 'Union Station' },
];

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
      if (table === 'delivery_reconciliation') return chain({ data: reconRows });
      if (table === 'bookings') return chain({ data: bookingRows });
      return chain({ data: [] });
    }),
  },
}));

describe('BillingView — account credit visibility', () => {
  beforeEach(() => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ invoices: [], paymentMethods: [], portalUrl: null }),
    }));
  });

  it('shows the profiles.credits balance instead of hiding it', async () => {
    renderBillingView();
    await waitFor(() => screen.getByText('Account Credit'));
    expect(screen.getByText('$42.50')).toBeInTheDocument();
  });

  it('explains each delivery credit with day, campaign, screen, and reason', async () => {
    renderBillingView();
    await waitFor(() => screen.getByText('Delivery Credits'));
    expect(screen.getByText('Back to School')).toBeInTheDocument();
    expect(screen.getByText('Fall Launch')).toBeInTheDocument();
    expect(screen.getByText('Yonge & Dundas')).toBeInTheDocument();
    expect(screen.getByText('Union Station')).toBeInTheDocument();
    expect(screen.getByText('Screen was offline')).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.textContent === '+$30.00 CAD')).toBeInTheDocument();
  });
});
