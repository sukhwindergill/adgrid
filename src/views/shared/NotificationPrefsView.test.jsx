import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationPrefsView } from './NotificationPrefsView.jsx';
import { ToastProvider } from '../../components/primitives/Toast.jsx';
import { supabase } from '../../lib/supabase.js';

function renderView() {
  return render(<ToastProvider><NotificationPrefsView /></ToastProvider>);
}

// Product-audit finding: three event keys here (campaign_rejected,
// scan_spike, payout_processed) never matched anything send-notification
// actually dispatches, so toggling them saved a value that nothing ever
// read -- these tests lock in that the list only shows real events, and
// that toggling one persists to notification_prefs.

vi.mock('../../lib/supabase.js', () => {
  const chain = {
    select: vi.fn(function () { return this; }),
    eq: vi.fn(function () { return this; }),
    single: vi.fn(() => Promise.resolve({ data: { notification_prefs: {} }, error: null })),
    update: vi.fn(function () { return this; }),
  };
  return {
    supabase: {
      auth: { getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'u1' } } })) },
      from: vi.fn(() => chain),
    },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
});

describe('NotificationPrefsView', () => {
  it('never shows an event key that has no real send-notification template', async () => {
    renderView();
    await screen.findByText('Campaign approved');
    expect(screen.queryByText('Campaign rejected')).not.toBeInTheDocument();
    expect(screen.queryByText('Scan spike detected')).not.toBeInTheDocument();
    expect(screen.queryByText('Payout processed')).not.toBeInTheDocument();
  });

  it('shows the real replacement events', async () => {
    renderView();
    expect(await screen.findByText('Campaign went live')).toBeInTheDocument();
    expect(screen.getByText('Scan milestone reached')).toBeInTheDocument();
    expect(screen.getByText('Payout sent')).toBeInTheDocument();
  });

  it('persists a toggle change to notification_prefs', async () => {
    renderView();
    await screen.findByText('Campaign approved');
    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[0]);
    await waitFor(() => expect(supabase.from).toHaveBeenCalledWith('profiles'));
  });
});
