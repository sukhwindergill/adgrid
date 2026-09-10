import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const FUNCTIONS_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
  ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1`
  : '';

const AuthContext = createContext({});

// Platform-audit finding: mobile called supabase.auth.signInWithPassword and
// supabase.auth.resetPasswordForEmail directly, with no lockout or throttle
// at all -- not even the app-level "5 failures/15m" signal web had before
// its own security-audit fix. auth-security's `sign_in` and `request_reset`
// actions (already deployed) perform the real GoTrue call themselves and
// only log a failure/throttle-counted event from what GoTrue actually
// returned, matching what src/context/AuthContext.jsx's own fix does on
// web -- see auth-security/index.ts's header comment for the full threat
// model (a client-reported outcome, trusted with no verification, let an
// unauthenticated caller force a real lockout on any victim email with no
// password at all). Public, unauthenticated endpoint -- no session exists
// yet at sign-in time -- so this is a plain fetch, not supabase.functions.invoke
// (which would require a session), matching useBilling.js's/useRevenue.js's
// own fetch-with-bearer pattern for the endpoints that do need one.
async function authSecurity(action, body) {
  try {
    const res = await fetch(`${FUNCTIONS_URL}/auth-security`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    return data;
  } catch {
    return { error: { message: 'Network error' } };
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    setProfileError(error?.message ?? null);
    setProfile(data ?? null);
    return data;
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') { setPasswordRecovery(true); return; }
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email, password) {
    const { session, error } = await authSecurity('sign_in', { email, password });
    if (error) return { data: null, error };
    // sign_in performs the real GoTrue call itself (see auth-security's own
    // comment) and hands back the resulting session -- hydrate the local
    // client from it instead of calling signInWithPassword a second time.
    const { data, error: setSessionError } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    return { data, error: setSessionError };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }

  async function resetPasswordForEmail(email) {
    const result = await authSecurity('request_reset', { email });
    return { error: result.error ?? null };
  }

  async function verifyRecoveryCode(email, token) {
    return supabase.auth.verifyOtp({ email, token, type: 'recovery' });
  }

  async function updatePassword(password) {
    const result = await supabase.auth.updateUser({ password });
    if (!result.error) setPasswordRecovery(false);
    return result;
  }

  return (
    <AuthContext.Provider value={{
      user, profile, profileError, passwordRecovery, loading,
      signIn, signOut, resetPasswordForEmail, verifyRecoveryCode, updatePassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
