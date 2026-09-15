# Multi-Account Access (Agency / Org) — Design Spec
**Date:** 2026-06-21  
**Status:** Approved, ready for implementation

---

## Problem

AdGrid currently supports one profile per auth user. Advertising agencies managing multiple client accounts — and organizations delegating access to staff — have no way to switch between accounts, assign team members, or operate on behalf of clients without sharing credentials.

---

## Goals

- Agency users can access multiple client AdGrid accounts from one login
- Clients grant access to agencies/orgs; agencies never control that grant
- Team members within an org get per-client role assignments
- Role enforcement is consistent in UI and at the DB (RLS) layer
- Invite flow works via email + social login (Google/GitHub)

---

## Out of Scope

- Enterprise SAML 2.0 SSO (Okta, Azure AD)
- Audit log of agency actions inside client accounts
- Client-visible activity log of agency actions
- Per-screen access restrictions within a client account
- Agency billing consolidation / cross-client invoicing
- Operator-side multi-network support

---

## Data Model

### New table: `account_grants`

Client grants an org (or individual user) access to their account.

```sql
CREATE TABLE account_grants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,  -- client's profile
  grantee_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,  -- org or individual
  role            text NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'manager', 'viewer')),
  granted_by      uuid REFERENCES profiles(id),
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'revoked')),
  created_at      timestamptz DEFAULT now(),
  UNIQUE(account_id, grantee_id)
);
```

### New table: `team_member_client_roles`

Per-client role overrides for org team members. The org admin's role on a client comes from `account_grants`; other members need explicit assignment here.

```sql
CREATE TABLE team_member_client_roles (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id      uuid NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  client_account_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role                text NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'manager', 'viewer')),
  UNIQUE(team_member_id, client_account_id)
);
```

### Modified: `bookings`

```sql
ALTER TABLE bookings ADD COLUMN billed_to_profile_id uuid REFERENCES profiles(id);
-- NULL = default (account owner pays). Set when agency chooses to bill their own account.
```

### Effective-role resolution (ordered)

1. User is the account owner → full access.
2. User's org has no active `account_grants` row for this account → deny.
3. User is org Admin → inherits org's grant role.
4. Otherwise → look up `team_member_client_roles` for explicit assignment. Effective role = lower of (org grant role, assigned role).

---

## Roles Capability Matrix

| Action | Admin | Manager | Viewer |
|--------|:-----:|:-------:|:------:|
| View campaigns / analytics / screens | ✓ | ✓ | ✓ |
| Create / edit campaigns | ✓ | ✓ | — |
| Choose billing party (agency vs client) | ✓ | ✓ | — |
| Assign team members to clients | ✓ | — | — |
| Revoke org's own access to a client | ✓ | — | — |

---

## UX Flows

### Flow 1 — Client grants agency access
1. Client opens **Settings → Access tab**
2. Clicks **"Grant Access"** → enters agency's email or org name + picks role
3. `account_grants` row created with `status = 'pending'`
4. Email invite sent to grantee with accept/decline link
5. In-app notification also created
6. Grantee clicks link → routed to `/app/accept-grant?grant=<grant_uuid>` (grant UUID is unguessable; no separate token needed)
7. If not logged in: prompted to sign in (email/password or Google/GitHub via existing `signInWithOAuth`)
8. On accept: `status → active`; client account appears in grantee's Account Hub

### Flow 2 — Agency user logs in
- **No grants**: straight to normal dashboard (no change to existing flow)
- **Has grants + no `activeAccount` in sessionStorage**: redirect to `/app/accounts` (Account Hub)
- **Has grants + `activeAccount` stored**: restore context, go to last visited route

### Flow 3 — Account Hub (`/app/accounts`)
- Card grid: own account + each active grant
- Each card shows: name, logo, role badge, last accessed timestamp
- Click card → `setActiveAccount(...)` → enter that account's full dashboard

### Flow 4 — In-app account switcher
- AccountSwitcher component in GlobalHeader
- Shows current active account name + role badge
- Dropdown lists all accessible accounts; "My Account" always at top
- Select → app reloads in context of new account; sessionStorage updated

### Flow 5 — Org admin assigns team member to client
1. Admin opens **Settings → Team** (within own org account)
2. Clicks team member → "Client Access" panel opens
3. Lists all clients the org has active grants for
4. Toggle per-client access on/off; set per-client role (capped at org grant role)
5. Saves → `team_member_client_roles` rows created/updated

### Flow 6 — Billing party selection
- Applies when acting inside a client account as Admin or Manager
- Campaign creation form shows: **"Bill to:"**
  - ○ Client account (client's payment method / credits)
  - ○ Agency account (agency's payment method)
- Selection stored as `billed_to_profile_id` on the booking

---

## Frontend Architecture

### `src/context/AuthContext.jsx` additions

```js
// New state
activeAccount   // { id, name, role, isOwn: bool } | null
grants          // AccountGrant[] — active grants for this user's org

// New actions
setActiveAccount(account)   // switch context, persisted in sessionStorage
acceptGrant(grantId)        // status → active
revokeGrant(grantId)        // org revokes own access to client
```

All Supabase queries in `App.jsx` switch from `user.id` → `activeAccount.id` when acting in a client account.

### New files

| File | Purpose |
|------|---------|
| `src/views/accounts/AccountHub.jsx` | `/app/accounts` landing — card grid |
| `src/views/accounts/AcceptGrantView.jsx` | `/app/accept-grant` — invite accept/decline |
| `src/views/accounts/GrantAccessModal.jsx` | Client sends invite from Settings |
| `src/views/accounts/AccessSettingsView.jsx` | Client manages who has access |
| `src/views/accounts/TeamClientRoles.jsx` | Org admin assigns team members per client |
| `src/components/layout/AccountSwitcher.jsx` | Header dropdown |

### Modified files

| File | Change |
|------|--------|
| `AuthContext.jsx` | + `activeAccount`, `grants`, `setActiveAccount`, `acceptGrant`, `revokeGrant` |
| `App.jsx` | Route to AccountHub if multi-account; queries use `activeAccount.id`; add `/app/accounts` + `/app/accept-grant` routes |
| `GlobalHeader.jsx` | + `AccountSwitcher` |
| `advertiser/CreateCampaign.jsx` | + billing party selector (manager+ only, when in client account) |
| `advertiser/SettingsView.jsx` | + Access tab (grant access, view/revoke existing grants) |
| `operator/OperatorSettingsView.jsx` | + Team → client role assignments |

### Post-login routing

```
grants.length === 0
  → normal flow (unchanged)

grants.length > 0 AND no activeAccount in sessionStorage
  → navigate('/app/accounts')

grants.length > 0 AND activeAccount in sessionStorage
  → restore context, go to last route
```

### RLS strategy

New policies on `bookings`, `screens`, `scans` check two access paths:

**Path A — direct grant** (individual user directly in `account_grants`):
```sql
EXISTS (
  SELECT 1 FROM account_grants
  WHERE account_id = <row_owner_id>
    AND grantee_id = auth.uid()
    AND status = 'active'
)
```

**Path B — org member grant** (user is member of an org that has a grant):
```sql
EXISTS (
  SELECT 1 FROM account_grants ag
  JOIN team_members tm ON tm.org_profile_id = ag.grantee_id
  LEFT JOIN team_member_client_roles tmcr
    ON tmcr.team_member_id = tm.id AND tmcr.client_account_id = ag.account_id
  WHERE ag.account_id = <row_owner_id>
    AND ag.status = 'active'
    AND tm.user_profile_id = auth.uid()
    AND (tm.role = 'admin' OR tmcr.id IS NOT NULL)
)
```

Mutation policies (INSERT/UPDATE) additionally filter for `role IN ('admin', 'manager')` in the matched grant or client role row.

---

## Migration & Rollout

- New tables start empty — zero impact on existing users
- Existing operator impersonation (`impersonating` state in App.jsx) stays untouched — separate feature
- `billed_to_profile_id` is nullable — no backfill needed
- Feature is additive; no existing routes or data structures removed

---

## Open Questions (resolved)

| Question | Decision |
|----------|----------|
| Who creates managed accounts? | Client stays independent; client grants access |
| Billing when agency acts for client? | Agency admin/manager chooses per campaign |
| Role model | Per-client roles set by org admin |
| SSO | Social login (Google/GitHub) via existing `signInWithOAuth`, wired to invite accept flow |
| Email invites | In scope — sent when grant created, link to `/app/accept-grant` |
