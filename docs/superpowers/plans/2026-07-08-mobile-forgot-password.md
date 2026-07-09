# Mobile Forgot-Password Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a self-service password-reset flow to the Operator mobile app using an in-app 6-digit code, so a locked-out operator can regain access without leaving the app.

**Architecture:** `mobile/context/AuthContext.jsx` gains three new Supabase Auth wrapper methods (`resetPasswordForEmail`, `verifyRecoveryCode`, `updatePassword`) and a `passwordRecovery` flag driven by the `PASSWORD_RECOVERY` auth event. `mobile/app/login.jsx` gains a `mode` state machine (`signin` → `forgot` → `code`) rendered inline in the existing screen — no new routes.

**Tech Stack:** Expo Router, React Native, `@supabase/supabase-js` (`verifyOtp({ type: 'recovery' })`), Jest + `@testing-library/react-native`.

Spec: `docs/superpowers/specs/2026-07-08-mobile-forgot-password-design.md`

---

### Task 1: Extend the Supabase Auth mock

**Files:**
- Modify: `mobile/__mocks__/@supabase/supabase-js.js:21-29`

- [ ] **Step 1: Add the three new auth methods to `mockAuth`**

Open `mobile/__mocks__/@supabase/supabase-js.js` and replace the `mockAuth` object:

```js
const mockAuth = {
  getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
  signInWithPassword: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
  signUp: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
  signOut: jest.fn().mockResolvedValue({ error: null }),
  resetPasswordForEmail: jest.fn().mockResolvedValue({ data: {}, error: null }),
  verifyOtp: jest.fn().mockResolvedValue({ data: { session: null, user: null }, error: null }),
  updateUser: jest.fn().mockResolvedValue({ data: {}, error: null }),
  onAuthStateChange: jest.fn(() => ({
    data: { subscription: { unsubscribe: jest.fn() } },
  })),
};
```

- [ ] **Step 2: Commit**

```bash
git add mobile/__mocks__/@supabase/supabase-js.js
git commit -m "test(mobile): add resetPasswordForEmail/verifyOtp/updateUser mocks"
```

---

### Task 2: `AuthContext` — password recovery methods

**Files:**
- Modify: `mobile/context/AuthContext.jsx`
- Test: `mobile/__tests__/AuthContext.test.jsx`

- [ ] **Step 1: Write the failing tests**

Append to `mobile/__tests__/AuthContext.test.jsx` (inside the existing `describe('AuthContext', ...)` block, after the `signOut` test):

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd mobile && npx jest __tests__/AuthContext.test.jsx`
Expected: FAIL — `result.current.resetPasswordForEmail is not a function` (and similar for the other three new tests). The two pre-existing tests still pass.

- [ ] **Step 3: Implement the context changes**

In `mobile/context/AuthContext.jsx`, replace the whole file with:

```jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }

  async function resetPasswordForEmail(email) {
    return supabase.auth.resetPasswordForEmail(email);
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mobile && npx jest __tests__/AuthContext.test.jsx`
Expected: PASS — all 7 tests (3 pre-existing + 4 new).

- [ ] **Step 5: Commit**

```bash
git add mobile/context/AuthContext.jsx mobile/__tests__/AuthContext.test.jsx
git commit -m "feat(mobile): add password recovery methods to AuthContext"
```

---

### Task 3: Add `maxLength` passthrough to `Inp`

The code-entry field needs a hard 6-character cap. `Inp` currently doesn't forward `maxLength` to the underlying `TextInput`.

**Files:**
- Modify: `mobile/components/ui/Inp.jsx`

- [ ] **Step 1: Add `maxLength` to the prop list and forward it**

In `mobile/components/ui/Inp.jsx`, change the function signature (line 5):

```js
export function Inp({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, autoCapitalize = 'none', error, multiline, numberOfLines, editable, maxLength }) {
```

And add `maxLength={maxLength}` to the `TextInput` props (alongside the existing `editable={editable !== false}` line):

```js
        editable={editable !== false}
        maxLength={maxLength}
```

- [ ] **Step 2: Run the full mobile test suite to confirm no regressions**

Run: `cd mobile && npx jest`
Expected: PASS — all existing suites unaffected (this is an additive, optional prop; `maxLength={undefined}` is a no-op in React Native).

- [ ] **Step 3: Commit**

```bash
git add mobile/components/ui/Inp.jsx
git commit -m "feat(mobile): forward maxLength prop through Inp"
```

---

### Task 4: `login.jsx` — forgot-password UI

**Files:**
- Modify: `mobile/app/login.jsx`
- Test: `mobile/__tests__/login.test.jsx`

- [ ] **Step 1: Write the failing tests**

Append to `mobile/__tests__/login.test.jsx` (inside the existing `describe('LoginScreen', ...)` block):

```js
  it('shows forgot password link and switches to the forgot form', () => {
    const { getByText, queryByPlaceholderText } = render(<LoginScreen />, { wrapper });
    fireEvent.press(getByText('Forgot password?'));
    expect(queryByPlaceholderText('Password')).toBeNull();
    expect(getByText('Send reset code')).toBeTruthy();
  });

  it('submits email and advances to the code screen on success', async () => {
    const { getByText, getByPlaceholderText, findByText } = render(<LoginScreen />, { wrapper });
    fireEvent.press(getByText('Forgot password?'));
    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'test@example.com');
    fireEvent.press(getByText('Send reset code'));
    expect(await findByText('Check your email for a reset code.')).toBeTruthy();
    expect(getByText('Reset password')).toBeTruthy();
  });

  it('shows an inline error for a malformed code without calling the network', async () => {
    const { getByText, getByPlaceholderText, findByText } = render(<LoginScreen />, { wrapper });
    fireEvent.press(getByText('Forgot password?'));
    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'test@example.com');
    fireEvent.press(getByText('Send reset code'));
    await findByText('Reset password');

    fireEvent.changeText(getByPlaceholderText('123456'), 'abc');
    fireEvent.changeText(getByPlaceholderText('New password'), 'newpass123');
    fireEvent.press(getByText('Reset password'));

    expect(await findByText('Enter the 6-digit code from your email.')).toBeTruthy();
  });

  it('completes the reset and returns to sign-in with a success message', async () => {
    const { getByText, getByPlaceholderText, findByText } = render(<LoginScreen />, { wrapper });
    fireEvent.press(getByText('Forgot password?'));
    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'test@example.com');
    fireEvent.press(getByText('Send reset code'));
    await findByText('Reset password');

    fireEvent.changeText(getByPlaceholderText('123456'), '123456');
    fireEvent.changeText(getByPlaceholderText('New password'), 'newpass123');
    fireEvent.press(getByText('Reset password'));

    expect(await findByText('Password updated. You can now sign in.')).toBeTruthy();
    expect(getByText('Sign in')).toBeTruthy();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd mobile && npx jest __tests__/login.test.jsx`
Expected: FAIL — `getByText('Forgot password?')` throws "Unable to find an element with text: Forgot password?" (the link doesn't exist yet). The 3 pre-existing tests still pass.

- [ ] **Step 3: Implement `login.jsx`**

Replace the whole file `mobile/app/login.jsx`:

```jsx
import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { Inp } from '../components/ui/Inp';
import { Btn } from '../components/ui/Btn';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { C, F, gradColors, gradStart, gradEnd } from '../lib/tokens';

const CODE_RE = /^\d{6}$/;

export default function LoginScreen() {
  const { signIn, resetPasswordForEmail, verifyRecoveryCode, updatePassword } = useAuth();
  const [mode, setMode] = useState('signin'); // 'signin' | 'forgot' | 'code'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required');
      return;
    }
    setError('');
    setLoading(true);
    const { error: authError } = await signIn(email.trim(), password);
    setLoading(false);
    if (authError) setError(authError.message);
  }

  async function handleForgot() {
    if (!email.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    setError(''); setSuccess(''); setLoading(true);
    const { error: err } = await resetPasswordForEmail(email.trim());
    setLoading(false);
    if (err) { setError(err.message); return; }
    setSuccess('Check your email for a reset code.');
    setMode('code');
  }

  async function handleResetPassword() {
    if (!CODE_RE.test(code)) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setError('');
    setLoading(true);
    if (!verified) {
      const { error: verifyErr } = await verifyRecoveryCode(email.trim(), code.trim());
      if (verifyErr) {
        setLoading(false);
        setError(verifyErr.message);
        return;
      }
      setVerified(true);
    }
    const { error: updateErr } = await updatePassword(newPassword);
    setLoading(false);
    if (updateErr) { setError(updateErr.message); return; }
    setMode('signin');
    setPassword('');
    setCode('');
    setNewPassword('');
    setVerified(false);
    setSuccess('Password updated. You can now sign in.');
  }

  function startOver() {
    setMode('forgot');
    setCode(''); setNewPassword(''); setVerified(false);
    setError(''); setSuccess('');
  }

  function goToForgot() {
    setMode('forgot');
    setError(''); setSuccess('');
  }

  function backToSignIn() {
    setMode('signin');
    setError(''); setSuccess('');
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={gradColors} start={gradStart} end={gradEnd} style={styles.strip} />
        <View style={styles.container}>
          <Text style={[styles.brand, { fontFamily: F.sansBold }]}>ADGRID</Text>
          <Text style={[styles.title, { fontFamily: F.sansBold }]}>
            {mode === 'forgot' ? 'Reset your password' : mode === 'code' ? 'Enter your code' : 'Operator Portal'}
          </Text>
          <Text style={[styles.sub, { fontFamily: F.sans }]}>
            {mode === 'forgot' ? "Enter your email and we'll send a reset code."
              : mode === 'code' ? 'Enter the 6-digit code we emailed you and choose a new password.'
              : 'Sign in to manage your screens'}
          </Text>
          <View style={styles.form}>
            <ErrorBanner message={error} />
            {!!success && !error && (
              <View style={styles.successBanner}>
                <Text style={[styles.successText, { fontFamily: F.sans }]}>{success}</Text>
              </View>
            )}

            {mode === 'signin' && (
              <>
                <Inp label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
                <Inp label="Password" value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry />
                <Btn onPress={handleSignIn} loading={loading} size="lg">Sign in</Btn>
                <Btn variant="ghost" onPress={goToForgot} style={{ marginTop: 10 }}>Forgot password?</Btn>
              </>
            )}

            {mode === 'forgot' && (
              <>
                <Inp label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
                <Btn onPress={handleForgot} loading={loading} size="lg">Send reset code</Btn>
                <Btn variant="ghost" onPress={backToSignIn} style={{ marginTop: 10 }}>Back to sign in</Btn>
              </>
            )}

            {mode === 'code' && (
              <>
                <Inp label="6-digit code" value={code} onChangeText={setCode} placeholder="123456" keyboardType="number-pad" maxLength={6} />
                <Inp label="New password" value={newPassword} onChangeText={setNewPassword} placeholder="New password" secureTextEntry />
                <Btn onPress={handleResetPassword} loading={loading} size="lg">Reset password</Btn>
                <Btn variant="ghost" onPress={startOver} style={{ marginTop: 10 }}>Start over</Btn>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, backgroundColor: C.bg },
  strip: { height: 6 },
  container: { flex: 1, padding: 24, paddingTop: 48 },
  brand: { fontSize: 13, color: C.purple, letterSpacing: 3, marginBottom: 8 },
  title: { fontSize: 28, color: C.text, marginBottom: 6 },
  sub: { fontSize: 15, color: C.textSub, marginBottom: 40 },
  form: { gap: 0 },
  successBanner: { backgroundColor: C.greenSoft, borderWidth: 1, borderColor: C.greenBorder, borderRadius: 8, padding: 12, marginBottom: 16 },
  successText: { color: C.green, fontSize: 13 },
});
```

Note: the `useRouter` import was removed because it was unused in the original file (login never navigated directly — `AuthGate` in `_layout.jsx` handles post-signin navigation). If a lint rule flags an unused import some other way, that's a pre-existing condition, not introduced here — double check by grepping the original file content before deleting; if `router` turns out to be used elsewhere in the original, keep the import. (It is not — confirmed in the file read during design: `router` was declared but never referenced in a navigation call.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mobile && npx jest __tests__/login.test.jsx`
Expected: PASS — all 7 tests (3 pre-existing + 4 new).

- [ ] **Step 5: Run the full mobile suite**

Run: `cd mobile && npx jest`
Expected: PASS — all suites, no regressions.

- [ ] **Step 6: Commit**

```bash
git add mobile/app/login.jsx mobile/__tests__/login.test.jsx
git commit -m "feat(mobile): add in-app forgot-password flow to login screen"
```

---

### Task 5: Manual Supabase dashboard step (not automatable)

**This task is for the user, not the implementing agent.** No code changes.

- [ ] In the Supabase Dashboard for this project, go to **Authentication → Email Templates → Reset Password**.
- [ ] Add `{{ .Token }}` to the template body, e.g.:
  ```
  Your password reset code is: {{ .Token }}
  (This code expires in 1 hour.)
  ```
- [ ] Leave `{{ .ConfirmationURL }}` in place — the web app's existing link-based flow still depends on it.
- [ ] Send yourself a test reset from the mobile app's new "Forgot password?" link and confirm the email contains a 6-digit code.

---

## Post-plan verification (manual, once Task 5 is done)

Since this touches an external email template that can't be verified by the test suite, do one real end-to-end pass before considering this done:
1. On a device/simulator with the Operator app installed, tap "Forgot password?", submit a real operator account's email.
2. Confirm the email arrives with a visible 6-digit code.
3. Enter the code + a new password in the app, confirm "Password updated" appears.
4. Sign in with the new password and confirm normal navigation into `(tabs)` works.
