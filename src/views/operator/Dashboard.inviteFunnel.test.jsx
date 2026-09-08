import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { Dashboard } from './Dashboard.jsx';

// Screen Referral Invite spec, P1: "Surface aggregate invite performance
// (sent / viewed / signed-up / booked counts) on the operator's main
// Dashboard, not just per-screen on Screen Detail."

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ profile: { connect_status: 'active', owner_revenue_share: 0.55 } }),
}));

function chain(resolveValue) {
  const q = {};
  ['select', 'gte', 'lt', 'in', 'order'].forEach(m => { q[m] = vi.fn(() => q); });
  q.then = (resolve) => Promise.resolve(resolveValue).then(resolve);
  return q;
}

const invites = [
  { status: 'pending' }, { status: 'viewed' }, { status: 'signed_up' }, { status: 'booked' }, { status: 'booked' },
];

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    from: vi.fn((table) => {
      if (table === 'screen_invites') return chain({ data: invites, error: null });
      return chain({ data: [] });
    }),
    auth: { getSession: vi.fn(() => Promise.resolve({ data: { session: { access_token: 'tok' } } })) },
  },
}));

const dbScreens = [{ id: 's1', operator_id: 'op-1' }, { id: 's2', operator_id: 'op-1' }];

describe('Dashboard — screen invite funnel summary', () => {
  it('shows aggregate sent/viewed/signed-up/booked counts across all screens', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ balance: null, connectStatus: 'active' }) }));

    render(<Dashboard dbScreens={dbScreens} setNav={() => {}} loading={false} />);

    const heading = await screen.findByText('Screen Invite Performance');
    const card = heading.closest('div').parentElement;
    expect(within(card).getByText('5')).toBeInTheDocument(); // Sent
    expect(within(card).getByText('2')).toBeInTheDocument(); // Booked
    expect(within(card).getAllByText('1')).toHaveLength(2); // Viewed, Signed Up
  });

  it('hides the card entirely when no invites have been sent', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ balance: null, connectStatus: 'active' }) }));

    render(<Dashboard dbScreens={[]} setNav={() => {}} loading={false} />);

    await waitFor(() => screen.getByText('Dashboard'));
    expect(screen.queryByText('Screen Invite Performance')).not.toBeInTheDocument();
  });
});
