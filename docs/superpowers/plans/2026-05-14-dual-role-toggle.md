# Dual-Role Toggle & Demo Credentials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow a single account to toggle between operator and advertiser views in-app, gated on screen ownership, plus a one-click demo login button.

**Architecture:** `AuthContext` gains `activeRole` state and `toggleRole()`. `App.jsx` reads `activeRole` instead of `profile.role` for UI routing. A new Supabase migration updates advertiser RLS policies to allow `role = 'operator'` users. Screen registration promotes user's DB role to `operator`. `GlobalHeader` avatar dropdown gains a "Switch to..." option when `canToggleToOperator`. `LoginPage` gains a Demo button that pre-fills and auto-submits env-var credentials.

**Tech Stack:** React, Supabase (RLS migrations), Vite env vars

---

## File Map

| File | Change |
|---|---|
| `supabase/migrations/20260514000000_dual_role.sql` | New — update advertiser RLS + screen insert promotes role |
| `src/context/AuthContext.jsx` | Add `activeRole`, `canToggleToOperator`, `toggleRole()` |
| `src/App.jsx` | Read `activeRole` from context instead of `role` for `isAdv`/`effectiveRole` |
| `src/components/layout/GlobalHeader.jsx` | Add "Switch to..." item in avatar dropdown |
| `src/views/operator/Screens.jsx` | On first screen save, upsert profile role to `operator` |
| `src/components/login/LoginPage.jsx` | Add Demo button using `VITE_DEMO_EMAIL`/`VITE_DEMO_PASSWORD` |
| `.env` (create if absent) | Add `VITE_DEMO_EMAIL` and `VITE_DEMO_PASSWORD` |

---

## Task 1: RLS Migration

**Files:**
- Create: `supabase/migrations/20260514000000_dual_role.sql`

RLS policies gating advertiser tables on `role = 'advertiser'` must also allow `role = 'operator'` so dual-role users can create and view campaigns.

Affected tables from migration audit:
- `scans` — `advertiser_own_scans` policy uses `advertiser_id = auth.uid()` (no role check — already fine)
- `bookings` — check current policy
- `advertiser_integrations` — `advertiser_own_integrations` uses `advertiser_id = auth.uid()` (no role check — fine)

- [ ] **Step 1: Check bookings RLS**

```bash
grep -rn "POLICY\|role" supabase/migrations/ | grep -i booking
```

Expected: see existing booking policies. If any check `role = 'advertiser'`, add them to the migration. If none do, the migration only needs the helper function below.

- [ ] **Step 2: Write migration**

```sql
-- supabase/migrations/20260514000000_dual_role.sql

-- Helper: true when caller is an advertiser OR an operator acting as advertiser
-- Used by RLS policies that previously checked role = 'advertiser'
CREATE OR REPLACE FUNCTION is_advertiser_or_operator()
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('advertiser', 'operator')
  );
$$;

-- Re-create scans policy to allow operators to see their own-advertiser scans
-- (existing policy uses advertiser_id = auth.uid() — no change needed)
-- Re-create only if a role-check policy exists; otherwise this migration is a no-op guard.
-- The migration is safe to apply even if no existing policies check role = 'advertiser'.
```

> **Note:** After running Step 1, if no booking/other policy checks `role = 'advertiser'` explicitly, the migration body above is the complete file. If any do, add `DROP POLICY` + `CREATE POLICY` blocks replacing `role = 'advertiser'` with `is_advertiser_or_operator()`.

- [ ] **Step 3: Apply migration**

```bash
npx supabase db push
```

Expected: migration applies with no errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260514000000_dual_role.sql
git commit -m "feat: rls migration — operators allowed on advertiser tables"
```

---

## Task 2: AuthContext — activeRole + toggleRole

**Files:**
- Modify: `src/context/AuthContext.jsx`

- [ ] **Step 1: Add activeRole state and derived values**

In `AuthProvider`, after the existing state declarations, add:

```jsx
const [activeRole, setActiveRole] = useState(null)
```

- [ ] **Step 2: Sync activeRole when profile loads**

In `fetchProfile`, after `setProfile(data)`:

```jsx
async function fetchProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  setProfile(data)
  // Sync activeRole to DB role on every profile fetch (login, refresh)
  if (data?.role) setActiveRole(data.role)
  return data
}
```

- [ ] **Step 3: Add toggleRole and canToggleToOperator**

After the `setRole` function:

```jsx
// canToggleToOperator: true when DB role is operator (has screens)
const canToggleToOperator = profile?.role === 'operator'

function toggleRole(targetRole) {
  if (targetRole === 'operator' && !canToggleToOperator) return
  setActiveRole(targetRole)
}
```

- [ ] **Step 4: Expose in context value**

Replace the existing `return` provider value:

```jsx
return (
  <AuthContext.Provider value={{
    user, profile, role, loading,
    activeRole, canToggleToOperator, toggleRole,
    signUp, signIn, signOut, signInWithOAuth, setRole,
  }}>
    {children}
  </AuthContext.Provider>
)
```

- [ ] **Step 5: Verify in browser**

Start dev server (`npm run dev`), sign in, open browser console and run:

```js
// Paste in console — should log context shape
// AuthContext is not directly accessible from console,
// but the app should load without errors.
```

Check browser console for no errors on load.

- [ ] **Step 6: Commit**

```bash
git add src/context/AuthContext.jsx
git commit -m "feat: activeRole + toggleRole in AuthContext"
```

---

## Task 3: App.jsx — read activeRole

**Files:**
- Modify: `src/App.jsx`

`App.jsx` currently computes `effectiveRole` from `impersonating` and `role`. It must now also account for `activeRole`.

- [ ] **Step 1: Import activeRole and toggleRole from context**

Find this line in `App.jsx`:

```jsx
const { user, profile, role, loading, signOut } = useAuth();
```

Replace with:

```jsx
const { user, profile, role, loading, signOut, activeRole, canToggleToOperator, toggleRole } = useAuth();
```

- [ ] **Step 2: Update effectiveRole computation**

Find:

```jsx
const effectiveRole = impersonating ? 'advertiser' : role;
```

Replace with:

```jsx
// impersonation takes priority; otherwise use session-only activeRole
const effectiveRole = impersonating ? 'advertiser' : (activeRole ?? role);
```

- [ ] **Step 3: Update default active tab on login**

Find:

```jsx
useEffect(() => {
  if (user) {
    setActive(role === 'advertiser' ? 'adv-overview' : 'overview');
    loadData();
  }
}, [user, role, loadData]);
```

Replace with:

```jsx
useEffect(() => {
  if (user) {
    const startRole = activeRole ?? role;
    setActive(startRole === 'advertiser' ? 'adv-overview' : 'overview');
    loadData();
  }
}, [user, role, activeRole, loadData]);
```

- [ ] **Step 4: Pass toggleRole and canToggleToOperator to GlobalHeader**

Find the `GlobalHeader` usage:

```jsx
<GlobalHeader
  active={active}
  setActive={navigate}
  user={displayUser}
  onSignOut={signOut}
  isAdv={isAdv}
/>
```

Replace with:

```jsx
<GlobalHeader
  active={active}
  setActive={navigate}
  user={displayUser}
  onSignOut={signOut}
  isAdv={isAdv}
  canToggleToOperator={canToggleToOperator}
  onToggleRole={(targetRole) => {
    toggleRole(targetRole);
    navigate(targetRole === 'advertiser' ? 'adv-overview' : 'overview');
  }}
/>
```

- [ ] **Step 5: Verify app still loads for both roles**

In browser: sign in as operator account. Check dashboard renders. Check console — no errors.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: App reads activeRole from context for role switching"
```

---

## Task 4: GlobalHeader — role switch dropdown item

**Files:**
- Modify: `src/components/layout/GlobalHeader.jsx`

- [ ] **Step 1: Add canToggleToOperator and onToggleRole props**

Find:

```jsx
export function GlobalHeader({ active, setActive, user, onSignOut, isAdv }) {
```

Replace with:

```jsx
export function GlobalHeader({ active, setActive, user, onSignOut, isAdv, canToggleToOperator, onToggleRole }) {
```

- [ ] **Step 2: Add switch item above the sign out divider in the dropdown**

Find the dropdown section ending with:

```jsx
<div style={{ borderTop: `1px solid ${C.border}`, marginTop: 4 }} />
<button onClick={() => { onSignOut(); setMenuOpen(false); }} style={{
  display: 'block', width: '100%', textAlign: 'left',
  padding: '8px 16px', background: 'none', border: 'none',
  fontFamily: F.sans, fontSize: 13, color: C.red, cursor: 'pointer',
}}>Sign out</button>
```

Replace with:

```jsx
{canToggleToOperator && (
  <>
    <button
      onClick={() => {
        onToggleRole(isAdv ? 'operator' : 'advertiser');
        setMenuOpen(false);
      }}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '8px 16px', background: 'none', border: 'none',
        fontFamily: F.sans, fontSize: 13, color: C.purple, cursor: 'pointer',
        fontWeight: 500,
      }}
      onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >
      {isAdv ? '⇄ Switch to Operator' : '⇄ Switch to Advertiser'}
    </button>
  </>
)}
<div style={{ borderTop: `1px solid ${C.border}`, marginTop: 4 }} />
<button onClick={() => { onSignOut(); setMenuOpen(false); }} style={{
  display: 'block', width: '100%', textAlign: 'left',
  padding: '8px 16px', background: 'none', border: 'none',
  fontFamily: F.sans, fontSize: 13, color: C.red, cursor: 'pointer',
}}>Sign out</button>
```

- [ ] **Step 3: Verify toggle appears and works**

In browser with an operator account:
1. Click avatar → dropdown opens
2. "⇄ Switch to Advertiser" visible
3. Click it → advertiser dashboard renders
4. Click avatar again → "⇄ Switch to Operator" shown
5. Click → operator dashboard renders

- [ ] **Step 4: Verify toggle hidden for advertiser-only accounts**

Sign in with a pure `role='advertiser'` account (no screens). Open avatar dropdown — switch option should NOT appear.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/GlobalHeader.jsx
git commit -m "feat: role toggle in header dropdown, gated on canToggleToOperator"
```

---

## Task 5: Screen registration promotes role to operator

**Files:**
- Modify: `src/views/operator/Screens.jsx`

When a user who is currently `role='advertiser'` saves their first screen, their DB role should be promoted to `operator`. This makes `canToggleToOperator` true on next profile fetch.

- [ ] **Step 1: Find the screen save handler in Screens.jsx**

```bash
grep -n "supabase.from('screens').insert\|screens.*insert\|insert.*screens" src/views/operator/Screens.jsx
```

Note the line number. Open `src/views/operator/Screens.jsx` and find the insert call.

- [ ] **Step 2: Import useAuth in Screens.jsx**

At the top of `src/views/operator/Screens.jsx`, find the existing imports and add:

```jsx
import { useAuth } from '../../context/AuthContext.jsx';
```

- [ ] **Step 3: Destructure setRole from useAuth inside the component**

Inside the `ScreensView` component function (or wherever the screen save handler lives), add:

```jsx
const { profile, setRole } = useAuth();
```

- [ ] **Step 4: After successful screen insert, promote role if needed**

After the screen insert succeeds (find the `.then` or `await` block), add role promotion:

```jsx
// After screens insert succeeds:
if (profile?.role !== 'operator') {
  await setRole('operator');
}
```

This is a no-op if already operator. `setRole` calls `fetchProfile` internally, so `canToggleToOperator` updates automatically.

- [ ] **Step 5: Verify promotion in browser**

1. Create a test account with `role='advertiser'`
2. Navigate to Screens (you'll need to manually set active to 'screens' via App.jsx for an advertiser account, or test via operator path)
3. Register a screen
4. After save, open avatar dropdown — "Switch to Advertiser" should now appear
5. Check Supabase `profiles` table — `role` should be `'operator'`

- [ ] **Step 6: Commit**

```bash
git add src/views/operator/Screens.jsx
git commit -m "feat: registering first screen promotes profile role to operator"
```

---

## Task 6: Demo button on LoginPage

**Files:**
- Create/modify: `.env`
- Modify: `src/components/login/LoginPage.jsx`

- [ ] **Step 1: Add env vars**

Check if `.env` exists:

```bash
ls .env 2>/dev/null && echo "exists" || echo "missing"
```

If missing, create it. Add to `.env` (or append if exists):

```
VITE_DEMO_EMAIL=demo@adgrid.io
VITE_DEMO_PASSWORD=demo1234
```

Add `.env` to `.gitignore` if not already there:

```bash
grep -q "^\.env$" .gitignore || echo ".env" >> .gitignore
```

- [ ] **Step 2: Add Demo button to LoginPage**

In `src/components/login/LoginPage.jsx`, find the divider section:

```jsx
{/* Divider */}
<div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
  <div style={{ flex: 1, height: 1, background: C.border }} />
  <span style={{ fontSize: 12, color: C.textMuted, fontFamily: F.sans }}>or</span>
  <div style={{ flex: 1, height: 1, background: C.border }} />
</div>
```

Add the Demo button **after** the divider (before the role toggle):

```jsx
{/* Divider */}
<div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
  <div style={{ flex: 1, height: 1, background: C.border }} />
  <span style={{ fontSize: 12, color: C.textMuted, fontFamily: F.sans }}>or</span>
  <div style={{ flex: 1, height: 1, background: C.border }} />
</div>

{import.meta.env.VITE_DEMO_EMAIL && (
  <button
    onClick={async () => {
      setErr('');
      setLoading(true);
      const { error } = await signIn(
        import.meta.env.VITE_DEMO_EMAIL,
        import.meta.env.VITE_DEMO_PASSWORD,
      );
      if (error) setErr(error.message);
      setLoading(false);
    }}
    disabled={loading}
    style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      width: '100%', padding: '10px 16px', borderRadius: 8, marginBottom: 16,
      border: `1px dashed ${C.purple}`, background: 'transparent',
      cursor: 'pointer', fontSize: 13, fontWeight: 500,
      color: C.purple, fontFamily: F.sans, transition: 'background 0.15s',
    }}
    onMouseEnter={e => e.currentTarget.style.background = C.purpleSoft ?? 'rgba(124,58,237,0.06)'}
    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
  >
    ▶ Try Demo
  </button>
)}
```

- [ ] **Step 3: Verify demo button only shows when env var set**

```bash
npm run dev
```

Open `http://localhost:5173/login`. "Try Demo" button should appear (env var is set). Click it — should log in as demo account and land on operator dashboard.

- [ ] **Step 4: Verify button hidden in prod if env var absent**

The `import.meta.env.VITE_DEMO_EMAIL &&` guard means the button won't render if the env var is unset in production. No additional guard needed.

- [ ] **Step 5: Commit**

```bash
git add src/components/login/LoginPage.jsx .gitignore
git commit -m "feat: demo login button on LoginPage, reads from VITE_DEMO_EMAIL env var"
```

> **Note:** Do NOT commit `.env` — it contains credentials. Only commit `.gitignore` and `LoginPage.jsx`.

---

## Task 7: Create demo Supabase account

This task is manual (Supabase dashboard or SQL), not code.

- [ ] **Step 1: Create auth user**

In Supabase dashboard → Authentication → Users → Add user:
- Email: `demo@adgrid.io`
- Password: `demo1234`
- Email confirmed: yes

Or via SQL:

```sql
-- Run in Supabase SQL editor
SELECT supabase_admin.create_user(
  '{"email": "demo@adgrid.io", "password": "demo1234", "email_confirm": true}'::jsonb
);
```

- [ ] **Step 2: Set profile role and name**

After user created, get their UUID from Authentication → Users. Then run in SQL editor:

```sql
-- Replace <UUID> with the actual user id
UPDATE profiles
SET
  role = 'operator',
  name = 'Demo User'
WHERE id = '<UUID>';
```

- [ ] **Step 3: Register a demo screen**

```sql
-- Replace <UUID> with the demo user id
INSERT INTO screens (name, city, location, status, impressions, cpm_floor, operator_id, lat, lng)
VALUES (
  'Demo Screen — Oxford Street',
  'London',
  'Oxford Street',
  'live',
  12000,
  4.20,
  '<UUID>',
  51.5142,
  -0.1494
);
```

- [ ] **Step 4: Seed a demo booking**

```sql
-- Replace <SCREEN_ID> with the screen id from step 3
-- Replace <UUID> with demo user id
INSERT INTO bookings (
  advertiser_name, screen_name, city, start_date, end_date,
  budget, status, advertiser_id, impressions, accent_color,
  headline, cta_text
)
VALUES (
  'Demo Brand',
  'Demo Screen — Oxford Street',
  'London',
  now()::date,
  (now() + interval '30 days')::date,
  500,
  'scheduled',
  '<UUID>',
  8400,
  '#7c3aed',
  'Great Deals Await',
  'Shop Now'
);
```

- [ ] **Step 5: Seed impression events**

```sql
-- Replace <SCREEN_ID> and <CAMPAIGN_ID> from steps above
INSERT INTO impression_events (screen_id, campaign_id, window_start, window_end, people_count, avg_dwell_seconds, avg_attention_score)
SELECT
  '<SCREEN_ID>'::uuid,
  '<CAMPAIGN_ID>'::uuid,
  now() - (n || ' hours')::interval,
  now() - (n || ' hours')::interval + interval '30 minutes',
  (random() * 40 + 10)::int,
  (random() * 8 + 2)::numeric(4,1),
  (random() * 0.4 + 0.5)::numeric(3,2)
FROM generate_series(1, 48) AS n;
```

- [ ] **Step 6: Verify demo login**

In browser at `/login`, click "Try Demo". Should land on operator dashboard with screen and campaign visible. Open avatar dropdown → "Switch to Advertiser" should be present. Switch — advertiser dashboard with campaign visible.

---

## Self-Review

**Spec coverage:**
- ✅ Schema/RLS: Task 1
- ✅ AuthContext activeRole + toggleRole + canToggleToOperator: Task 2
- ✅ App.jsx reads activeRole: Task 3
- ✅ GlobalHeader dropdown toggle: Task 4
- ✅ Screen registration promotes role: Task 5
- ✅ Demo button on LoginPage: Task 6
- ✅ Demo Supabase account creation: Task 7

**Placeholder scan:** None found. All code blocks complete.

**Type consistency:** `activeRole` string used consistently across Tasks 2–4. `toggleRole(targetRole)` signature matches call sites in Tasks 3 and 4. `canToggleToOperator` boolean used consistently.
