# Dual-Role Toggle & Demo Credentials

**Date:** 2026-05-14  
**Status:** Approved

## Problem

E2E testing and investor demos require switching between operator and advertiser views without re-authentication. Currently role is fixed at signup.

## Goals

- Single account can view both operator and advertiser dashboards
- Operator toggle gated on screen ownership
- One-click demo login for investor and QA use

## Schema & RLS

No new columns. `role` stays `text` in `profiles`.

**Role promotion:** When a user registers their first screen, their `role` is upserted to `'operator'`. This grants DB-level operator access via existing RLS policies.

**Advertiser RLS update:** Policies on `bookings`, `scans`, and other advertiser tables updated from `role = 'advertiser'` to `role IN ('advertiser', 'operator')` so operators can create and view campaigns.

No migration needed for existing accounts.

## Auth Context

`AuthContext` gains three additions:

| Addition | Type | Description |
|---|---|---|
| `activeRole` | `string` state | Defaults to `profile.role` on login. Session-only — never written to DB. |
| `canToggleToOperator` | `boolean` derived | `true` when `profile.role === 'operator'` |
| `toggleRole(role)` | function | Sets `activeRole`, triggers re-route to default view for that role |

All route guards and AppShell rendering switch from reading `profile.role` to `activeRole`. RLS continues to use DB `role` — correct data loads for both views since operator accounts have `role='operator'` in DB.

## UI — Role Dropdown

`GlobalHeader` avatar/profile button opens a dropdown. Dropdown only renders the switch option when `canToggleToOperator`.

**Dropdown items:**
1. "Switch to Operator" or "Switch to Advertiser" (contextual — shows the opposite of `activeRole`)
2. Divider
3. "Sign out"

On role switch: `activeRole` flips, app navigates to default route for that role (`/dashboard` for operator, `/advertiser` for advertiser).

Styling matches existing toggle pill pattern (purple highlight, same font/border radius as `RolePromptModal`).

## Demo Credentials

**Login page** gets a "Demo" button below the email/password divider. Single button — pre-fills and auto-submits `demo@adgrid.io` / `demo1234`.

**Demo account spec (created once in Supabase):**
- Email: `demo@adgrid.io`
- Role: `operator`
- 1+ screens with lat/lng set and status `live`
- 2+ bookings with status `scheduled`
- 50+ rows in `impression_events`
- Stripe test customer attached

**Env vars:**
```
VITE_DEMO_EMAIL=demo@adgrid.io
VITE_DEMO_PASSWORD=demo1234
```

Demo button reads from env vars so credentials can be rotated without code changes.

## Out of Scope

- Persisting `activeRole` across sessions
- Role-specific notification preferences per active role
- Restricting operator RLS further based on screen ownership
