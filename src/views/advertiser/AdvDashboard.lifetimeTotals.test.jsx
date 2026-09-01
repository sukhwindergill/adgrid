import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AdvDashboard } from './AdvDashboard.jsx';

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { id: 'adv-1' } }),
}));

function chain(resolveValue) {
  const q = {};
  ['select', 'eq', 'in', 'order', 'limit'].forEach(m => { q[m] = vi.fn(() => q); });
  q.then = (resolve) => Promise.resolve(resolveValue).then(resolve);
  return q;
}

const rpcMock = vi.fn(() => Promise.resolve({
  data: [{ total_spend: 48250, total_scans: 900, total_budget: 60000 }],
  error: null,
}));

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    from: vi.fn(() => chain({ data: [] })), // no recent bookings needed for this
    rpc: (...args) => rpcMock(...args),
  },
}));

describe('AdvDashboard — lifetime totals via advertiser_lifetime_totals RPC', () => {
  it('shows all-time "Spent to Date" from the RPC, not the bounded recent-campaigns fetch', async () => {
    render(<AdvDashboard user={{ name: 'Test' }} setAdvNav={() => {}} advertiserId="adv-1" />);
    await waitFor(() => expect(screen.getByText('$48,250')).toBeInTheDocument());
    expect(rpcMock).toHaveBeenCalledWith('advertiser_lifetime_totals', { p_advertiser_id: 'adv-1' });
  });

  it('does not call the RPC without an advertiserId', () => {
    rpcMock.mockClear();
    render(<AdvDashboard user={{ name: 'Test' }} setAdvNav={() => {}} advertiserId={null} />);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
