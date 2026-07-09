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

  it('signIn calls supabase.auth.signInWithPassword', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.signIn('test@example.com', 'password');
    });
    expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password',
    });
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

  it('resetPasswordForEmail calls supabase.auth.resetPasswordForEmail', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.resetPasswordForEmail('test@example.com'); });
    expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('test@example.com');
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
