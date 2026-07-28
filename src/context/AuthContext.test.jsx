import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext.jsx';

function emptyBuilder() {
  const b = {};
  b.select = vi.fn(() => b);
  b.eq = vi.fn(() => b);
  b.in = vi.fn(() => b);
  b.then = (resolve) => resolve({ data: [] });
  return b;
}

vi.mock('../lib/supabase.js', () => {
  const profilesSingle = vi.fn();
  const profileBuilder = {};
  profileBuilder.select = vi.fn(() => profileBuilder);
  profileBuilder.eq = vi.fn(() => profileBuilder);
  profileBuilder.single = profilesSingle;

  return {
    supabase: {
      auth: {
        getSession: vi.fn(),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
      from: vi.fn((table) => (table === 'profiles' ? profileBuilder : emptyBuilder())),
    },
    __profilesSingle: profilesSingle,
  };
});

import { supabase, __profilesSingle } from '../lib/supabase.js';

function Probe() {
  const { profile, refreshProfile, loading } = useAuth();
  if (loading) return <div>loading</div>;
  return (
    <div>
      <div data-testid="name">{profile?.name ?? ''}</div>
      <button onClick={() => refreshProfile()}>refresh</button>
    </div>
  );
}

describe('AuthContext refreshProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refetches the profile and updates every consumer of useAuth()', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u-1' } } } });
    __profilesSingle
      .mockResolvedValueOnce({ data: { id: 'u-1', name: 'Old Name', active_mode: 'advertiser' } })
      .mockResolvedValueOnce({ data: { id: 'u-1', name: 'New Name', active_mode: 'advertiser' } });

    render(<AuthProvider><Probe /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('name').textContent).toBe('Old Name'));

    await act(async () => {
      fireEvent.click(screen.getByText('refresh'));
    });

    await waitFor(() => expect(screen.getByTestId('name').textContent).toBe('New Name'));
    expect(__profilesSingle).toHaveBeenCalledTimes(2);
  });

  it('is a no-op that resolves without querying when signed out', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });

    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('name').textContent).toBe(''));

    await act(async () => {
      fireEvent.click(screen.getByText('refresh'));
    });

    expect(__profilesSingle).not.toHaveBeenCalled();
  });
});
