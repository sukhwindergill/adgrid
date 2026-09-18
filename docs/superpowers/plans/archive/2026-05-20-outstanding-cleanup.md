# Outstanding Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the 3 remaining code gaps: impersonation_logs DB table, token source unification, and DB migration push.

**Architecture:** (1) New migration creates `impersonation_logs` table that App.jsx already writes to. (2) `lib/constants.js` re-exports `C`/`F` from `design/tokens.js` — unifies design tokens without touching any importer. (3) `npx supabase db push` applies both pending migrations to prod.

**Tech Stack:** Supabase migrations (SQL), React (JS), Vite

---

## Audit: Already Resolved (do NOT re-do)

Memory was stale. These gaps are already closed in current code:
- ✅ Stripe billing edge function already returns `portalUrl`
- ✅ Demo credentials not present in LoginPage.jsx
- ✅ Stripe Connect state token already validated (App.jsx:178-183)
- ✅ Global loadError UI already rendered with Retry button (App.jsx:395-410)

---

## Task 1: impersonation_logs migration

**Files:**
- Create: `supabase/migrations/20260520000001_impersonation_logs.sql`

- [ ] **Step 1: Write migration**

```sql
-- supabase/migrations/20260520000001_impersonation_logs.sql
create table if not exists impersonation_logs (
  id           uuid primary key default gen_random_uuid(),
  operator_id  uuid not null references profiles(id) on delete cascade,
  advertiser_id uuid not null references profiles(id) on delete cascade,
  started_at   timestamptz not null default now(),
  ended_at     timestamptz
);

comment on table impersonation_logs is
  'Records when an operator impersonates an advertiser account. App.jsx writes start/end.';

alter table impersonation_logs enable row level security;

create policy "Operators can view own logs"
  on impersonation_logs for select
  using (operator_id = auth.uid());

create policy "Service role full access"
  on impersonation_logs for all
  using (true)
  with check (true);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260520000001_impersonation_logs.sql
git commit -m "feat: add impersonation_logs migration"
```

---

## Task 2: Unify token source

App.jsx and 10 other files import `C`/`F` from `lib/constants.js`. All newer files use `design/tokens.js`. The two files have different color values. Goal: make `lib/constants.js` re-export from `design/tokens.js` so all files use one source of truth.

Four keys exist in `lib/constants.js` but not in `design/tokens.js`: `blueLight`, `greenLight`, `purpleLight`, `redLight` (they are aliases for `blueSoft`, `greenSoft`, `purpleSoft`, `redSoft`).

**Files:**
- Modify: `src/design/tokens.js`
- Modify: `src/lib/constants.js`

- [ ] **Step 1: Add missing alias keys to `design/tokens.js`**

Add to the `C` export object (after existing color pairs):

```js
export const C = {
  bg: '#fafafa',
  surface: '#ffffff',
  surfaceAlt: '#f5f5f5',
  border: '#e5e5e5',
  borderDark: '#d4d4d4',

  text: '#0a0a0a',
  textMid: '#262626',
  textSub: '#525252',
  textMuted: '#737373',

  purple: '#7c3aed',
  purpleDark: '#6d28d9',
  purpleSoft: '#f5f3ff',
  purpleBorder: '#ddd6fe',
  purpleLight: '#f5f3ff',

  green: '#10b981', greenSoft: '#ecfdf5', greenBorder: '#a7f3d0', greenLight: '#ecfdf5',
  amber: '#f59e0b', amberSoft: '#fffbeb', amberBorder: '#fde68a',
  red:   '#ef4444', redSoft:   '#fef2f2', redBorder:   '#fecaca', redLight: '#fef2f2',
  blue:  '#3b82f6', blueSoft:  '#eff6ff', blueBorder:  '#bfdbfe', blueLight: '#eff6ff',
};
```

- [ ] **Step 2: Replace `lib/constants.js` to re-export from `design/tokens.js`**

```js
export { C, F } from '../design/tokens.js';

export const SUPABASE_FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
  : "";
```

- [ ] **Step 3: Start dev server and verify no visual regressions**

```bash
npm run dev
```

Open http://localhost:5173 — check login page, operator dashboard, advertiser billing view, screens view. Ensure no white boxes or missing colors.

- [ ] **Step 4: Commit**

```bash
git add src/design/tokens.js src/lib/constants.js
git commit -m "refactor: unify token source — lib/constants re-exports design/tokens"
```

---

## Task 3: Push DB migrations

> **Warning:** This pushes to production Supabase. Applies two migrations:
> - `20260520000000_add_notification_prefs.sql` — adds `profiles.notification_prefs JSONB`
> - `20260520000001_impersonation_logs.sql` — creates `impersonation_logs` table
>
> Both are additive (no drops, no data loss). Safe to run.
>
> **Requires user confirmation before running.**

- [ ] **Step 1: Confirm with user, then push**

```bash
npx supabase db push
```

Expected output: two migrations applied successfully.

- [ ] **Step 2: Verify NotificationPrefsView works in production**

After push, open the deployed app → Notification Preferences → confirm toggles save without 500 errors.
