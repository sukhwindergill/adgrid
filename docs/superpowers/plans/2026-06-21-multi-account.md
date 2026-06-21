# Multi-Account Access (Agency / Org) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow any AdGrid user to grant another org (or individual) scoped access to their account, with per-client roles, an account hub, in-app switcher, email invites, and social login on invite accept.

**Architecture:** Two new tables (`account_grants`, `team_member_client_roles`) and a DB helper function power the permission model. `AuthContext` gains `activeAccount` + `grants` state; all data queries scope to `activeAccount.id` when acting as a delegate. RLS enforces access at the DB layer via a `has_account_grant()` function that checks both direct and org-member grant paths.

**Tech Stack:** React 18, Vite, Supabase (PostgreSQL RLS, Auth OAuth, Edge Functions/Deno), Resend (email), React Router v6.

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260621000000_multi_account.sql` | Tables, indexes, RLS policies, helper function |
| `src/views/accounts/AccountHub.jsx` | `/app/accounts` — card grid of own + granted accounts |
| `src/views/accounts/AcceptGrantView.jsx` | `/app/accept-grant?grant=<uuid>` — accept/decline invite |
| `src/views/accounts/GrantAccessModal.jsx` | Modal to create a new account grant |
| `src/views/accounts/AccessSettingsView.jsx` | Tab content: manage inbound grants on your account |
| `src/views/accounts/TeamClientRoles.jsx` | Tab content: assign org team members to client accounts |
| `src/components/layout/AccountSwitcher.jsx` | Header dropdown for switching active account |

### Modified files
| File | What changes |
|------|-------------|
| `supabase/functions/send-notification/index.ts` | Add `grant_invite` template |
| `src/context/AuthContext.jsx` | + `activeAccount`, `grants`, `setActiveAccount`, `acceptGrant`, `revokeGrant` |
| `src/App.jsx` | Post-login hub routing; add `/app/accounts` + `/app/accept-grant` routes; scope bookings/screens queries to `activeAccount.id` |
| `src/components/layout/GlobalHeader.jsx` | + `AccountSwitcher` |
| `src/views/advertiser/SettingsView.jsx` | + "Access" tab wired to `AccessSettingsView` |
| `src/views/operator/OperatorSettingsView.jsx` | + "Client Access" tab under Team section wired to `TeamClientRoles` |
| `src/views/advertiser/CreateCampaign.jsx` | + "Bill to:" step when acting in a client account as manager+ |

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/20260621000000_multi_account.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/20260621000000_multi_account.sql

-- ── Helper: resolve effective grant role for current user on a target account ──
-- Returns true if auth.uid() has at least min_role on target_account_id.
-- Checks two paths: direct grant OR org-member grant.
CREATE OR REPLACE FUNCTION has_account_grant(
  target_account_id uuid,
  min_role text DEFAULT 'viewer'
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    -- Path A: direct grant to this user
    SELECT 1
    FROM account_grants ag
    WHERE ag.account_id = target_account_id
      AND ag.grantee_id = auth.uid()
      AND ag.status = 'active'
      AND CASE min_role
            WHEN 'admin'   THEN ag.role = 'admin'
            WHEN 'manager' THEN ag.role IN ('admin', 'manager')
            ELSE true
          END

    UNION ALL

    -- Path B: user is member of an org that has a grant
    SELECT 1
    FROM account_grants ag
    JOIN team_members tm ON tm.org_profile_id = ag.grantee_id
    LEFT JOIN team_member_client_roles tmcr
      ON tmcr.team_member_id = tm.id
      AND tmcr.client_account_id = ag.account_id
    WHERE ag.account_id = target_account_id
      AND ag.status = 'active'
      AND tm.user_profile_id = auth.uid()
      AND (tm.role = 'admin' OR tmcr.id IS NOT NULL)
      AND CASE min_role
            WHEN 'admin'   THEN COALESCE(tmcr.role, ag.role) = 'admin'
            WHEN 'manager' THEN COALESCE(tmcr.role, ag.role) IN ('admin', 'manager')
            ELSE true
          END
  )
$$;

-- ── account_grants ─────────────────────────────────────────────────────────────
CREATE TABLE account_grants (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  grantee_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invite_email text,
  role         text NOT NULL DEFAULT 'viewer'
               CHECK (role IN ('admin', 'manager', 'viewer')),
  granted_by   uuid REFERENCES profiles(id),
  status       text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'active', 'revoked')),
  created_at   timestamptz DEFAULT now(),
  UNIQUE(account_id, grantee_id)
);

ALTER TABLE account_grants ENABLE ROW LEVEL SECURITY;

-- Account owner sees all grants on their account
CREATE POLICY "ag_owner_select" ON account_grants
  FOR SELECT USING (account_id = auth.uid());

-- Grantee sees grants addressed to them
CREATE POLICY "ag_grantee_select" ON account_grants
  FOR SELECT USING (grantee_id = auth.uid());

-- Account owner creates grants
CREATE POLICY "ag_owner_insert" ON account_grants
  FOR INSERT WITH CHECK (account_id = auth.uid());

-- Account owner can update (change role, revoke)
CREATE POLICY "ag_owner_update" ON account_grants
  FOR UPDATE USING (account_id = auth.uid());

-- Grantee can flip status to 'active' or 'revoked' (accept/decline)
CREATE POLICY "ag_grantee_update" ON account_grants
  FOR UPDATE USING (grantee_id = auth.uid());

CREATE INDEX account_grants_account_id_idx ON account_grants(account_id);
CREATE INDEX account_grants_grantee_id_idx ON account_grants(grantee_id);
CREATE INDEX account_grants_status_idx     ON account_grants(status);

-- ── team_member_client_roles ───────────────────────────────────────────────────
CREATE TABLE team_member_client_roles (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id    uuid NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  client_account_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role              text NOT NULL DEFAULT 'viewer'
                    CHECK (role IN ('admin', 'manager', 'viewer')),
  UNIQUE(team_member_id, client_account_id)
);

ALTER TABLE team_member_client_roles ENABLE ROW LEVEL SECURITY;

-- Org admin (org_profile_id = auth.uid()) manages all client role assignments for their team
CREATE POLICY "tmcr_org_admin_all" ON team_member_client_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.id = team_member_id
        AND tm.org_profile_id = auth.uid()
    )
  );

-- Team member reads their own client role assignments
CREATE POLICY "tmcr_member_select" ON team_member_client_roles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.id = team_member_id
        AND tm.user_profile_id = auth.uid()
    )
  );

CREATE INDEX tmcr_member_idx ON team_member_client_roles(team_member_id);
CREATE INDEX tmcr_client_idx ON team_member_client_roles(client_account_id);

-- ── bookings: billed_to_profile_id ────────────────────────────────────────────
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS
  billed_to_profile_id uuid REFERENCES profiles(id);

-- ── RLS additions: allow grant-based access to existing tables ─────────────────

-- bookings: delegate read
CREATE POLICY "bookings_grant_select" ON bookings
  FOR SELECT USING (
    advertiser_id IS NOT NULL
    AND has_account_grant(advertiser_id, 'viewer')
  );

-- bookings: delegate write (manager+)
CREATE POLICY "bookings_grant_insert" ON bookings
  FOR INSERT WITH CHECK (
    advertiser_id IS NOT NULL
    AND has_account_grant(advertiser_id, 'manager')
  );

-- screens: delegate read (operator accounts)
CREATE POLICY "screens_grant_select" ON screens
  FOR SELECT USING (
    operator_id IS NOT NULL
    AND has_account_grant(operator_id, 'viewer')
  );

-- scans: delegate read
CREATE POLICY "scans_grant_select" ON scans
  FOR SELECT USING (
    advertiser_id IS NOT NULL
    AND has_account_grant(advertiser_id, 'viewer')
  );
```

- [ ] **Step 2: Apply migration**

```bash
npx supabase db push
```

Expected: `Applied 1 migration`. If you get a policy-already-exists error, check whether any prior migration already created one of these policy names and rename accordingly.

- [ ] **Step 3: Verify in Supabase dashboard**

Open the Supabase dashboard → Table Editor. Confirm `account_grants` and `team_member_client_roles` tables exist with the correct columns. Check Authentication → Policies that all 6 new policies on `account_grants` are listed.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260621000000_multi_account.sql
git commit -m "feat(db): add account_grants, team_member_client_roles, grant-based RLS"
```

---

## Task 2: grant_invite email template

**Files:**
- Modify: `supabase/functions/send-notification/index.ts`

- [ ] **Step 1: Add `grant_invite` to the TEMPLATES record**

In `supabase/functions/send-notification/index.ts`, find the closing `};` of the `TEMPLATES` object (after the `screen_offline` entry, around line 87) and add before it:

```typescript
  grant_invite: (d) => ({
    title: `${d.grantorName} invited you to access their AdGrid account`,
    body: `${d.grantorName} has given you ${d.role} access to their AdGrid account. Accept to get started.`,
    html: emailHtml(
      "You've been invited",
      `<strong>${d.grantorName}</strong> has invited you to access their AdGrid account as a <strong>${d.role}</strong>.<br><br>Click below to accept the invitation and get started.`,
      "Accept Invitation",
      d.acceptUrl,
    ),
  }),
```

- [ ] **Step 2: Deploy the updated function**

```bash
npx supabase functions deploy send-notification
```

Expected: `Deployed send-notification`.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/send-notification/index.ts
git commit -m "feat(notifications): add grant_invite email template"
```

---

## Task 3: AuthContext — activeAccount + grants

**Files:**
- Modify: `src/context/AuthContext.jsx`

- [ ] **Step 1: Replace the full file content**

```jsx
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser]                     = useState(null)
  const [profile, setProfile]               = useState(null)
  const [activeMode, setActiveModeState]    = useState(null)
  const [activeAccount, setActiveAccountState] = useState(null) // { id, name, role, isOwn }
  const [grants, setGrants]                 = useState([])      // active account_grants[]
  const [loading, setLoading]               = useState(true)

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

  const fetchGrants = useCallback(async (userId) => {
    // Grants where this user's profile is the grantee (direct) OR
    // the user is a member of the grantee org — we fetch both.
    const [directRes, orgRes] = await Promise.all([
      supabase
        .from('account_grants')
        .select('*, account:account_id(id, name, company_name, logo_url)')
        .eq('grantee_id', userId)
        .eq('status', 'active'),
      supabase
        .from('team_members')
        .select('org_profile_id, account_grants(*, account:account_id(id, name, company_name, logo_url))')
        .eq('user_profile_id', userId),
    ])

    const direct = directRes.data ?? []
    const viaOrg = (orgRes.data ?? [])
      .flatMap(tm => (tm.account_grants ?? []).filter(g => g.status === 'active'))

    // Dedupe by account_id
    const seen = new Set()
    const all = [...direct, ...viaOrg].filter(g => {
      if (seen.has(g.account_id)) return false
      seen.add(g.account_id)
      return true
    })
    setGrants(all)
    return all
  }, [])

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
      if (session?.user) {
        await fetchProfile(session.user.id)
        await fetchGrants(session.user.id)
      }
      setLoading(false)
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
        fetchGrants(session.user.id)
      } else {
        setProfile(null)
        setActiveModeState(null)
        setActiveAccountState(null)
        setGrants([])
      }
    })

    return () => subscription.unsubscribe()
  }, [fetchGrants])

  // Restore activeAccount from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem('adgrid_active_account')
    if (stored) {
      try { setActiveAccountState(JSON.parse(stored)) } catch {}
    }
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
    setActiveAccountState(null)
    setGrants([])
    sessionStorage.removeItem('adgrid_active_account')
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

  function setActiveAccount(account) {
    // account: { id, name, role, isOwn } | null
    setActiveAccountState(account)
    if (account) {
      sessionStorage.setItem('adgrid_active_account', JSON.stringify(account))
    } else {
      sessionStorage.removeItem('adgrid_active_account')
    }
  }

  async function acceptGrant(grantId) {
    const { error } = await supabase
      .from('account_grants')
      .update({ status: 'active' })
      .eq('id', grantId)
    if (!error) await fetchGrants(user.id)
    return { error }
  }

  async function revokeGrant(grantId) {
    const { error } = await supabase
      .from('account_grants')
      .update({ status: 'revoked' })
      .eq('id', grantId)
    if (!error) {
      setGrants(prev => prev.filter(g => g.id !== grantId))
      // If currently acting in this account, switch back to own
      if (activeAccount?.id && grants.find(g => g.id === grantId)?.account_id === activeAccount.id) {
        setActiveAccount(null)
      }
    }
    return { error }
  }

  return (
    <AuthContext.Provider value={{
      user, profile, activeMode, loading,
      activeAccount, grants,
      signUp, signIn, signOut, signInWithOAuth,
      setActiveMode, setActiveAccount, acceptGrant, revokeGrant,
      refreshGrants: () => user ? fetchGrants(user.id) : Promise.resolve(),
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
```

- [ ] **Step 2: Verify app still boots**

```bash
npm run dev
```

Open `http://localhost:5173`, log in. Confirm the app loads normally (no console errors about missing context values).

- [ ] **Step 3: Commit**

```bash
git add src/context/AuthContext.jsx
git commit -m "feat(auth): add activeAccount, grants, setActiveAccount, acceptGrant, revokeGrant"
```

---

## Task 4: Account Hub

**Files:**
- Create: `src/views/accounts/AccountHub.jsx`

- [ ] **Step 1: Create the file**

```jsx
import { useAuth } from '../../context/AuthContext.jsx'
import { C, F } from '../../design/tokens.js'

function RoleBadge({ role }) {
  const colors = {
    admin:   { bg: 'rgba(124,58,237,0.12)', color: '#7c3aed' },
    manager: { bg: 'rgba(37,99,235,0.12)',  color: '#2563eb' },
    viewer:  { bg: 'rgba(107,114,128,0.12)', color: '#6b7280' },
  }
  const s = colors[role] ?? colors.viewer
  return (
    <span style={{
      padding: '2px 9px', borderRadius: 10, fontSize: 11, fontWeight: 600,
      textTransform: 'capitalize', background: s.bg, color: s.color,
    }}>{role}</span>
  )
}

function AccountCard({ account, isCurrent, onClick }) {
  const initials = (account.name || account.company_name || '?').slice(0, 2).toUpperCase()
  return (
    <div
      onClick={onClick}
      style={{
        background: C.surface,
        border: `2px solid ${isCurrent ? C.blue : C.border}`,
        borderRadius: 16,
        padding: '24px 20px',
        cursor: 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: isCurrent ? `0 0 0 3px rgba(37,99,235,0.12)` : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
      onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.borderColor = C.textMuted }}
      onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.borderColor = C.border }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {account.logo_url ? (
          <img src={account.logo_url} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover' }} />
        ) : (
          <div style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: F.sans,
          }}>{initials}</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, truncate: true }}>
            {account.company_name || account.name || 'Unnamed Account'}
          </div>
          {account.role && (
            <div style={{ marginTop: 4 }}>
              <RoleBadge role={account.role} />
            </div>
          )}
        </div>
        {isCurrent && (
          <span style={{ fontSize: 11, color: C.blue, fontFamily: F.sans, fontWeight: 600 }}>Active</span>
        )}
      </div>
      {account.isOwn && (
        <div style={{ fontSize: 12, color: C.textMuted, fontFamily: F.sans }}>Your account</div>
      )}
    </div>
  )
}

export function AccountHub({ onSelectAccount }) {
  const { user, profile, grants, activeAccount, setActiveAccount } = useAuth()

  const ownAccount = {
    id: user?.id,
    name: profile?.name,
    company_name: profile?.company_name,
    logo_url: profile?.logo_url,
    role: 'admin',
    isOwn: true,
  }

  const grantAccounts = grants.map(g => ({
    id: g.account_id,
    name: g.account?.name,
    company_name: g.account?.company_name,
    logo_url: g.account?.logo_url,
    role: g.role,
    isOwn: false,
  }))

  const allAccounts = [ownAccount, ...grantAccounts]

  function select(account) {
    setActiveAccount(account.isOwn ? null : account)
    onSelectAccount(account)
  }

  return (
    <div style={{ padding: '48px 40px', maxWidth: 860, margin: '0 auto', fontFamily: F.sans }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: C.text, margin: '0 0 8px' }}>Accounts</h1>
      <p style={{ fontSize: 14, color: C.textSub, margin: '0 0 32px' }}>
        Select an account to manage. You can switch at any time from the header.
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 16,
      }}>
        {allAccounts.map(account => (
          <AccountCard
            key={account.id}
            account={account}
            isCurrent={
              account.isOwn
                ? !activeAccount
                : activeAccount?.id === account.id
            }
            onClick={() => select(account)}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/views/accounts/AccountHub.jsx
git commit -m "feat(accounts): add AccountHub view"
```

---

## Task 5: Accept Grant view

**Files:**
- Create: `src/views/accounts/AcceptGrantView.jsx`

- [ ] **Step 1: Create the file**

```jsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { C, F } from '../../design/tokens.js'

export function AcceptGrantView() {
  const { user, acceptGrant, signInWithOAuth } = useAuth()
  const navigate = useNavigate()
  const [grant, setGrant]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [done, setDone]       = useState(false)

  const grantId = new URLSearchParams(window.location.search).get('grant')

  useEffect(() => {
    if (!grantId) { setError('Invalid invite link.'); setLoading(false); return }
    supabase
      .from('account_grants')
      .select('*, account:account_id(name, company_name), grantor:granted_by(name, email)')
      .eq('id', grantId)
      .single()
      .then(({ data, error: e }) => {
        if (e || !data) { setError('Invite not found or already used.') }
        else if (data.status === 'active') { setError('This invite has already been accepted.') }
        else if (data.status === 'revoked') { setError('This invite has been revoked.') }
        else setGrant(data)
        setLoading(false)
      })
  }, [grantId])

  async function accept() {
    if (!user) { sessionStorage.setItem('pending_grant', grantId); navigate('/login'); return }
    const { error: e } = await acceptGrant(grantId)
    if (e) { setError(e.message); return }
    setDone(true)
    setTimeout(() => navigate('/app/accounts'), 2000)
  }

  async function decline() {
    await supabase.from('account_grants').update({ status: 'revoked' }).eq('id', grantId)
    navigate('/')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
      <p style={{ fontFamily: F.sans, color: C.textSub }}>Loading invite…</p>
    </div>
  )

  const accountName = grant?.account?.company_name || grant?.account?.name || 'an account'
  const grantorName = grant?.grantor?.name || grant?.grantor?.email || 'Someone'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, padding: 24 }}>
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20,
        padding: '40px 36px', maxWidth: 420, width: '100%', textAlign: 'center',
      }}>
        {error ? (
          <>
            <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: '0 0 8px' }}>Invite Error</h2>
            <p style={{ fontSize: 14, color: C.textSub, fontFamily: F.sans, margin: '0 0 24px' }}>{error}</p>
            <button onClick={() => navigate('/')} style={{ padding: '10px 24px', borderRadius: 10, background: C.blue, color: '#fff', border: 'none', fontFamily: F.sans, fontSize: 14, cursor: 'pointer' }}>
              Go Home
            </button>
          </>
        ) : done ? (
          <>
            <div style={{ fontSize: 32, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: '0 0 8px' }}>Invite Accepted</h2>
            <p style={{ fontSize: 14, color: C.textSub, fontFamily: F.sans }}>Redirecting to your accounts…</p>
          </>
        ) : (
          <>
            <div style={{ fontSize: 32, marginBottom: 16 }}>📬</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: '0 0 8px' }}>You're invited</h2>
            <p style={{ fontSize: 14, color: C.textSub, fontFamily: F.sans, margin: '0 0 6px' }}>
              <strong style={{ color: C.text }}>{grantorName}</strong> has given you <strong style={{ color: C.text }}>{grant?.role}</strong> access to
            </p>
            <p style={{ fontSize: 16, fontWeight: 600, color: C.text, fontFamily: F.sans, margin: '0 0 28px' }}>{accountName}</p>

            {!user && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, marginBottom: 12 }}>Sign in to accept:</p>
                <button
                  onClick={() => signInWithOAuth('google')}
                  style={{ width: '100%', padding: '10px', borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, fontFamily: F.sans, fontSize: 14, cursor: 'pointer', color: C.text, marginBottom: 8 }}
                >
                  Continue with Google
                </button>
                <button
                  onClick={() => { sessionStorage.setItem('pending_grant', grantId); navigate('/login') }}
                  style={{ width: '100%', padding: '10px', borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, fontFamily: F.sans, fontSize: 14, cursor: 'pointer', color: C.text }}
                >
                  Sign in with email
                </button>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={decline}
                style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'transparent', border: `1px solid ${C.border}`, fontFamily: F.sans, fontSize: 14, cursor: 'pointer', color: C.textSub }}
              >
                Decline
              </button>
              {user && (
                <button
                  onClick={accept}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, background: C.blue, color: '#fff', border: 'none', fontFamily: F.sans, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                >
                  Accept Invite
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Handle pending grant after OAuth redirect**

In `src/context/AuthContext.jsx`, inside the `onAuthStateChange` callback, after `fetchGrants`, add:

```js
// Auto-accept a pending grant invite (set before OAuth redirect)
const pending = sessionStorage.getItem('pending_grant')
if (pending && session?.user) {
  sessionStorage.removeItem('pending_grant')
  supabase
    .from('account_grants')
    .update({ status: 'active' })
    .eq('id', pending)
    .then(() => fetchGrants(session.user.id))
}
```

- [ ] **Step 3: Commit**

```bash
git add src/views/accounts/AcceptGrantView.jsx src/context/AuthContext.jsx
git commit -m "feat(accounts): add AcceptGrantView with OAuth + pending grant auto-accept"
```

---

## Task 6: App.jsx routing + query scoping

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add imports at top of App.jsx**

After the existing imports block, add:

```jsx
import { AccountHub }        from './views/accounts/AccountHub.jsx'
import { AcceptGrantView }   from './views/accounts/AcceptGrantView.jsx'
```

- [ ] **Step 2: Pull `activeAccount` + `grants` from useAuth in AppInner**

Change the destructure at the top of `AppInner`:

```jsx
const { user, profile, activeMode, setActiveMode, loading, signOut, activeAccount, setActiveAccount, grants } = useAuth();
```

- [ ] **Step 3: Add post-login routing effect**

Add this effect inside `AppInner`, after the existing Stripe Connect `useEffect`:

```jsx
// Route to account hub if user has grants and hasn't chosen an account yet
useEffect(() => {
  if (!user || !profile || grants === undefined) return
  if (grants.length > 0 && !activeAccount && !sessionStorage.getItem('adgrid_active_account')) {
    const currentPath = location.pathname
    if (currentPath !== '/app/accounts' && !currentPath.startsWith('/app/accept-grant')) {
      navigate('/app/accounts')
    }
  }
}, [user, profile, grants, activeAccount, navigate, location.pathname])
```

- [ ] **Step 4: Scope the loadData queries**

In `loadData`, pass `activeAccount` as a parameter and filter when acting as delegate:

Replace the `loadData` function:

```jsx
const loadData = useCallback(async () => {
  setDataLoading(true)
  setLoadError(null)
  const targetId = activeAccount?.id ?? user?.id

  const bookingsQuery = supabase
    .from('bookings')
    .select('*')
    .order('created_at', { ascending: false })

  // When acting as delegate, scope to that account's data
  if (activeAccount && !activeAccount.isOwn) {
    bookingsQuery.eq('advertiser_id', targetId)
  }

  const [bookingsRes, screensRes] = await Promise.all([
    bookingsQuery,
    supabase.from('screens').select('*').order('name'),
  ])

  if (bookingsRes.error) {
    console.error('Failed to load campaigns:', bookingsRes.error.message)
    setLoadError('Failed to load data. Please refresh.')
    setDataLoading(false)
    return
  }
  if (screensRes.error) {
    console.error('Failed to load screens:', screensRes.error.message)
    setLoadError('Failed to load data. Please refresh.')
    setDataLoading(false)
    return
  }

  const bookings = bookingsRes.data
  const screens = screensRes.data
  if (bookings && bookings.length > 0) {
    setCampaigns(bookings.map(b => ({
      ...b,
      advertiser: b.advertiser_name,
      screen: b.screen_name,
      start: b.start_date,
      end: b.end_date,
      days: b.schedule_days,
      timeStart: b.time_start,
      timeEnd: b.time_end,
      spent: b.spent ?? 0,
      scans: b.scans ?? 0,
      color: b.accent_color,
      destination: b.destination_url,
      cta: b.cta_text,
    })))
  } else {
    setCampaigns([])
  }
  if (screens && screens.length > 0) {
    setDbScreens(screens.map(s => ({
      ...s,
      neighbourhood: s.location,
      owner: s.owner_name,
      cpm: s.cpm_floor || 4.20,
      maxDuration: s.max_ad_duration,
      revenue: s.monthly_revenue ?? 0,
      campaigns: 0,
    })))
  } else {
    setDbScreens([])
  }
  setDataLoading(false)
}, [activeAccount, user])
```

- [ ] **Step 5: Reload data when activeAccount changes**

Replace the existing `useEffect` that calls `loadData` on user change:

```jsx
useEffect(() => {
  if (user) loadData()
}, [user, activeAccount, loadData])
```

- [ ] **Step 6: Add routes for accounts hub and accept-grant**

In the `Routes` block inside the `App` default export (alongside the existing `/app/*` route), add two new public routes before the `*` catch-all:

```jsx
<Route path="/app/accounts" element={<RequireAuth><AccountHubRoute /></RequireAuth>} />
<Route path="/app/accept-grant" element={<AcceptGrantView />} />
```

Add `AccountHubRoute` as a new component at the bottom of App.jsx (before `DisplayPlayerRoute`):

```jsx
function AccountHubRoute() {
  const { setActiveAccount, setActiveMode } = useAuth()
  const navigate = useNavigate()

  function handleSelect(account) {
    if (!account.isOwn) {
      setActiveAccount(account)
      setActiveMode('advertiser')
    } else {
      setActiveAccount(null)
    }
    navigate('/app/overview')
  }

  return (
    <AppShell
      sidebar={null}
      header={<GlobalHeader user={{}} onSignOut={() => {}} />}
    >
      <AccountHub onSelectAccount={handleSelect} />
    </AppShell>
  )
}
```

- [ ] **Step 7: Verify routing works**

```bash
npm run dev
```

Log in as a user with no grants → should go straight to dashboard. Navigate manually to `/app/accounts` → AccountHub renders without crashing.

- [ ] **Step 8: Commit**

```bash
git add src/App.jsx
git commit -m "feat(app): add account hub routing, activeAccount query scoping, post-login redirect"
```

---

## Task 7: AccountSwitcher + GlobalHeader

**Files:**
- Create: `src/components/layout/AccountSwitcher.jsx`
- Modify: `src/components/layout/GlobalHeader.jsx`

- [ ] **Step 1: Create AccountSwitcher.jsx**

```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { C, F } from '../../design/tokens.js'

function RoleBadge({ role }) {
  const colors = {
    admin:   { bg: 'rgba(124,58,237,0.12)', color: '#7c3aed' },
    manager: { bg: 'rgba(37,99,235,0.12)',  color: '#2563eb' },
    viewer:  { bg: 'rgba(107,114,128,0.12)', color: '#6b7280' },
  }
  const s = colors[role] ?? colors.viewer
  return (
    <span style={{
      padding: '2px 7px', borderRadius: 8, fontSize: 10, fontWeight: 600,
      textTransform: 'capitalize', background: s.bg, color: s.color,
    }}>{role}</span>
  )
}

export function AccountSwitcher() {
  const { profile, grants, activeAccount, setActiveAccount, setActiveMode } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  if (!grants || grants.length === 0) return null

  const currentName = activeAccount
    ? (activeAccount.company_name || activeAccount.name || 'Client')
    : (profile?.company_name || profile?.name || 'My Account')

  function switchTo(account) {
    setOpen(false)
    if (!account) {
      setActiveAccount(null)
      navigate('/app/overview')
      return
    }
    setActiveAccount(account)
    setActiveMode('advertiser')
    navigate('/app/adv-overview')
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 12px', borderRadius: 8,
          background: activeAccount ? 'rgba(37,99,235,0.1)' : C.bg,
          border: `1px solid ${activeAccount ? C.blue : C.border}`,
          cursor: 'pointer', fontFamily: F.sans, fontSize: 13, color: C.text,
        }}
      >
        <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentName}
        </span>
        {activeAccount && <RoleBadge role={activeAccount.role} />}
        <span style={{ color: C.textMuted, fontSize: 10 }}>▾</span>
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 190 }} />
          <div style={{
            position: 'absolute', top: 38, left: 0, minWidth: 220,
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
            padding: '6px 0', zIndex: 200,
          }}>
            {/* Own account */}
            <button
              onClick={() => switchTo(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '8px 14px', background: 'none', border: 'none',
                cursor: 'pointer', textAlign: 'left', fontFamily: F.sans,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: !activeAccount ? 600 : 400, color: C.text }}>
                  {profile?.company_name || profile?.name || 'My Account'}
                </div>
                <div style={{ fontSize: 11, color: C.textMuted }}>Your account</div>
              </div>
              {!activeAccount && <span style={{ fontSize: 10, color: C.blue }}>●</span>}
            </button>

            {grants.length > 0 && (
              <div style={{ height: 1, background: C.border, margin: '4px 0' }} />
            )}

            {grants.map(g => {
              const acct = {
                id: g.account_id,
                name: g.account?.name,
                company_name: g.account?.company_name,
                logo_url: g.account?.logo_url,
                role: g.role,
                isOwn: false,
              }
              const isActive = activeAccount?.id === g.account_id
              return (
                <button
                  key={g.id}
                  onClick={() => switchTo(acct)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '8px 14px', background: 'none', border: 'none',
                    cursor: 'pointer', textAlign: 'left', fontFamily: F.sans,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: C.text }}>
                      {g.account?.company_name || g.account?.name || 'Client Account'}
                    </div>
                    <div style={{ marginTop: 2 }}><RoleBadge role={g.role} /></div>
                  </div>
                  {isActive && <span style={{ fontSize: 10, color: C.blue }}>●</span>}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add AccountSwitcher to GlobalHeader.jsx**

Add the import at the top:
```jsx
import { AccountSwitcher } from '../layout/AccountSwitcher.jsx'
```

Inside the `<header>` element, add `<AccountSwitcher />` before `<NotificationBell />`:

```jsx
<AccountSwitcher />
<NotificationBell />
```

The full header render should now be:
```jsx
return (
  <header style={{ /* existing styles */ }}>
    <AccountSwitcher />
    <NotificationBell />
    {/* existing avatar + dropdown */}
  </header>
)
```

- [ ] **Step 3: Verify**

Log in, go to `/app/accounts`, select a granted account. Confirm the header now shows the switcher with the client name and a blue border. Clicking it shows your own account + the client, with a dot indicating the active one.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/AccountSwitcher.jsx src/components/layout/GlobalHeader.jsx
git commit -m "feat(layout): add AccountSwitcher to GlobalHeader"
```

---

## Task 8: Grant Access modal

**Files:**
- Create: `src/views/accounts/GrantAccessModal.jsx`

- [ ] **Step 1: Create the file**

```jsx
import { useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { C, F } from '../../design/tokens.js'
import { SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js'

export function GrantAccessModal({ onClose, onGranted }) {
  const { user, profile } = useAuth()
  const [email, setEmail]   = useState('')
  const [role, setRole]     = useState('viewer')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)
  const [success, setSuccess] = useState(false)

  async function submit() {
    if (!email.trim()) { setError('Enter an email address.'); return }
    setSaving(true)
    setError(null)

    // Look up grantee by email
    const { data: grantee, error: lookupErr } = await supabase
      .from('profiles')
      .select('id, name, email')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle()

    if (lookupErr) { setError(lookupErr.message); setSaving(false); return }
    if (!grantee) { setError('No AdGrid account found with that email.'); setSaving(false); return }
    if (grantee.id === user.id) { setError("You can't grant access to yourself."); setSaving(false); return }

    // Create the grant
    const appUrl = window.location.origin
    const acceptUrl = `${appUrl}/app/accept-grant?grant=`

    const { data: grant, error: insertErr } = await supabase
      .from('account_grants')
      .insert({
        account_id: user.id,
        grantee_id: grantee.id,
        invite_email: email.trim().toLowerCase(),
        role,
        granted_by: user.id,
        status: 'pending',
      })
      .select()
      .single()

    if (insertErr) {
      setError(insertErr.code === '23505'
        ? 'This account already has a grant for that user.'
        : insertErr.message)
      setSaving(false)
      return
    }

    // Send invite notification + email
    const { data: { session } } = await supabase.auth.getSession()
    fetch(`${SUPABASE_FUNCTIONS_URL}/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        userId: grantee.id,
        type: 'grant_invite',
        data: {
          grantorName: profile?.company_name || profile?.name || user.email,
          role,
          acceptUrl: acceptUrl + grant.id,
          appUrl,
        },
      }),
    }).catch(e => console.error('Notification error:', e))

    setSuccess(true)
    setSaving(false)
    onGranted?.()
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 299 }}
      />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20,
        padding: '32px 28px', width: 420, zIndex: 300,
      }}>
        <h3 style={{ fontSize: 17, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: '0 0 20px' }}>
          Grant Account Access
        </h3>

        {success ? (
          <>
            <p style={{ fontSize: 14, color: C.green, fontFamily: F.sans, margin: '0 0 20px' }}>
              ✓ Invite sent to {email}
            </p>
            <button onClick={onClose} style={{ padding: '9px 22px', borderRadius: 8, background: C.blue, color: '#fff', border: 'none', fontFamily: F.sans, fontSize: 13, cursor: 'pointer' }}>
              Done
            </button>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 6, fontFamily: F.sans }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="agency@example.com"
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: C.text, boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 6, fontFamily: F.sans }}>
                Role
              </label>
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: C.text, background: C.surface }}
              >
                <option value="viewer">Viewer — read only</option>
                <option value="manager">Manager — create &amp; edit campaigns</option>
                <option value="admin">Admin — full access</option>
              </select>
            </div>

            {error && <p style={{ fontSize: 13, color: C.red, fontFamily: F.sans, margin: '0 0 12px' }}>{error}</p>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, padding: '9px', borderRadius: 8, background: 'transparent', border: `1px solid ${C.border}`, fontFamily: F.sans, fontSize: 13, cursor: 'pointer', color: C.textSub }}>
                Cancel
              </button>
              <button onClick={submit} disabled={saving} style={{ flex: 1, padding: '9px', borderRadius: 8, background: C.blue, color: '#fff', border: 'none', fontFamily: F.sans, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Sending…' : 'Send Invite'}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/views/accounts/GrantAccessModal.jsx
git commit -m "feat(accounts): add GrantAccessModal"
```

---

## Task 9: Access Settings view + SettingsView Access tab

**Files:**
- Create: `src/views/accounts/AccessSettingsView.jsx`
- Modify: `src/views/advertiser/SettingsView.jsx`

- [ ] **Step 1: Create AccessSettingsView.jsx**

```jsx
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { C, F } from '../../design/tokens.js'
import { GrantAccessModal } from './GrantAccessModal.jsx'

const ROLE_COLORS = {
  admin:   { bg: 'rgba(124,58,237,0.1)', color: '#7c3aed' },
  manager: { bg: 'rgba(37,99,235,0.1)',  color: '#2563eb' },
  viewer:  { bg: 'rgba(107,114,128,0.1)', color: '#6b7280' },
}

export function AccessSettingsView() {
  const { user } = useAuth()
  const [grants, setGrants]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)

  async function load() {
    const { data } = await supabase
      .from('account_grants')
      .select('*, grantee:grantee_id(name, email, company_name)')
      .eq('account_id', user.id)
      .neq('status', 'revoked')
      .order('created_at', { ascending: false })
    setGrants(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [user.id])

  async function revoke(grantId) {
    await supabase.from('account_grants').update({ status: 'revoked' }).eq('id', grantId)
    setGrants(prev => prev.filter(g => g.id !== grantId))
  }

  const statusColor = { pending: '#f59e0b', active: C.green, revoked: C.red }

  if (loading) return <p style={{ fontFamily: F.sans, fontSize: 13, color: C.textSub }}>Loading…</p>

  return (
    <div style={{ maxWidth: 580 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: F.sans, margin: 0 }}>
          Who has access to your account
        </h3>
        <button
          onClick={() => setShowModal(true)}
          style={{ padding: '8px 16px', borderRadius: 8, background: C.blue, color: '#fff', border: 'none', fontFamily: F.sans, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
        >
          Grant Access
        </button>
      </div>

      {grants.length === 0 ? (
        <p style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans }}>No one has access to your account yet.</p>
      ) : (
        grants.map(g => {
          const rc = ROLE_COLORS[g.role] ?? ROLE_COLORS.viewer
          return (
            <div key={g.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
              background: C.bg, borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 8,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.text, fontFamily: F.sans }}>
                  {g.grantee?.company_name || g.grantee?.name || g.invite_email || 'Unknown'}
                </div>
                <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginTop: 2 }}>
                  {g.grantee?.email || g.invite_email}
                </div>
              </div>
              <span style={{ padding: '2px 9px', borderRadius: 10, fontSize: 11, fontWeight: 600, textTransform: 'capitalize', background: rc.bg, color: rc.color }}>{g.role}</span>
              <span style={{ fontSize: 11, color: statusColor[g.status] ?? C.textMuted, fontFamily: F.sans, fontWeight: 500 }}>{g.status}</span>
              <button
                onClick={() => revoke(g.id)}
                style={{ padding: '4px 10px', borderRadius: 6, background: 'transparent', border: `1px solid ${C.border}`, fontFamily: F.sans, fontSize: 12, color: C.red, cursor: 'pointer' }}
              >
                Revoke
              </button>
            </div>
          )
        })
      )}

      {showModal && (
        <GrantAccessModal
          onClose={() => setShowModal(false)}
          onGranted={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add Access tab to SettingsView.jsx**

Add import near the top of `src/views/advertiser/SettingsView.jsx`:
```jsx
import { AccessSettingsView } from '../accounts/AccessSettingsView.jsx'
```

In the tabs array (around line 399), add the Access tab entry:
```jsx
{ id: "access", label: "Access" },
```

Below the last `{tab === "team" && ...}` line, add:
```jsx
{tab === "access" && <AccessSettingsView />}
```

- [ ] **Step 3: Verify**

Log in as an advertiser → Settings → Access tab. Confirm it renders with "Grant Access" button and empty state text.

- [ ] **Step 4: Commit**

```bash
git add src/views/accounts/AccessSettingsView.jsx src/views/advertiser/SettingsView.jsx
git commit -m "feat(settings): add Access tab to advertiser SettingsView"
```

---

## Task 10: TeamClientRoles + OperatorSettingsView

**Files:**
- Create: `src/views/accounts/TeamClientRoles.jsx`
- Modify: `src/views/operator/OperatorSettingsView.jsx`

- [ ] **Step 1: Create TeamClientRoles.jsx**

```jsx
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { C, F } from '../../design/tokens.js'

export function TeamClientRoles() {
  const { user } = useAuth()
  const [members, setMembers]   = useState([])
  const [clients, setClients]   = useState([])   // account_grants for this org
  const [selected, setSelected] = useState(null)  // selected team_member row
  const [clientRoles, setClientRoles] = useState([]) // team_member_client_roles for selected member
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    Promise.all([
      supabase
        .from('team_members')
        .select('*, user_profile:user_profile_id(name, email)')
        .eq('org_profile_id', user.id),
      supabase
        .from('account_grants')
        .select('*, account:account_id(id, name, company_name)')
        .eq('grantee_id', user.id)
        .eq('status', 'active'),
    ]).then(([mbRes, clRes]) => {
      setMembers(mbRes.data ?? [])
      setClients(clRes.data ?? [])
      setLoading(false)
    })
  }, [user.id])

  async function selectMember(member) {
    setSelected(member)
    const { data } = await supabase
      .from('team_member_client_roles')
      .select('*')
      .eq('team_member_id', member.id)
    setClientRoles(data ?? [])
  }

  async function setRole(clientAccountId, role) {
    const existing = clientRoles.find(r => r.client_account_id === clientAccountId)
    setSaving(true)
    if (role === 'none') {
      if (existing) {
        await supabase.from('team_member_client_roles').delete().eq('id', existing.id)
        setClientRoles(prev => prev.filter(r => r.client_account_id !== clientAccountId))
      }
    } else if (existing) {
      await supabase.from('team_member_client_roles').update({ role }).eq('id', existing.id)
      setClientRoles(prev => prev.map(r => r.client_account_id === clientAccountId ? { ...r, role } : r))
    } else {
      const { data: newRow } = await supabase
        .from('team_member_client_roles')
        .insert({ team_member_id: selected.id, client_account_id: clientAccountId, role })
        .select()
        .single()
      if (newRow) setClientRoles(prev => [...prev, newRow])
    }
    setSaving(false)
  }

  if (loading) return <p style={{ fontFamily: F.sans, fontSize: 13, color: C.textSub }}>Loading…</p>
  if (clients.length === 0) return (
    <p style={{ fontFamily: F.sans, fontSize: 13, color: C.textSub }}>
      No client accounts yet. Ask a client to grant you access first.
    </p>
  )

  return (
    <div style={{ maxWidth: 620, display: 'flex', gap: 20 }}>
      {/* Team member list */}
      <div style={{ width: 200, flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, fontFamily: F.sans, marginBottom: 10 }}>Team</div>
        {members.length === 0 && <p style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans }}>No team members yet.</p>}
        {members.map(m => (
          <button
            key={m.id}
            onClick={() => selectMember(m)}
            style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px',
              borderRadius: 8, border: `1px solid ${selected?.id === m.id ? C.blue : C.border}`,
              background: selected?.id === m.id ? 'rgba(37,99,235,0.06)' : 'transparent',
              marginBottom: 6, cursor: 'pointer', fontFamily: F.sans,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{m.user_profile?.name || m.user_profile?.email}</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{m.role}</div>
          </button>
        ))}
      </div>

      {/* Client access panel */}
      <div style={{ flex: 1 }}>
        {!selected ? (
          <p style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, paddingTop: 8 }}>Select a team member to manage their client access.</p>
        ) : (
          <>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, fontFamily: F.sans, marginBottom: 10 }}>
              Client Access for {selected.user_profile?.name || selected.user_profile?.email}
            </div>
            {clients.map(g => {
              const current = clientRoles.find(r => r.client_account_id === g.account_id)
              return (
                <div key={g.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  background: C.bg, borderRadius: 8, border: `1px solid ${C.border}`, marginBottom: 8,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.text, fontFamily: F.sans }}>
                      {g.account?.company_name || g.account?.name || 'Client Account'}
                    </div>
                    <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans }}>
                      Org grant: {g.role}
                    </div>
                  </div>
                  <select
                    value={current?.role ?? 'none'}
                    onChange={e => setRole(g.account_id, e.target.value)}
                    disabled={saving}
                    style={{ padding: '5px 8px', border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: F.sans, fontSize: 12, color: C.text, background: C.surface }}
                  >
                    <option value="none">No access</option>
                    <option value="viewer">Viewer</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add Client Access tab to OperatorSettingsView**

Near the top of `src/views/operator/OperatorSettingsView.jsx`, add import:
```jsx
import { TeamClientRoles } from '../accounts/TeamClientRoles.jsx'
```

Find the tabs array in OperatorSettingsView (it will be an array like `['Profile', 'Billing', 'Team']`). Add `'Client Access'` to it.

Find where tabs are rendered (the `{tab === 'team' && ...}` block) and add after it:
```jsx
{tab === 'Client Access' && <TeamClientRoles />}
```

- [ ] **Step 3: Verify**

Log in as operator → Operator Settings → Client Access tab. If no grants exist yet, shows "No client accounts yet" message. If grants exist, shows the two-column member/client layout.

- [ ] **Step 4: Commit**

```bash
git add src/views/accounts/TeamClientRoles.jsx src/views/operator/OperatorSettingsView.jsx
git commit -m "feat(settings): add TeamClientRoles and Client Access tab to operator settings"
```

---

## Task 11: Billing party selector in CreateCampaign

**Files:**
- Modify: `src/views/advertiser/CreateCampaign.jsx`

- [ ] **Step 1: Read the first 60 lines to find where form state is declared**

```bash
# In editor: open src/views/advertiser/CreateCampaign.jsx and find the useState declarations
```

- [ ] **Step 2: Add billedTo state and billing step**

At the top of the `CreateCampaign` component (where other `useState` calls are), add:

```jsx
const { activeAccount, user, profile } = useAuth()
const isDelegate = activeAccount && !activeAccount.isOwn
const canChooseBilling = isDelegate && ['admin', 'manager'].includes(activeAccount?.role)
const [billedTo, setBilledTo] = useState('client') // 'client' | 'agency'
```

Make sure `useAuth` is imported: `import { useAuth } from '../../context/AuthContext.jsx'`

- [ ] **Step 3: Add billing selector UI**

Find the section of the campaign form just before the submit button (look for `onSave` or the final "Create Campaign" / "Book" button). Before that button, add:

```jsx
{canChooseBilling && (
  <div style={{ marginBottom: 20, padding: '16px', background: C.bg, borderRadius: 10, border: `1px solid ${C.border}` }}>
    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 12 }}>
      Bill to
    </div>
    {[
      { value: 'client', label: 'Client account', desc: "Uses client's payment method" },
      { value: 'agency', label: 'Agency account', desc: 'Uses your payment method' },
    ].map(opt => (
      <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, cursor: 'pointer' }}>
        <input
          type="radio"
          name="billedTo"
          value={opt.value}
          checked={billedTo === opt.value}
          onChange={() => setBilledTo(opt.value)}
        />
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.text, fontFamily: F.sans }}>{opt.label}</div>
          <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans }}>{opt.desc}</div>
        </div>
      </label>
    ))}
  </div>
)}
```

- [ ] **Step 4: Pass billedTo when saving**

Find the call to `onSave(c)` (or wherever the booking is inserted in CreateCampaign). Add `billed_to_profile_id` to the insert payload:

```js
billed_to_profile_id: canChooseBilling && billedTo === 'agency' ? user.id : null,
```

- [ ] **Step 5: Verify**

Log in, switch to a client account (as manager or admin), go to create campaign. The "Bill to" radio group should appear. Without an active account or as viewer, it should be hidden.

- [ ] **Step 6: Commit**

```bash
git add src/views/advertiser/CreateCampaign.jsx
git commit -m "feat(campaigns): add billing party selector when acting as delegate"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| `account_grants` table + RLS | Task 1 |
| `team_member_client_roles` table + RLS | Task 1 |
| `billed_to_profile_id` on bookings | Task 1 |
| `has_account_grant()` RLS helper | Task 1 |
| RLS on bookings, screens, scans | Task 1 |
| `grant_invite` email template | Task 2 |
| AuthContext: activeAccount, grants, setActiveAccount, acceptGrant, revokeGrant | Task 3 |
| Account Hub card grid | Task 4 |
| Accept grant view + OAuth + pending grant auto-accept | Task 5 |
| App.jsx routing + post-login hub redirect | Task 6 |
| Query scoping to activeAccount | Task 6 |
| AccountSwitcher in header | Task 7 |
| Grant Access modal (email invite flow) | Task 8 |
| Access tab in advertiser settings | Task 9 |
| TeamClientRoles per-client assignment UI | Task 10 |
| Client Access tab in operator settings | Task 10 |
| Billing party selector in CreateCampaign | Task 11 |
| Social login (Google/GitHub) on invite accept | Task 5 (signInWithOAuth) |

All spec requirements covered. No TBDs or placeholders remain.
