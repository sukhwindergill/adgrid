import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { createClient } from '@supabase/supabase-js';

const mockSupabase = createClient('', '');

const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

describe('AuthContext', () => {
  beforeEach(() => jest.clearAllMocks());

  it('starts with loading=true then resolves to no user', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it('signIn calls auth-security\'s sign_in action and hydrates the session it returns', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({
        session: { access_token: 'at-1', refresh_token: 'rt-1' },
      }),
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.signIn('test@example.com', 'password');
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth-security'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'sign_in', email: 'test@example.com', password: 'password' }),
      }),
    );
    expect(mockSupabase.auth.signInWithPassword).not.toHaveBeenCalled();
    expect(mockSupabase.auth.setSession).toHaveBeenCalledWith({
      access_token: 'at-1',
      refresh_token: 'rt-1',
    });
  });

  it('signIn returns the error from auth-security without calling setSession', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ error: { message: 'Too many failed attempts. Try again in 15 minutes.' } }),
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    let outcome;
    await act(async () => {
      outcome = await result.current.signIn('test@example.com', 'password');
    });

    expect(outcome.error.message).toBe('Too many failed attempts. Try again in 15 minutes.');
    expect(mockSupabase.auth.setSession).not.toHaveBeenCalled();
  });

  it('signOut calls supabase.auth.signOut', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.signOut(); });
    expect(mockSupabase.auth.signOut).toHaveBeenCalled();
  });

  it('exposes profileError and leaves profile null when the profile fetch fails', async () => {
    mockSupabase.auth.getSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'u-1' } } },
      error: null,
    });
    mockSupabase.from.mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: { message: 'RLS denied' } }),
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.profile).toBeNull();
    expect(result.current.profileError).toBe('RLS denied');
  });

  it('PASSWORD_RECOVERY event sets passwordRecovery without setting user', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const authStateCallback = mockSupabase.auth.onAuthStateChange.mock.calls[0][0];
    act(() => { authStateCallback('PASSWORD_RECOVERY', { user: { id: 'u-1' } }); });

    expect(result.current.passwordRecovery).toBe(true);
    expect(result.current.user).toBeNull();
  });

  it('resetPasswordForEmail calls auth-security\'s request_reset action', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ ok: true }),
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.resetPasswordForEmail('test@example.com'); });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth-security'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'request_reset', email: 'test@example.com' }),
      }),
    );
    expect(mockSupabase.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('verifyRecoveryCode calls supabase.auth.verifyOtp with type recovery', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.verifyRecoveryCode('test@example.com', '123456'); });
    expect(mockSupabase.auth.verifyOtp).toHaveBeenCalledWith({
      email: 'test@example.com', token: '123456', type: 'recovery',
    });
  });

  it('updatePassword calls supabase.auth.updateUser and resets passwordRecovery', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const authStateCallback = mockSupabase.auth.onAuthStateChange.mock.calls[0][0];
    act(() => { authStateCallback('PASSWORD_RECOVERY', {}); });
    expect(result.current.passwordRecovery).toBe(true);

    await act(async () => { await result.current.updatePassword('newpass123'); });
    expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({ password: 'newpass123' });
    expect(result.current.passwordRecovery).toBe(false);
  });
});
