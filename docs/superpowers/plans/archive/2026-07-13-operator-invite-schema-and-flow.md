# Operator Invite Schema & Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reproduce the `operator_invites`/`is_platform_owner` schema (currently live in production but absent from repo migrations) and build a working operator-invite send + accept flow against what's actually deployed, fixing a role-promotion bug the live `invite-operator` function currently has no way to complete.

**Architecture:** A new migration defines the schema. A new `accept-operator-invite` edge function is the only legal path to promote `profiles.role` to `'operator'` (client-side self-promotion is blocked by existing RLS). Two new React pages — `/app/admin/invites` (platform-owner-gated, send + list invites) and `/invite/:token` (public, set-password + accept) — complete the loop. The already-deployed `invite-operator` function is untouched.

**Tech Stack:** Supabase Postgres migrations, Supabase Edge Functions (Deno), React + `react-router-dom`, existing `src/components/primitives/*` design system.

Spec: `docs/superpowers/specs/2026-07-13-operator-invite-schema-and-flow-design.md`

**Testing note:** `src/` has no test runner configured anywhere in this repo (no vitest/jest, no `*.test.*` files). Introducing one is out of scope for this plan (confirmed in the spec's Testing section). Steps below substitute concrete manual verification (SQL queries to run, URLs to load, responses to check) for automated test steps.

**Production-safety note:** This repo's Supabase CLI is linked to a live project (`hkqiuwnppxkkztacwicj`, confirmed via `supabase/.temp/project-ref`). No task in this plan runs `supabase db push` or `supabase functions deploy` automatically — those are explicit, human-run steps in Task 6. Every other task only writes files and commits.

---

### Task 1: `operator_invites` schema migration

**Files:**
- Create: `supabase/migrations/20260713000000_operator_invites_schema.sql`

- [ ] **Step 1: Write the migration**

```sql
create type invite_status as enum ('pending', 'accepted', 'expired');

create table if not exists operator_invites (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  token        text not null unique default encode(gen_random_bytes(32), 'hex'),
  invited_by   uuid references profiles(id) on delete set null,
  status       invite_status not null default 'pending',
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '7 days'),
  accepted_at  timestamptz
);

create index if not exists operator_invites_token_idx  on operator_invites(token);
create index if not exists operator_invites_email_idx  on operator_invites(email);
create index if not exists operator_invites_status_idx on operator_invites(status);

alter table operator_invites enable row level security;

create policy "Platform owners can manage invites"
  on operator_invites for all
  using (exists (select 1 from profiles where id = auth.uid() and is_platform_owner = true));

-- Public read by token: the accept page looks up invite details (email, status,
-- expiry) before the user has any authenticated session of their own yet.
create policy "Anyone can read invite by token"
  on operator_invites for select
  using (true);

alter table profiles add column if not exists is_platform_owner boolean not null default false;

comment on table operator_invites is
  'Platform owner-issued invites for new screen operators. Token is emailed via invite-operator; expires after 7 days.';
```

- [ ] **Step 2: Review for correctness**

Re-read the file. Confirm: `invite_status` enum values match what `accept-operator-invite` (Task 2) will check against (`'pending'`, `'accepted'`, `'expired'`); `expires_at` has a column default so the already-deployed `invite-operator` function (which only inserts `{ email, invited_by }`) populates it automatically; both RLS policies are present; `is_platform_owner` addition is idempotent (`if not exists`).

Do **not** run `supabase db push` yet — that's Task 6, done explicitly by a human.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260713000000_operator_invites_schema.sql
git commit -m "feat(db): add operator_invites schema and profiles.is_platform_owner"
```

---

### Task 2: `accept-operator-invite` edge function

**Files:**
- Create: `supabase/functions/accept-operator-invite/index.ts`

- [ ] **Step 1: Write the function**

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Content-Type": "application/json",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401, headers: CORS });

  const bearer = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(bearer);
  if (authError || !user) return new Response("Unauthorized", { status: 401, headers: CORS });

  const { token } = await req.json();
  if (!token || typeof token !== "string") {
    return new Response(JSON.stringify({ error: "invalid_token" }), { status: 400, headers: CORS });
  }

  const { data: invite, error: fetchError } = await supabase
    .from("operator_invites")
    .select("id, email, status, expires_at")
    .eq("token", token)
    .single();

  if (fetchError || !invite) {
    return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: CORS });
  }

  if (invite.status === "accepted") {
    return new Response(JSON.stringify({ error: "already_accepted" }), { status: 409, headers: CORS });
  }

  if (invite.status === "expired" || new Date(invite.expires_at) < new Date()) {
    return new Response(JSON.stringify({ error: "expired" }), { status: 410, headers: CORS });
  }

  if (invite.email.toLowerCase() !== (user.email ?? "").toLowerCase()) {
    return new Response(JSON.stringify({ error: "email_mismatch" }), { status: 403, headers: CORS });
  }

  const { error: roleError } = await supabase
    .from("profiles")
    .update({ role: "operator" })
    .eq("id", user.id);

  if (roleError) {
    return new Response(JSON.stringify({ error: roleError.message }), { status: 500, headers: CORS });
  }

  await supabase
    .from("operator_invites")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  return new Response(JSON.stringify({ ok: true }), { headers: CORS });
});
```

This mirrors the existing `supabase/functions/invite-operator/index.ts` and `operator-billing/index.ts` conventions exactly: same CORS header shape, same bearer-token auth check pattern, service-role client so the update can bypass the `profiles` RLS `WITH CHECK` that otherwise blocks self-promotion (that block is the entire reason this function needs to exist server-side).

- [ ] **Step 2: Review for correctness**

Re-read the file. Confirm the check order matches the spec: not-found → already-accepted → expired → email-mismatch → role update → mark accepted. Confirm no client-controllable input other than `token` is trusted (email comes from the authenticated `user` object, not the request body).

Do **not** run `supabase functions deploy` yet — that's Task 6.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/accept-operator-invite/index.ts
git commit -m "feat(functions): add accept-operator-invite edge function"
```

---

### Task 3: `RequirePlatformOwner` route guard

**Files:**
- Create: `src/components/auth/RequirePlatformOwner.jsx`

- [ ] **Step 1: Write the component**

```jsx
import { useAuth } from '../../context/AuthContext.jsx'
import { Navigate } from 'react-router-dom'

export function RequirePlatformOwner({ children }) {
  const { profile, loading } = useAuth()
  if (loading) return null
  if (!profile?.is_platform_owner) return <Navigate to="/app" replace />
  return children
}
```

This mirrors `src/components/auth/RequireAuth.jsx` exactly (same file, same pattern, just gating on `profile.is_platform_owner` instead of `user`).

- [ ] **Step 2: Verify**

Read `src/components/auth/RequireAuth.jsx` side-by-side with this new file. Confirm the shape matches (both check `loading` first, both return `null` while loading, both use `<Navigate replace>`).

- [ ] **Step 3: Commit**

```bash
git add src/components/auth/RequirePlatformOwner.jsx
git commit -m "feat(auth): add RequirePlatformOwner route guard"
```

---

### Task 4: `/app/admin/invites` page

**Files:**
- Create: `src/views/admin/AdminInvites.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Write the page**

```jsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js'
import { useToast } from '../../components/primitives/Toast.jsx'
import { C, F } from '../../design/tokens.js'
import { Card } from '../../components/primitives/Card.jsx'
import { Btn } from '../../components/primitives/Btn.jsx'
import { Inp } from '../../components/primitives/Inp.jsx'
import { Badge } from '../../components/primitives/Badge.jsx'

function useInvites() {
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('operator_invites')
      .select('id, email, status, created_at')
      .order('created_at', { ascending: false })
    setInvites(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { invites, loading, refresh }
}

export function AdminInvites() {
  const navigate = useNavigate()
  const toast = useToast()
  const { invites, loading, refresh } = useInvites()
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)

  const sendInvite = async () => {
    if (!email.includes('@')) { toast.error('Enter a valid email address.'); return }
    setSending(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/invite-operator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ email }),
    })
    const body = await res.json().catch(() => ({}))
    setSending(false)
    if (!res.ok) { toast.error(body?.error ?? 'Failed to send invite.'); return }
    toast.success('Invite sent.')
    setEmail('')
    refresh()
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 20px' }}>
      <Btn variant="ghost" onClick={() => navigate('/app')} style={{ marginBottom: 16, paddingLeft: 0 }}>
        ← Back
      </Btn>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, fontFamily: F.sans, marginBottom: 20 }}>
        Invite an Operator
      </h1>
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <Inp
              label="Email"
              type="email"
              placeholder="operator@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <Btn onClick={sendInvite} disabled={sending}>
            {sending ? 'Sending…' : 'Send Invite'}
          </Btn>
        </div>
      </Card>

      <h2 style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 12 }}>
        Invites
      </h2>
      {loading ? (
        <div style={{ color: C.textSub, fontFamily: F.sans, fontSize: 13 }}>Loading…</div>
      ) : invites.length === 0 ? (
        <div style={{ color: C.textSub, fontFamily: F.sans, fontSize: 13 }}>No invites sent yet.</div>
      ) : (
        invites.map(inv => (
          <Card
            key={inv.id}
            style={{ marginBottom: 10, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <span style={{ fontFamily: F.sans, fontSize: 13, color: C.text }}>{inv.email}</span>
            <Badge status={inv.status}>{inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}</Badge>
          </Card>
        ))
      )}
    </div>
  )
}
```

Note: `Badge`'s status-to-color map (`src/components/primitives/Badge.jsx`) has an explicit entry for `'pending'` (amber) but not for `'accepted'`/`'expired'` — those fall back to its default grey styling. Since `children` is always passed explicitly here, the label text is always correct regardless; only the color is generic for those two states. Not worth extending the shared `Badge` component's status vocabulary for this one page.

- [ ] **Step 2: Wire the route into `App.jsx`**

In `src/App.jsx`, add an import near the other view imports (e.g. next to wherever `Billing` or similar operator views are imported):

```jsx
import { AdminInvites } from './views/admin/AdminInvites.jsx';
import { RequirePlatformOwner } from './components/auth/RequirePlatformOwner.jsx';
```

Add a new route alongside the existing `/app/accounts` route (both are top-level routes outside the `/app/*` catch-all, so this follows the same established pattern rather than needing to touch `AppInner`'s internal routing):

```jsx
<Route path="/app/accounts" element={<RequireAuth><AccountHubRoute /></RequireAuth>} />
<Route
  path="/app/admin/invites"
  element={<RequireAuth><RequirePlatformOwner><AdminInvites /></RequirePlatformOwner></RequireAuth>}
/>
```

- [ ] **Step 3: Verify**

Read the edited `src/App.jsx` back. Confirm the new route sits alongside `/app/accounts` (not nested inside the `/app/*` catch-all), confirm both new imports resolve to files that exist, confirm `RequireAuth` wraps `RequirePlatformOwner` wraps `AdminInvites` (auth check before platform-owner check).

There is no way to click into this page yet (no Sidebar nav entry — deliberately deferred; the full admin dashboard sub-project will add real navigation). For now it's reached by typing the URL directly, which is fine for this scope.

- [ ] **Step 4: Commit**

```bash
git add src/views/admin/AdminInvites.jsx src/App.jsx
git commit -m "feat(admin): add /app/admin/invites page"
```

---

### Task 5: `/invite/:token` acceptance page

**Files:**
- Create: `src/views/invite/InviteAcceptPage.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Write the page**

```jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js'
import { C, F } from '../../design/tokens.js'
import { Btn } from '../../components/primitives/Btn.jsx'
import { Inp } from '../../components/primitives/Inp.jsx'

export function InviteAcceptPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading') // loading | valid | invalid | expired | already_accepted
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!token) { setStatus('invalid'); return }
    supabase
      .from('operator_invites')
      .select('email, status, expires_at')
      .eq('token', token)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) { setStatus('invalid'); return }
        if (data.status === 'accepted') { setStatus('already_accepted'); return }
        if (data.status === 'expired' || new Date(data.expires_at) < new Date()) { setStatus('expired'); return }
        setStatus('valid')
      })
  }, [token])

  async function submit() {
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setError('')
    setSaving(true)

    const { error: pwError } = await supabase.auth.updateUser({ password })
    if (pwError) { setSaving(false); setError(pwError.message); return }

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/accept-operator-invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ token }),
    })
    setSaving(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(
        body?.error === 'expired' ? 'This invite has expired.'
        : body?.error === 'already_accepted' ? 'This invite was already used.'
        : 'Something went wrong finishing setup. Try again.'
      )
      return
    }
    navigate('/app', { replace: true })
  }

  const page = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A0A0F' }
  const card = { width: '100%', maxWidth: 380, background: 'rgba(17,17,24,0.9)', border: '1px solid #1E1E2E', borderRadius: 16, padding: 28 }

  if (status === 'loading') {
    return <div style={page}><div style={{ color: '#8A8A9A', fontFamily: F.sans, fontSize: 13 }}>Loading…</div></div>
  }

  if (status === 'invalid' || status === 'expired' || status === 'already_accepted') {
    const message = status === 'invalid' ? "This invite link isn't valid."
      : status === 'expired' ? 'This invite has expired. Ask your platform owner to send a new one.'
      : 'This invite was already used.'
    return (
      <div style={page}>
        <div style={card}>
          <p style={{ color: '#fff', fontFamily: F.sans, fontSize: 14, marginBottom: 16 }}>{message}</p>
          <Btn onClick={() => navigate('/login')}>Back to sign in</Btn>
        </div>
      </div>
    )
  }

  return (
    <div style={page}>
      <div style={card}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 4, fontFamily: F.sans }}>
          Set your password
        </h1>
        <p style={{ fontSize: 13, color: '#8A8A9A', marginBottom: 20, fontFamily: F.sans }}>
          Choose a password to finish setting up your operator account.
        </p>
        {error && <div style={{ color: C.red, fontFamily: F.sans, fontSize: 12, marginBottom: 12 }}>{error}</div>}
        <div style={{ marginBottom: 16 }}>
          <Inp
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>
        <Btn onClick={submit} disabled={saving} style={{ width: '100%', justifyContent: 'center' }}>
          {saving ? 'Saving…' : 'Set password and continue'}
        </Btn>
      </div>
    </div>
  )
}
```

Deliberately does not use `useAuth()`/`AuthContext` — it talks to `supabase` directly, same as `LoginPage.jsx` does for its own auth calls. This keeps the page self-contained: it doesn't matter whether `AuthContext`'s `PASSWORD_RECOVERY`/`SIGNED_IN` event bookkeeping fires one way or another during this page's lifetime, because nothing here reads `user`/`profile`, and this route isn't wrapped in `RequireAuth`/`PublicOnlyRoute` so no redirect can fire out from under it either.

- [ ] **Step 2: Wire the route into `App.jsx`**

Add an import:

```jsx
import { InviteAcceptPage } from './views/invite/InviteAcceptPage.jsx';
```

Add a route alongside the existing `/display/:token` route (same pattern — a plain, ungated top-level route; `InviteAcceptPage` reads `token` via its own `useParams()` call, so no wrapper function is needed the way `DisplayPlayerRoute` needed one):

```jsx
<Route path="/display/:token" element={<DisplayPlayerRoute />} />
<Route path="/invite/:token" element={<InviteAcceptPage />} />
```

- [ ] **Step 3: Verify**

Read the edited `src/App.jsx` back. Confirm `/invite/:token` is registered as a plain route, not wrapped in `PublicOnlyRoute` or `RequireAuth` (both would break this flow — the user IS authenticated at this point via the magic-link session, and `PublicOnlyRoute` would bounce them to `/app` before they've set a password).

- [ ] **Step 4: Commit**

```bash
git add src/views/invite/InviteAcceptPage.jsx src/App.jsx
git commit -m "feat(invite): add /invite/:token acceptance page"
```

---

### Task 6: Manual deployment and QA (human, not automatable)

**This task is for the user, not the implementing agent.** No further code changes. These steps touch the live Supabase project (`hkqiuwnppxkkztacwicj`) and a real inbox — they need a human at the keyboard, not an unattended agent.

- [ ] Run `supabase db push` (or apply the migration however this project's deploy process normally works) to apply `20260713000000_operator_invites_schema.sql` to the live database.
- [ ] Run `supabase functions deploy accept-operator-invite` to deploy the new edge function.
- [ ] Bootstrap: manually set `is_platform_owner = true` for your own account —
  ```sql
  update profiles set is_platform_owner = true where email = 'your-email@example.com';
  ```
  (There is no UI to grant this yet; it's a one-time manual step, same as how `is_platform_owner` itself was being checked in code before this migration ever gave it a column definition.)
- [ ] Sign in, visit `/app/admin/invites` directly (no nav link yet), send an invite to a test email you control.
- [ ] Confirm in the DB: a new `operator_invites` row exists with `status = 'pending'` and `expires_at` about 7 days out.
- [ ] Click the invite link from the test inbox; confirm it lands on `/invite/:token` already signed in (no login prompt), set a password.
- [ ] Confirm redirect to `/app`, and confirm in the DB: `profiles.role = 'operator'` for that test account, `operator_invites.status = 'accepted'`, `accepted_at` populated.
- [ ] Revisit the same `/invite/:token` URL — confirm it shows the "already used" state, not the password form again.
- [ ] Manually expire an invite for a test: `update operator_invites set expires_at = now() - interval '1 day' where email = '...';` then visit its link — confirm the "expired" state shows, and that `accept-operator-invite` rejects it (check the network response is a 410 with `{"error":"expired"}`) even if you try calling it directly.
- [ ] Visit `/app/admin/invites` while signed in as a non-platform-owner account — confirm it redirects away to `/app`.

---

## Post-plan verification

Run `npm run build` (or whatever this project's Vite build command is) after Tasks 3–5 to confirm the new files have no syntax errors and the app still compiles, since there's no test suite to catch that otherwise. This is safe to run unattended — it doesn't touch the live Supabase project, only compiles the frontend.
