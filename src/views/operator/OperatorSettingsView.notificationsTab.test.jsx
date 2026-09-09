// src/views/operator/OperatorSettingsView.notificationsTab.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationsTab } from './OperatorSettingsView.jsx';

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
    })),
  },
}));

import { supabase } from '../../lib/supabase.js';

describe('OperatorSettingsView NotificationsTab', () => {
  beforeEach(() => {
    supabase.from.mockClear();
  });

  it('renders an in-app and an email toggle for each of the 14 events', () => {
    render(<NotificationsTab profile={{ id: 'op-1' }} />);
    expect(screen.getAllByRole('switch')).toHaveLength(28);
  });

  it('upgrades a legacy flat-boolean profile.notification_prefs on load', () => {
    render(<NotificationsTab profile={{ id: 'op-1', notification_prefs: { campaign_approved: false } }} />);
    const switches = screen.getAllByRole('switch');
    // First event (campaign_approved) row: in-app then email toggle.
    expect(switches[0]).toHaveAttribute('aria-checked', 'false');
    expect(switches[1]).toHaveAttribute('aria-checked', 'false');
  });

  it('toggling the email switch for an event does not affect its in-app switch', () => {
    render(<NotificationsTab profile={{ id: 'op-1' }} />);
    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[1]); // campaign_approved / email
    expect(switches[0]).toHaveAttribute('aria-checked', 'true');
    expect(switches[1]).toHaveAttribute('aria-checked', 'false');
  });

  it('saves the nested per-channel shape', async () => {
    const updateSpy = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }));
    supabase.from.mockReturnValue({ update: updateSpy });

    render(<NotificationsTab profile={{ id: 'op-1' }} />);
    fireEvent.click(screen.getAllByRole('switch')[1]); // turn off campaign_approved email
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    const savedPrefs = updateSpy.mock.calls[0][0].notification_prefs;
    expect(savedPrefs.campaign_approved).toEqual({ inApp: true, email: false });
    expect(Object.keys(savedPrefs)).toHaveLength(14);
  });
});
