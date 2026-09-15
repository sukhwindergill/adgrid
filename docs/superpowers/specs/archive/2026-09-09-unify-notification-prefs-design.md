# Unify notification preference UIs

## Problem

Two separate, live UIs both write to `profiles.notification_prefs`, with incompatible shapes:

1. `src/views/shared/NotificationPrefsView.jsx` — reached via the sidebar's "Notification Prefs" link (`active === 'notif-prefs'` in `src/App.jsx`, linked from `src/components/layout/Sidebar.jsx`). Covers 6 events. Writes a nested per-channel shape: `{ [eventType]: { inApp: boolean, email: boolean } }`.
2. The "Notifications" tab inside each role's Settings page — `OperatorSettingsView.jsx`'s `NotificationsTab` and `advertiser/SettingsView.jsx`'s `NotificationsTab`. Each covers 14 events (matching `send-notification`'s TEMPLATES map), one flat toggle per event. Writes `{ [eventType]: boolean }`.

Both are reachable, both persist to the same column — whichever a user saves in last wins, silently discarding the other's shape. `resolveChannelPrefs()` in `supabase/functions/_shared/notificationPrefs.ts` already reads either shape correctly (fixed in PR #220), so nothing is silently broken today, but the duplication is confusing: two pages control the same setting, and per-channel granularity set on one page can be clobbered by a save on the other.

## Decision

Keep the Settings-tab `NotificationsTab` as the single canonical surface (14 events, matches TEMPLATES). Extend it with per-channel (in-app / email) toggles — `NotificationPrefsView.jsx`'s only real advantage — then delete `NotificationPrefsView.jsx` and its sidebar entry, redirecting the old route to the appropriate role's Settings > Notifications tab.

## Changes

### 1. Shared pure helper — `src/lib/notificationPrefs.js`

New module, no React, no Supabase — the events list and the shape-normalization logic factored out so both role's `NotificationsTab` share one source of truth instead of two copy-pasted 14-item arrays.

- `EVENTS`: the 14 `{ key, label, desc, operatorOnly? }` entries currently hardcoded in both `NotificationsTab`s (union of both lists — advertiser's list already is the superset, operator-only ones flagged so advertiser view can filter them out, matching current per-role visible sets).
- `defaultChannelPrefs()` → `{ [key]: { inApp: true, email: true } }` for all `EVENTS`.
- `normalizeChannelPrefs(raw)` → given whatever is currently stored (`undefined`, legacy flat `{key: boolean}`, or the new nested `{key: {inApp, email}}`, or a mix — a row could have some keys migrated and others not), returns a fully-populated nested object: any event missing from `raw` gets `defaultChannelPrefs()`'s entry; any event stored as a plain boolean `b` is upgraded to `{inApp: b, email: b}`; any event already nested is passed through with `inApp`/`email` coerced to boolean (default true if missing on that event, mirroring `resolveChannelPrefs`'s `!== false` semantics).

This module is the only place the 14-event list and the shape-upgrade rule live; both `NotificationsTab`s import from it instead of hardcoding.

### 2. `NotificationsTab` (operator + advertiser) — per-channel toggles

Both components change identically:

- Replace the single `Toggle` per row with two — In-app / Email — using a small local two-column header row (same visual pattern `NotificationPrefsView.jsx` used: `1fr 80px 80px` grid).
- State initializes via `normalizeChannelPrefs(profile?.notification_prefs)` instead of the current hand-rolled flat-boolean default object.
- `toggle(key, channel)` flips `prefs[key][channel]`.
- `save()` unchanged in shape of call — still `supabase.from('profiles').update({ notification_prefs: prefs })` — just `prefs` is now the nested shape.
- Item list comes from the shared `EVENTS` (operator's tab uses the full list; advertiser's tab filters out any `operatorOnly` entries, matching what advertiser's list already excludes — cross-check during implementation that no event is dropped that advertiser's current 14-item list has).
- Operator's `useEffect` syncing `prefs` when `profile.notification_prefs` changes stays, just runs prefs through `normalizeChannelPrefs`.

### 3. Add `initialTab` prop to both Settings views

- `advertiser/SettingsView.jsx`: `export default function SettingsView({ initialTab } = {})`, `useState(initialTab ?? "profile")`.
- `operator/OperatorSettingsView.jsx`: `export function OperatorSettingsView({ setNav, initialTab } = {})`, `useState(initialTab ?? 'profile')`.

### 4. Delete `NotificationPrefsView.jsx`; redirect the route

- Delete `src/views/shared/NotificationPrefsView.jsx`.
- `src/App.jsx`: remove its import; both branches that rendered it now render the role's Settings view with `initialTab="notifications"` instead:
  - line 545 (advertiser): `<SettingsView initialTab="notifications" />`
  - line 583 (operator): `<OperatorSettingsView setNav={navTo} initialTab="notifications" />`
- `src/components/layout/Sidebar.jsx`: remove the "Notification Prefs" `NavItem` block (lines ~388–395). Users reach notifications through each role's existing "Settings" nav entry now.

### 5. `notificationPrefs.ts` comment update

`resolveChannelPrefs()` itself is unchanged — it must still accept both shapes, since existing rows on disk may carry the pre-migration flat-boolean shape and nothing back-fills the DB. Update its header comment: the flat-boolean shape is no longer written by any live UI (both writers now save the nested shape), so the legacy branch exists solely for rows saved before this change, not as an active second writer.

## Testing

- `src/lib/notificationPrefs.test.js` (or colocated per repo convention — check existing `*.test.js` placement): unit tests for `normalizeChannelPrefs` — undefined input, legacy all-flat-boolean input, already-nested input, mixed input, missing-event input — and `defaultChannelPrefs`.
- Render tests for both `NotificationsTab`s: renders two toggles per event, toggling one channel doesn't affect the other, save posts the nested shape, loads and upgrades a legacy flat-boolean `profile.notification_prefs` correctly.
- Remove/update any existing test that imports or exercises `NotificationPrefsView.jsx`.
- Manual check: navigating to the old `notif-prefs` nav target (now absent from the sidebar) isn't reachable by click; verify no other code references `active === 'notif-prefs'` or imports the deleted file (`grep -r NotificationPrefsView`, `grep -rn "notif-prefs"`).

## Out of scope

- Migrating existing DB rows to the nested shape (both write paths now converge on it going forward; `resolveChannelPrefs` keeps reading old rows correctly).
- Changing which events exist or what `send-notification` sends.
