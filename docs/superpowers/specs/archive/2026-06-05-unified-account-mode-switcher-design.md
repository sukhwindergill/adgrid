# Unified Account with Mode Switcher

**Date:** 2026-06-05  
**Status:** Approved

## Problem

Users with screens who also want to advertise need two separate accounts today. `profiles.role` is a single string set at signup — mutually exclusive. This is unnecessary friction; screen owners and advertisers are the same kind of user.

## Decision

One login, two modes. Every account gets both **Operator** and **Advertiser** modes. A pill toggle at the top of the sidebar switches between them. No role choice at signup.

## Design

### Database

Add one column to `profiles`:

```sql
alter table profiles add column active_mode text check (active_mode in ('operator', 'advertiser'));
```

The existing `role` column is deprecated — ignored for routing, kept for any legacy reads. New code reads `active_mode` only.

### Auth Context

`AuthContext` exposes:
- `activeMode` — `'operator'` | `'advertiser'`
- `setActiveMode(mode)` — updates local state + persists to `profiles.active_mode`

Smart default on login (evaluated once, then `active_mode` in DB takes over):
1. `profile.active_mode` is set → use it
2. User has ≥1 row in `screens` table → `'operator'`
3. Otherwise → `'advertiser'`

### Signup

Remove the role picker from `LoginPage`. Signup collects name, email, password only. No `role` written to `user_metadata` or `profiles` on new signups.

### Sidebar

Pill toggle placed below the logo, above the primary nav:

```
┌─────────────────────┐
│ A  ADGRID           │
├─────────────────────┤
│ [Operator][Advertise]│  ← pill toggle
├─────────────────────┤
│ ⊞  Dashboard        │
│ 📋 Campaigns        │
│ ...                 │
```

- Active segment: purple gradient fill + border
- Inactive segment: muted text, no background
- Tapping swaps nav instantly, calls `setActiveMode`
- Collapsed sidebar: pill becomes two small icon-only segments (or hides label, shows icon)

### App.jsx / Routing

Replace all `role === 'advertiser'` and `isAdv` checks with `activeMode === 'advertiser'`. No view code changes — nav items and views are identical to today, just driven by `activeMode`.

Impersonation: operator impersonating advertiser forces `activeMode = 'advertiser'` for the session duration, does not persist to DB.

### What Doesn't Change

- All existing views, nav items, route IDs — unchanged
- Impersonation audit log — unchanged
- Operator-only features (Approval Queue, Screens, Revenue, Advertisers list) — still only visible in Operator mode
- Advertiser-only features (Create Campaign, Scans, Adv Billing) — still only visible in Advertiser mode
- Stripe Connect, billing flows — still mode-specific

## Out of Scope

- Merging or unifying the views themselves (e.g. shared analytics page)
- Any permissions / RLS changes — modes are UI-only, existing RLS policies unchanged
- Onboarding wizards per mode (future sprint)
