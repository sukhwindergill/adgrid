import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Screen Referral Invite P1 (docs/superpowers/specs/2026-08-11-screen-referral-invite-design.md):
// "Suggested share copy/template text next to the invite link" and
// "QR code rendering of the invite URL ... for operators who'd rather show
// it in person than send a link."

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { id: 'op-1' } }),
}));

const writeText = vi.fn(() => Promise.resolve());
Object.assign(navigator, { clipboard: { writeText } });

const screenRow = {
  id: 'screen-1', name: 'Riverside Gym Lobby', owner_id: 'op-1', status: 'live',
  city: 'Toronto', location: 'Front desk', monthly_revenue: 0, impressions: 0,
};

const inviteRow = {
  id: 'inv-1', token: 'tok-abc123', status: 'pending', view_count: 0,
  created_at: '2026-09-01T00:00:00Z', converted_advertiser_id: null, converted_campaign_id: null,
};

function chain(resolveValue) {
  const q = {};
  ['select', 'eq', 'neq', 'gte', 'order', 'limit', 'single'].forEach(m => { q[m] = vi.fn(() => q); });
  q.then = (resolve) => Promise.resolve(resolveValue).then(resolve);
  return q;
}

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    from: vi.fn((table) => {
      if (table === 'screens') return chain({ data: screenRow, error: null });
      if (table === 'screen_invites') return chain({ data: [inviteRow], error: null });
      if (table === 'delivery_reconciliation') return chain({ data: [], error: null });
      if (table === 'display_heartbeats') return chain({ data: [], error: null });
      if (table === 'bookings') return chain({ data: [], error: null });
      return chain({ data: [], error: null });
    }),
    rpc: vi.fn((fn) => {
      if (fn === 'get_screen_invite_advertiser_names') return Promise.resolve({ data: [] });
      return Promise.resolve({ data: null });
    }),
  },
}));

import { ScreenDetailView } from './ScreenDetail.jsx';

describe('ScreenDetail — invite share copy & QR code', () => {
  beforeEach(() => { writeText.mockClear(); });

  it('copies a personalized share message including the screen name and invite link', async () => {
    render(<ScreenDetailView screenId="screen-1" onBack={() => {}} profile={{ connect_status: 'active' }} onScreenUpdated={() => {}} />);

    fireEvent.click(await screen.findByText('Copy message'));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const [copied] = writeText.mock.calls[0];
    expect(copied).toContain('Riverside Gym Lobby');
    expect(copied).toContain('/invite/screen/tok-abc123');
  });

  it('toggles a QR code for the invite link on demand', async () => {
    render(<ScreenDetailView screenId="screen-1" onBack={() => {}} profile={{ connect_status: 'active' }} onScreenUpdated={() => {}} />);

    const showQrBtn = await screen.findByText('Show QR');
    expect(screen.queryByText('Hide QR')).not.toBeInTheDocument();

    fireEvent.click(showQrBtn);
    expect(await screen.findByText('Hide QR')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Hide QR'));
    await waitFor(() => expect(screen.queryByText('Hide QR')).not.toBeInTheDocument());
  });
});
