import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProfileTab, SecurityTab } from './OperatorSettingsView.jsx';

const refreshProfile = vi.fn();
const updatePassword = vi.fn();

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ refreshProfile, updatePassword }),
}));

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
    })),
  },
}));

import { supabase } from '../../lib/supabase.js';

const profile = { id: 'op-1', name: 'Old Name', timezone: 'UTC' };

describe('OperatorSettingsView ProfileTab', () => {
  beforeEach(() => {
    refreshProfile.mockClear();
    supabase.from.mockClear();
  });

  describe('SecurityTab password change', () => {
    beforeEach(() => {
      updatePassword.mockClear();
    });

    // Product-audit finding: changing a password used to go straight
    // through supabase.auth.updateUser(), bypassing the one place
    // (AuthContext.updatePassword) that also revokes every other
    // signed-in session -- see supabase/functions/revoke-other-sessions.
    // Locks in that this tab now goes through that shared path.
    it('changes the password via AuthContext.updatePassword, not a direct supabase call', async () => {
      updatePassword.mockResolvedValue({ error: null });
      render(<SecurityTab />);

      const [pw, confirm] = document.querySelectorAll('input[type="password"]');
      fireEvent.change(pw, { target: { value: 'newpass123' } });
      fireEvent.change(confirm, { target: { value: 'newpass123' } });
      fireEvent.click(screen.getByText('Update Password'));

      await waitFor(() => expect(updatePassword).toHaveBeenCalledWith('newpass123'));
    });

    it('shows an error and never calls updatePassword when the passwords do not match', async () => {
      render(<SecurityTab />);

      fireEvent.change(document.querySelectorAll('input[type="password"]')[0], { target: { value: 'newpass123' } });
      fireEvent.change(document.querySelectorAll('input[type="password"]')[1], { target: { value: 'different123' } });
      fireEvent.click(screen.getByText('Update Password'));

      expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
      expect(updatePassword).not.toHaveBeenCalled();
    });
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
