# Unified Account Mode Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hard role split (advertiser vs operator) with a single account that has a sidebar pill toggle to switch between Operator and Advertiser modes.

**Architecture:** Add `active_mode` to `profiles` DB table. `AuthContext` exposes `activeMode` + `setActiveMode` instead of `role`. Sidebar shows a two-segment pill toggle. `App.jsx` swaps nav/views based on `activeMode`. Signup drops the role picker entirely.

**Tech Stack:** React, Supabase (MCP for migration), existing design tokens (`C`, `F`)

---

## File Map

| File | Change |
|---|---|
| `profiles` table (Supabase) | Add `active_mode text` column |
| `src/context/AuthContext.jsx` | Replace `role`/`setRole` with `activeMode`/`setActiveMode` |
| `src/components/login/LoginPage.jsx` | Remove `RolePromptModal`, remove role picker from signup |
| `src/components/layout/Sidebar.jsx` | Add `ModeSwitcher` pill component, accept `activeMode`/`onModeSwitch` props |
| `src/App.jsx` | Use `activeMode` from context, pass `onModeSwitch` to Sidebar, auto-switch on screen onboard |

---

## Task 1: DB Migration — add active_mode column

**Files:**
- Modify: `profiles` table via Supabase MCP

- [ ] **Step 1: Run migration**

Use the Supabase MCP `apply_migration` tool with this SQL:

```sql
alter table profiles
  add column if not exists active_mode text
  check (active_mode in ('operator', 'advertiser'));
```

- [ ] **Step 2: Verify column exists**

Use `execute_sql`:
```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'profiles' and column_name = 'active_mode';
```

Expected: one row with `column_name = active_mode`, `data_type = text`, `is_nullable = YES`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add active_mode column to profiles"
```

---

## Task 2: Update AuthContext — activeMode + setActiveMode

**Files:**
- Modify: `src/context/AuthContext.jsx`

- [ ] **Step 1: Replace the file**

Replace `src/context/AuthContext.jsx` with:

```jsx
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser]             = useState(null)
  const [profile, setProfile]       = useState(null)
  const [activeMode, setActiveModeState] = useState(null) // 'operator' | 'advertiser'
  const [loading, setLoading]       = useState(true)

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
    setActiveModeState(data?.active_mode ?? 'advertiser')
    return data
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code   = params.get('code')

    const init = async () => {
      if (code) {
        await supabase.auth.exchangeCodeForSession(code)
        window.history.replaceState({}, '', window.location.pathname)
      }
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      if (session?.user) await fetchProfile(session.user.id)
      setLoading(false)
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setActiveModeState(null) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signUp(email, password, name) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })
    return { data, error }
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setActiveModeState(null)
  }

  async function signInWithOAuth(provider) {
    const redirectTo = window.location.origin
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    })
    return { data, error }
  }

  async function setActiveMode(mode) {
    setActiveModeState(mode)
    if (user) {
      await supabase.from('profiles').update({ active_mode: mode }).eq('id', user.id)
    }
  }

  return (
    <AuthContext.Provider value={{ user, profile, activeMode, loading, signUp, signIn, signOut, signInWithOAuth, setActiveMode }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
```

- [ ] **Step 2: Commit**

```bash
git add src/context/AuthContext.jsx
git commit -m "feat: replace role with activeMode in AuthContext"
```

---

## Task 3: Clean up LoginPage — remove role picker

**Files:**
- Modify: `src/components/login/LoginPage.jsx`

- [ ] **Step 1: Replace the file**

Replace `src/components/login/LoginPage.jsx` with:

```jsx
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { C, F } from '../../design/tokens.js';
import { Card } from '../primitives/Card.jsx';
import { Btn } from '../primitives/Btn.jsx';
import { Inp } from '../primitives/Inp.jsx';

export function LoginPage() {
  const { signIn, signUp, signInWithOAuth } = useAuth();
  const [mode, setMode]     = useState('signin');
  const [email, setEmail]   = useState('');
  const [pass, setPass]     = useState('');
  const [name, setName]     = useState('');
  const [err, setErr]       = useState('');
  const [loading, setLoading]     = useState(false);
  const [oauthLoading, setOauthLoading] = useState('');

  const handle = async () => {
    if (!email.includes('@')) { setErr('Enter a valid email address.'); return; }
    if (pass.length < 6)      { setErr('Password must be at least 6 characters.'); return; }
    setErr(''); setLoading(true);
    if (mode === 'signin') {
      const { error } = await signIn(email, pass);
      if (error) setErr(error.message);
    } else {
      const { error } = await signUp(email, pass, name);
      if (error) setErr(error.message);
      else setErr('Check your email to confirm your account.');
    }
    setLoading(false);
  };

  const handleOAuth = async (provider) => {
    setOauthLoading(provider);
    const { error } = await signInWithOAuth(provider);
    if (error) { setErr(error.message); setOauthLoading(''); }
  };

  const isSuccess = err.includes('Check');

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.sans }}>
      <div style={{ width: '100%', maxWidth: 380, padding: '0 20px' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32, justifyContent: 'center' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 16, color: '#fff',
          }}>A</div>
          <span style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: F.sans }}>ADGRID</span>
        </div>

        <Card style={{ padding: 28 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4, fontFamily: F.sans }}>
            {mode === 'signin' ? 'Sign in to ADGRID' : 'Create your account'}
          </h1>
          <p style={{ fontSize: 13, color: C.textSub, marginBottom: 20, fontFamily: F.sans }}>Access your network dashboard</p>

          {/* OAuth buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            <button
              onClick={() => handleOAuth('google')}
              disabled={!!oauthLoading}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: '10px 16px', borderRadius: 8, border: `1px solid ${C.border}`,
                background: C.surface, cursor: 'pointer', fontSize: 14, fontWeight: 500,
                color: C.text, fontFamily: F.sans, transition: 'background 0.15s',
                opacity: oauthLoading === 'apple' ? 0.5 : 1,
              }}
              onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
              onMouseLeave={e => e.currentTarget.style.background = C.surface}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {oauthLoading === 'google' ? 'Redirecting…' : 'Continue with Google'}
            </button>

            <button
              onClick={() => handleOAuth('apple')}
              disabled={!!oauthLoading}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: '10px 16px', borderRadius: 8, border: `1px solid ${C.border}`,
                background: '#000', cursor: 'pointer', fontSize: 14, fontWeight: 500,
                color: '#fff', fontFamily: F.sans, transition: 'opacity 0.15s',
                opacity: oauthLoading === 'google' ? 0.5 : 1,
              }}
            >
              <svg width="16" height="18" viewBox="0 0 814 1000" fill="white">
                <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.4-156.4-96.8c-61.6-72.9-112.7-190.5-112.7-302.4 0-184.9 120.9-283 239.4-283 61 0 111.4 40.2 149.4 40.2 36 0 92.7-42.8 161.3-42.8l-.1.1zm-89.3-193.6c35.4-41.7 60.4-99.7 60.4-157.7 0-8.3-.6-16.7-2-24.4-57.4 2.2-124.7 38.4-164.7 81.4-31.6 35.4-60.4 93.4-60.4 152.4 0 9 1.3 18 2 21.2 3.8.6 10.2 1.3 16.5 1.3 51.6 0 113.5-34.5 148.2-74.2z"/>
              </svg>
              {oauthLoading === 'apple' ? 'Redirecting…' : 'Continue with Apple'}
            </button>
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: C.border }} />
            <span style={{ fontSize: 12, color: C.textMuted, fontFamily: F.sans }}>or</span>
            <div style={{ flex: 1, height: 1, background: C.border }} />
          </div>

          {err && (
            <div style={{
              padding: '9px 12px', borderRadius: 8, fontSize: 12, marginBottom: 14,
              background: isSuccess ? C.greenSoft : C.redSoft,
              border: `1px solid ${isSuccess ? C.greenBorder : C.redBorder}`,
              color: isSuccess ? C.green : C.red,
            }}>{err}</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            {mode === 'signup' && (
              <Inp label="Full Name" type="text" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
            )}
            <Inp label="Email" type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handle()} />
            <Inp label="Password" type="password" placeholder="••••••••" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && handle()} />
          </div>

          <Btn onClick={handle} style={{ width: '100%', justifyContent: 'center' }} size="lg" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in →' : 'Create account →'}
          </Btn>

          <div style={{ marginTop: 14, textAlign: 'center', fontSize: 12, color: C.textSub, fontFamily: F.sans }}>
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <span onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setErr(''); }}
              style={{ color: C.purple, cursor: 'pointer', fontWeight: 500 }}>
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/login/LoginPage.jsx
git commit -m "feat: remove role picker from signup"
```

---

## Task 4: Add ModeSwitcher pill to Sidebar

**Files:**
- Modify: `src/components/layout/Sidebar.jsx`

- [ ] **Step 1: Add ModeSwitcher component and update Sidebar props**

At the top of `src/components/layout/Sidebar.jsx`, add the `ModeSwitcher` component after the `ICONS` block and before `OP_PRIMARY`:

```jsx
function ModeSwitcher({ activeMode, onSwitch, collapsed }) {
  const modes = [
    { id: 'operator',   label: 'Operator' },
    { id: 'advertiser', label: 'Advertiser' },
  ];

  if (collapsed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 8 }}>
        {modes.map(m => (
          <button
            key={m.id}
            title={m.label}
            onClick={() => onSwitch(m.id)}
            style={{
              width: '100%', padding: '6px 0', border: 'none', borderRadius: 6, cursor: 'pointer',
              background: activeMode === m.id
                ? 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(168,85,247,0.15))'
                : 'transparent',
              color: activeMode === m.id ? '#a855f7' : '#555',
              fontSize: 9, fontWeight: 700, fontFamily: F.sans, letterSpacing: '0.04em',
              transition: 'all 0.15s',
            }}
          >
            {m.id === 'operator' ? '📺' : '📢'}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', background: 'rgba(0,0,0,0.2)', borderRadius: 8,
      padding: 3, gap: 2, margin: '0 0 10px 0',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      {modes.map(m => (
        <button
          key={m.id}
          onClick={() => onSwitch(m.id)}
          style={{
            flex: 1, padding: '7px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
            fontSize: 11, fontWeight: activeMode === m.id ? 600 : 500, fontFamily: F.sans,
            transition: 'all 0.15s',
            background: activeMode === m.id
              ? 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(168,85,247,0.2))'
              : 'transparent',
            color: activeMode === m.id ? '#a855f7' : '#555',
            boxShadow: activeMode === m.id ? '0 1px 4px rgba(124,58,237,0.2)' : 'none',
          }}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Update Sidebar function signature**

Change:
```jsx
export function Sidebar({ active, setActive, isAdv, user, onSignOut, pendingCount = 0 }) {
```

To:
```jsx
export function Sidebar({ active, setActive, activeMode, onModeSwitch, user, onSignOut, pendingCount = 0 }) {
```

- [ ] **Step 3: Replace isAdv references inside Sidebar**

Change:
```jsx
const primary   = isAdv ? ADV_PRIMARY   : OP_PRIMARY;
const secondary = isAdv ? ADV_SECONDARY : OP_SECONDARY;
```

To:
```jsx
const isAdv     = activeMode === 'advertiser';
const primary   = isAdv ? ADV_PRIMARY   : OP_PRIMARY;
const secondary = isAdv ? ADV_SECONDARY : OP_SECONDARY;
```

- [ ] **Step 4: Insert ModeSwitcher into sidebar layout**

Inside the sidebar's scrollable nav `<div>`, place `<ModeSwitcher>` immediately before the primary nav block:

```jsx
{/* Mode switcher */}
<ModeSwitcher activeMode={activeMode} onSwitch={onModeSwitch} collapsed={collapsed} />

{/* Primary nav */}
<div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
```

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Sidebar.jsx
git commit -m "feat: add Operator/Advertiser mode switcher pill to sidebar"
```

---

## Task 5: Wire activeMode in App.jsx

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Update useAuth destructure**

Change:
```jsx
const { user, profile, role, loading, signOut } = useAuth();
```

To:
```jsx
const { user, profile, activeMode, setActiveMode, loading, signOut } = useAuth();
```

- [ ] **Step 2: Replace effectiveRole / isAdv derivation**

Remove:
```jsx
const effectiveRole = impersonating ? 'advertiser' : role;
const isAdv = effectiveRole === 'advertiser';
```

Replace with:
```jsx
const isAdv = impersonating ? true : activeMode === 'advertiser';
```

- [ ] **Step 3: Update useEffect that sets initial active on login**

Change:
```jsx
useEffect(() => {
  if (user) {
    setActive(role === 'advertiser' ? 'adv-overview' : 'overview');
    loadData();
  }
}, [user, role, loadData]);
```

To:
```jsx
useEffect(() => {
  if (user) {
    setActive(activeMode === 'advertiser' ? 'adv-overview' : 'overview');
    loadData();
  }
}, [user, activeMode, loadData]);
```

- [ ] **Step 4: Update Sidebar props in JSX**

Change:
```jsx
<Sidebar
  active={active}
  setActive={navigate}
  isAdv={isAdv}
  user={displayUser}
  onSignOut={signOut}
  pendingCount={pendingCount}
/>
```

To:
```jsx
<Sidebar
  active={active}
  setActive={navigate}
  activeMode={impersonating ? 'advertiser' : activeMode}
  onModeSwitch={mode => {
    setActiveMode(mode);
    navigate(mode === 'advertiser' ? 'adv-overview' : 'overview');
  }}
  user={displayUser}
  onSignOut={signOut}
  pendingCount={pendingCount}
/>
```

- [ ] **Step 5: Fix displayUser — remove stale role reference**

Change:
```jsx
const displayUser = { name: profile?.name || user.email?.split('@')[0] || 'User', email: user.email, role };
```

To:
```jsx
const displayUser = { name: profile?.name || user.email?.split('@')[0] || 'User', email: user.email };
```

- [ ] **Step 6: Auto-switch to operator when screen onboarding completes**

Find the `onComplete` callback inside `screen-onboard` route (around line 306). Add `setActiveMode('operator')` call:

```jsx
if (active === 'screen-onboard') return (
  <ScreenOnboardView
    onComplete={(newScreen) => {
      setDbScreens(prev => [...prev, {
        ...newScreen,
        neighbourhood: newScreen.location || '',
        cpm: 3.00,
        maxDuration: 30,
        revenue: 0,
        campaigns: 0,
        status: 'pending',
      }]);
      setSelectedScreenId(newScreen.id);
      setActiveMode('operator');
      navigate('screen-detail');
    }}
    onCancel={() => navigate('screens')}
  />
);
```

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire activeMode into App routing and sidebar"
```

---

## Task 6: Manual Verification

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test new signup**

Go to `/login`, click "Sign up". Confirm: no role picker shown. Create account with name + email + password. Verify signup succeeds.

- [ ] **Step 3: Test mode switcher as existing operator**

Sign in as an existing operator account. Confirm:
- Lands on Operator mode (Dashboard, Screens, Approval Queue visible)
- Pill shows "Operator" highlighted
- Click "Advertiser" pill → nav swaps to Advertiser nav (Dashboard, Campaigns, Scans)
- Refresh page → stays on Advertiser mode (persisted to DB)
- Click "Operator" pill → swaps back

- [ ] **Step 4: Test impersonation still works**

As operator, go to Advertisers → impersonate an advertiser. Confirm:
- Sidebar shows Advertiser nav
- Pill toggle is NOT shown during impersonation (isAdv forced true, no switch available)
- Stop impersonation → returns to operator nav

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "feat: unified account mode switcher — complete"
```
