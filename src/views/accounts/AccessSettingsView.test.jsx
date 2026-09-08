import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Story Map (Agency epic): "I want an audit log of what a delegated team
// member or agency changed on my account, so I can trust granting access
// without losing visibility into what happens with it." Activity rows come
// from account_activity_log, written only by a DB trigger on account_grants.

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { id: 'acct-1' } }),
}));

function chain(resolveValue) {
  const q = {};
  ['select', 'eq', 'neq', 'order', 'limit'].forEach(m => { q[m] = vi.fn(() => q); });
  q.then = (resolve) => Promise.resolve(resolveValue).then(resolve);
  return q;
}

function mockSupabase({ grants = { data: [] }, activity = { data: [] } } = {}) {
  return {
    supabase: {
      from: vi.fn((table) => {
        if (table === 'account_activity_log') return chain(activity);
        return chain(grants);
      }),
    },
  };
}

describe('AccessSettingsView — activity log', () => {
  beforeEach(() => { vi.resetModules(); });

  it('lists activity entries in human-readable form', async () => {
    vi.doMock('../../lib/supabase.js', () => mockSupabase({
      activity: {
        data: [
          { id: 'a1', action: 'grant_created', role: 'manager', created_at: '2026-01-01T00:00:00Z', grantee: { name: 'Jane' } },
          { id: 'a2', action: 'access_revoked', role: 'viewer', created_at: '2026-01-02T00:00:00Z', grantee: { name: 'Sam' } },
        ],
      },
    }));
    const { AccessSettingsView: View } = await import('./AccessSettingsView.jsx');
    render(<View />);
    await waitFor(() => expect(screen.getByText('Jane was invited as manager')).toBeInTheDocument());
    expect(screen.getByText("Sam's access was revoked (was viewer)")).toBeInTheDocument();
  });

  it('shows an empty state when there is no activity yet', async () => {
    vi.doMock('../../lib/supabase.js', () => mockSupabase());
    const { AccessSettingsView: View } = await import('./AccessSettingsView.jsx');
    render(<View />);
    await waitFor(() => expect(screen.getByText('No access changes on your account yet.')).toBeInTheDocument());
  });

  it('shows an error message when the activity fetch fails', async () => {
    vi.doMock('../../lib/supabase.js', () => mockSupabase({ activity: { data: null, error: { message: 'boom' } } }));
    const { AccessSettingsView: View } = await import('./AccessSettingsView.jsx');
    render(<View />);
    await waitFor(() => expect(screen.getByText(/Couldn't load activity/)).toBeInTheDocument());
  });
});
