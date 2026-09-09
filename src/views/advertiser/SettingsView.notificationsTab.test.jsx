// src/views/advertiser/SettingsView.notificationsTab.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationsTab } from './SettingsView.jsx';

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
    })),
  },
}));

import { supabase } from '../../lib/supabase.js';

describe('advertiser SettingsView NotificationsTab', () => {
  beforeEach(() => {
    supabase.from.mockClear();
  });

  it('renders an in-app and an email toggle for each non-operator-only event, excluding operator-only ones', () => {
    render(<NotificationsTab profile={{ id: 'adv-1' }} />);
    // 10 non-operatorOnly events out of 14 (4 are operatorOnly).
    expect(screen.getAllByRole('switch')).toHaveLength(20);
    expect(screen.queryByText('New advertiser joined')).not.toBeInTheDocument();
    expect(screen.queryByText('Campaign submitted')).not.toBeInTheDocument();
    expect(screen.queryByText('Payout completed')).not.toBeInTheDocument();
    expect(screen.queryByText('Weekly revenue summary')).not.toBeInTheDocument();
  });

  it('upgrades a legacy flat-boolean profile.notification_prefs on load', () => {
    render(<NotificationsTab profile={{ id: 'adv-1', notification_prefs: { campaign_approved: false } }} />);
    const switches = screen.getAllByRole('switch');
    expect(switches[0]).toHaveAttribute('aria-checked', 'false');
    expect(switches[1]).toHaveAttribute('aria-checked', 'false');
  });

  it('toggling the in-app switch for an event does not affect its email switch', () => {
    render(<NotificationsTab profile={{ id: 'adv-1' }} />);
    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[0]); // campaign_approved / in-app
    expect(switches[0]).toHaveAttribute('aria-checked', 'false');
    expect(switches[1]).toHaveAttribute('aria-checked', 'true');
  });

  it('saves the nested per-channel shape', async () => {
    const updateSpy = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }));
    supabase.from.mockReturnValue({ update: updateSpy });

    render(<NotificationsTab profile={{ id: 'adv-1' }} />);
    fireEvent.click(screen.getAllByRole('switch')[0]); // turn off campaign_approved in-app
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    const savedPrefs = updateSpy.mock.calls[0][0].notification_prefs;
    expect(savedPrefs.campaign_approved).toEqual({ inApp: false, email: true });
    // Still saves all 14 (operator-only ones default, even though not shown).
    expect(Object.keys(savedPrefs)).toHaveLength(14);
  });
});
