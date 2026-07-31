import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProfileTab } from './SettingsView.jsx';

const refreshProfile = vi.fn();

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ refreshProfile }),
}));

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
    })),
  },
}));

import { supabase } from '../../lib/supabase.js';

const profile = { id: 'u-1', name: 'Old Name', timezone: 'UTC', preferred_currency: 'cad' };

describe('ProfileTab', () => {
  beforeEach(() => {
    refreshProfile.mockClear();
    supabase.from.mockClear();
  });

  it('refreshes the AuthContext profile after a successful save so other consumers see the change', async () => {
    render(<ProfileTab profile={profile} onSaved={() => {}} />);

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => screen.getByText('Saved.'));
    expect(refreshProfile).toHaveBeenCalledTimes(1);
  });

  it('does not refresh the AuthContext profile when the save fails', async () => {
    supabase.from.mockReturnValueOnce({
      update: () => ({ eq: () => Promise.resolve({ error: { message: 'boom' } }) }),
    });

    render(<ProfileTab profile={profile} onSaved={() => {}} />);

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => screen.getByText('Error saving.'));
    expect(refreshProfile).not.toHaveBeenCalled();
  });
});
