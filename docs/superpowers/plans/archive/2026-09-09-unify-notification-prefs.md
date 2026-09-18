# Unify Notification Preference UIs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the two competing notification-preference UIs into one — the Settings-tab `NotificationsTab`, extended with per-channel (in-app/email) toggles — and delete the redundant `NotificationPrefsView.jsx` and its sidebar entry.

**Architecture:** A new pure helper module (`src/lib/notificationPrefs.js`) owns the canonical 14-event list and the shape-normalization logic (upgrading legacy flat-boolean prefs to the nested `{inApp, email}` shape). Both role's `NotificationsTab` components import from it and render two toggles per event instead of one. `App.jsx`'s `notif-prefs` route and `Sidebar.jsx`'s nav entry are removed in favor of routing straight to each role's Settings view with a new `initialTab` prop.

**Tech Stack:** React (function components, hooks), Vitest + @testing-library/react for tests, Supabase JS client (mocked in tests via `vi.mock('../../lib/supabase.js', ...)`).

**Spec:** `docs/superpowers/specs/2026-09-09-unify-notification-prefs-design.md`

## Global Constraints

- `resolveChannelPrefs()` in `supabase/functions/_shared/notificationPrefs.ts` must keep accepting both the legacy flat-boolean shape and the nested shape — do not narrow it, only update its comment.
- No DB migration/backfill — existing rows keep whatever shape they have; normalization happens client-side on read.
- Do not drop any of advertiser's current 14 events or operator's current 14 events from what each role sees.
- Test files are colocated (`Foo.jsx` + `Foo.test.jsx` / `foo.js` + `foo.test.js`), using Vitest (`describe`/`it`/`expect`/`vi`) and `@testing-library/react` (`render`/`screen`/`fireEvent`/`waitFor`), matching the mocking style in `src/views/advertiser/SettingsView.test.jsx`.

---

### Task 1: Shared pure helper — `src/lib/notificationPrefs.js`

**Files:**
- Create: `src/lib/notificationPrefs.js`
- Test: `src/lib/notificationPrefs.test.js`

**Interfaces:**
- Produces:
  - `EVENTS: Array<{ key: string, label: string, desc: string, operatorOnly: boolean }>` — 14 entries.
  - `defaultChannelPrefs(): Record<string, { inApp: boolean, email: boolean }>`
  - `normalizeChannelPrefs(raw: unknown): Record<string, { inApp: boolean, email: boolean }>`

The 14 events (union of the operator and advertiser lists currently hardcoded in `OperatorSettingsView.jsx` `NotificationsTab` and `advertiser/SettingsView.jsx` `NotificationsTab`), each existing `desc` string preserved verbatim, `operatorOnly: true` on the two the advertiser copy currently labels "(operators only)":

```js
export const EVENTS = [
  { key: 'campaign_approved',  label: 'Campaign approved',         desc: 'When your campaign is approved by the operator', operatorOnly: false },
  { key: 'campaign_live',      label: 'Campaign live',             desc: 'When your campaign goes live on a screen', operatorOnly: false },
  { key: 'campaign_paused',    label: 'Campaign paused',           desc: 'When your campaign is paused due to low budget', operatorOnly: false },
  { key: 'low_budget',         label: 'Low budget alert',          desc: 'When a campaign has less than 20% of its run remaining', operatorOnly: false },
  { key: 'campaign_ended',     label: 'Campaign ended',            desc: 'When a campaign completes its scheduled run', operatorOnly: false },
  { key: 'scan_milestone',     label: 'Scan milestones',           desc: 'When a campaign hits 100, 500, 1k, or 5k QR scans', operatorOnly: false },
  { key: 'weekly_report',      label: 'Weekly performance report', desc: 'Summary of scans, spend, and active campaigns every Monday', operatorOnly: false },
  { key: 'payment_failed',     label: 'Payment failed',            desc: 'When a payment for your account fails', operatorOnly: false },
  { key: 'new_advertiser',     label: 'New advertiser joined',     desc: 'When a new advertiser signs up', operatorOnly: true },
  { key: 'campaign_submitted', label: 'Campaign submitted',        desc: 'When an advertiser submits a campaign for approval', operatorOnly: true },
  { key: 'payout_completed',   label: 'Payout completed',          desc: 'When a payout is transferred to your bank', operatorOnly: true },
  { key: 'weekly_revenue',     label: 'Weekly revenue summary',    desc: 'Weekly revenue across your screen network', operatorOnly: true },
  { key: 'team_member_joined', label: 'Team member joined',        desc: 'When someone accepts your team invite', operatorOnly: false },
  { key: 'account_suspended',  label: 'Account suspended',         desc: 'If your account is suspended', operatorOnly: false },
];
```

- [ ] **Step 1: Write the failing tests**

```js
// src/lib/notificationPrefs.test.js
import { describe, it, expect } from 'vitest';
import { EVENTS, defaultChannelPrefs, normalizeChannelPrefs } from './notificationPrefs.js';

describe('EVENTS', () => {
  it('has 14 events with unique keys', () => {
    expect(EVENTS).toHaveLength(14);
    expect(new Set(EVENTS.map(e => e.key)).size).toBe(14);
  });
});

describe('defaultChannelPrefs', () => {
  it('defaults every event to both channels enabled', () => {
    const prefs = defaultChannelPrefs();
    expect(Object.keys(prefs)).toHaveLength(14);
    for (const event of EVENTS) {
      expect(prefs[event.key]).toEqual({ inApp: true, email: true });
    }
  });
});

describe('normalizeChannelPrefs', () => {
  it('returns full defaults for undefined input', () => {
    const prefs = normalizeChannelPrefs(undefined);
    expect(prefs).toEqual(defaultChannelPrefs());
  });

  it('returns full defaults for null input', () => {
    expect(normalizeChannelPrefs(null)).toEqual(defaultChannelPrefs());
  });

  it('upgrades a legacy flat-boolean shape to the nested shape', () => {
    const raw = Object.fromEntries(EVENTS.map(e => [e.key, false]));
    const prefs = normalizeChannelPrefs(raw);
    for (const event of EVENTS) {
      expect(prefs[event.key]).toEqual({ inApp: false, email: false });
    }
  });

  it('upgrades a legacy true flat-boolean to both channels enabled', () => {
    const raw = { campaign_approved: true };
    const prefs = normalizeChannelPrefs(raw);
    expect(prefs.campaign_approved).toEqual({ inApp: true, email: true });
  });

  it('passes through an already-nested entry, coercing missing channels to true', () => {
    const raw = { campaign_approved: { inApp: false } };
    const prefs = normalizeChannelPrefs(raw);
    expect(prefs.campaign_approved).toEqual({ inApp: false, email: true });
  });

  it('fills in defaults for events missing from raw entirely', () => {
    const raw = { campaign_approved: { inApp: false, email: false } };
    const prefs = normalizeChannelPrefs(raw);
    expect(prefs.campaign_approved).toEqual({ inApp: false, email: false });
    expect(prefs.scan_milestone).toEqual({ inApp: true, email: true });
  });

  it('handles a mix of legacy-boolean and nested entries in one object', () => {
    const raw = { campaign_approved: false, scan_milestone: { inApp: true, email: false } };
    const prefs = normalizeChannelPrefs(raw);
    expect(prefs.campaign_approved).toEqual({ inApp: false, email: false });
    expect(prefs.scan_milestone).toEqual({ inApp: true, email: false });
    expect(prefs.payout_completed).toEqual({ inApp: true, email: true });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/notificationPrefs.test.js`
Expected: FAIL — `notificationPrefs.js` does not exist yet.

- [ ] **Step 3: Write the implementation**

```js
// src/lib/notificationPrefs.js
//
// Canonical list of notification events and the shared shape-normalization
// logic for `profiles.notification_prefs`. Both role's Settings >
// Notifications tabs import from here instead of hardcoding their own copy
// of this list, and both now write and read the nested per-channel shape
// (see supabase/functions/_shared/notificationPrefs.ts for the enforcement
// side, which still also accepts the legacy flat-boolean shape for rows
// saved before this module existed).

export const EVENTS = [
  { key: 'campaign_approved',  label: 'Campaign approved',         desc: 'When your campaign is approved by the operator', operatorOnly: false },
  { key: 'campaign_live',      label: 'Campaign live',             desc: 'When your campaign goes live on a screen', operatorOnly: false },
  { key: 'campaign_paused',    label: 'Campaign paused',           desc: 'When your campaign is paused due to low budget', operatorOnly: false },
  { key: 'low_budget',         label: 'Low budget alert',          desc: 'When a campaign has less than 20% of its run remaining', operatorOnly: false },
  { key: 'campaign_ended',     label: 'Campaign ended',            desc: 'When a campaign completes its scheduled run', operatorOnly: false },
  { key: 'scan_milestone',     label: 'Scan milestones',           desc: 'When a campaign hits 100, 500, 1k, or 5k QR scans', operatorOnly: false },
  { key: 'weekly_report',      label: 'Weekly performance report', desc: 'Summary of scans, spend, and active campaigns every Monday', operatorOnly: false },
  { key: 'payment_failed',     label: 'Payment failed',            desc: 'When a payment for your account fails', operatorOnly: false },
  { key: 'new_advertiser',     label: 'New advertiser joined',     desc: 'When a new advertiser signs up', operatorOnly: true },
  { key: 'campaign_submitted', label: 'Campaign submitted',        desc: 'When an advertiser submits a campaign for approval', operatorOnly: true },
  { key: 'payout_completed',   label: 'Payout completed',          desc: 'When a payout is transferred to your bank', operatorOnly: true },
  { key: 'weekly_revenue',     label: 'Weekly revenue summary',    desc: 'Weekly revenue across your screen network', operatorOnly: true },
  { key: 'team_member_joined', label: 'Team member joined',        desc: 'When someone accepts your team invite', operatorOnly: false },
  { key: 'account_suspended',  label: 'Account suspended',         desc: 'If your account is suspended', operatorOnly: false },
];

export function defaultChannelPrefs() {
  return Object.fromEntries(EVENTS.map(e => [e.key, { inApp: true, email: true }]));
}

export function normalizeChannelPrefs(raw) {
  const defaults = defaultChannelPrefs();
  if (typeof raw !== 'object' || raw === null) return defaults;

  const result = {};
  for (const event of EVENTS) {
    const stored = raw[event.key];
    if (typeof stored === 'object' && stored !== null) {
      result[event.key] = {
        inApp: stored.inApp !== false,
        email: stored.email !== false,
      };
    } else if (typeof stored === 'boolean') {
      result[event.key] = { inApp: stored, email: stored };
    } else {
      result[event.key] = defaults[event.key];
    }
  }
  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/notificationPrefs.test.js`
Expected: PASS, all 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/notificationPrefs.js src/lib/notificationPrefs.test.js
git commit -m "Add shared notification-prefs event list and shape normalizer

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Per-channel toggles in operator `NotificationsTab`

**Files:**
- Modify: `src/views/operator/OperatorSettingsView.jsx:385-440` (the `NotificationsTab` function)
- Test: `src/views/operator/OperatorSettingsView.notificationsTab.test.jsx`

**Interfaces:**
- Consumes: `EVENTS`, `normalizeChannelPrefs` from `../../lib/notificationPrefs.js` (Task 1).
- Produces: `export function NotificationsTab({ profile })` — same export name, now rendering two toggles per event and saving the nested shape. Other tasks (Task 4) render `<NotificationsTab profile={profile} />` unchanged.

First, read the current `Toggle` component definition used elsewhere in this file (it's already defined and used by `NotificationsTab` — keep using it, just called twice per row now).

- [ ] **Step 1: Write the failing test**

```jsx
// src/views/operator/OperatorSettingsView.notificationsTab.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationsTab } from './OperatorSettingsView.jsx';

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
    })),
  },
}));

import { supabase } from '../../lib/supabase.js';

describe('OperatorSettingsView NotificationsTab', () => {
  beforeEach(() => {
    supabase.from.mockClear();
  });

  it('renders an in-app and an email toggle for each of the 14 events', () => {
    render(<NotificationsTab profile={{ id: 'op-1' }} />);
    expect(screen.getAllByRole('switch')).toHaveLength(28);
  });

  it('upgrades a legacy flat-boolean profile.notification_prefs on load', () => {
    render(<NotificationsTab profile={{ id: 'op-1', notification_prefs: { campaign_approved: false } }} />);
    const switches = screen.getAllByRole('switch');
    // First event (campaign_approved) row: in-app then email toggle.
    expect(switches[0]).toHaveAttribute('aria-checked', 'false');
    expect(switches[1]).toHaveAttribute('aria-checked', 'false');
  });

  it('toggling the email switch for an event does not affect its in-app switch', () => {
    render(<NotificationsTab profile={{ id: 'op-1' }} />);
    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[1]); // campaign_approved / email
    expect(switches[0]).toHaveAttribute('aria-checked', 'true');
    expect(switches[1]).toHaveAttribute('aria-checked', 'false');
  });

  it('saves the nested per-channel shape', async () => {
    const updateSpy = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }));
    supabase.from.mockReturnValue({ update: updateSpy });

    render(<NotificationsTab profile={{ id: 'op-1' }} />);
    fireEvent.click(screen.getAllByRole('switch')[1]); // turn off campaign_approved email
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    const savedPrefs = updateSpy.mock.calls[0][0].notification_prefs;
    expect(savedPrefs.campaign_approved).toEqual({ inApp: true, email: false });
    expect(Object.keys(savedPrefs)).toHaveLength(14);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/views/operator/OperatorSettingsView.notificationsTab.test.jsx`
Expected: FAIL — `NotificationsTab` is not exported yet (or still renders one switch per row).

- [ ] **Step 3: Implement**

Replace the current `NotificationsTab` function (lines 385-440) with:

```jsx
export function NotificationsTab({ profile }) {
  const [prefs, setPrefs] = useState(() => normalizeChannelPrefs(profile?.notification_prefs));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    setPrefs(normalizeChannelPrefs(profile?.notification_prefs));
  }, [profile?.notification_prefs]);

  async function save() {
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ notification_prefs: prefs }).eq('id', profile.id);
    setSaving(false);
    setMsg(error ? 'Error saving.' : 'Saved.');
    setTimeout(() => setMsg(null), 3000);
  }

  function toggle(key, channel) {
    setPrefs(p => ({ ...p, [key]: { ...p[key], [channel]: !p[key][channel] } }));
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px', padding: '0 0 8px', borderBottom: `1px solid ${C.border}` }}>
        <span />
        <span style={{ fontSize: 11, fontWeight: 600, color: C.textSub, textAlign: 'center' }}>In-app</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: C.textSub, textAlign: 'center' }}>Email</span>
      </div>
      {EVENTS.map(item => (
        <div key={item.key} style={{
          display: 'grid', gridTemplateColumns: '1fr 70px 70px', alignItems: 'center',
          padding: '16px 0', borderBottom: `1px solid ${C.border}`,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{item.label}</div>
            <div style={{ fontSize: 12, color: C.textSub, marginTop: 2 }}>{item.desc}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Toggle checked={prefs[item.key].inApp} onChange={() => toggle(item.key, 'inApp')} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Toggle checked={prefs[item.key].email} onChange={() => toggle(item.key, 'email')} />
          </div>
        </div>
      ))}
      <div style={{ marginTop: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
        <SaveBtn onClick={save} saving={saving} />
        {msg && <span style={{ fontSize: 13, color: msg === 'Saved.' ? C.green : C.red }}>{msg}</span>}
      </div>
    </div>
  );
}
```

Add the import near the top of `src/views/operator/OperatorSettingsView.jsx` (alongside the other imports):

```js
import { EVENTS, normalizeChannelPrefs } from '../../lib/notificationPrefs.js';
```

Operator sees the full 14-event list (including `operatorOnly` ones), so no filtering here.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/views/operator/OperatorSettingsView.notificationsTab.test.jsx`
Expected: PASS, all 4 tests.

- [ ] **Step 5: Run the full operator settings test file to check nothing else broke**

Run: `npx vitest run src/views/operator/OperatorSettingsView.test.jsx src/views/operator/OperatorSettingsView.rulesLink.test.jsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/views/operator/OperatorSettingsView.jsx src/views/operator/OperatorSettingsView.notificationsTab.test.jsx
git commit -m "Add per-channel toggles to operator NotificationsTab

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Per-channel toggles in advertiser `NotificationsTab`

**Files:**
- Modify: `src/views/advertiser/SettingsView.jsx:298-363` (the `NotificationsTab` function)
- Test: `src/views/advertiser/SettingsView.notificationsTab.test.jsx`

**Interfaces:**
- Consumes: `EVENTS`, `normalizeChannelPrefs` from `../../lib/notificationPrefs.js` (Task 1).
- Produces: `export function NotificationsTab({ profile })`, filtering out `operatorOnly` events — advertiser sees 12 of the 14. Other tasks (Task 4) render `<NotificationsTab profile={profile} />` unchanged.

- [ ] **Step 1: Write the failing test**

```jsx
// src/views/advertiser/SettingsView.notificationsTab.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationsTab } from './SettingsView.jsx';

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
    })),
  },
}));

import { supabase } from '../../lib/supabase.js';

describe('advertiser SettingsView NotificationsTab', () => {
  beforeEach(() => {
    supabase.from.mockClear();
  });

  it('renders an in-app and an email toggle for each non-operator-only event, excluding operator-only ones', () => {
    render(<NotificationsTab profile={{ id: 'adv-1' }} />);
    // 12 non-operatorOnly events out of 14.
    expect(screen.getAllByRole('switch')).toHaveLength(24);
    expect(screen.queryByText('New advertiser joined')).not.toBeInTheDocument();
    expect(screen.queryByText('Campaign submitted')).not.toBeInTheDocument();
  });

  it('upgrades a legacy flat-boolean profile.notification_prefs on load', () => {
    render(<NotificationsTab profile={{ id: 'adv-1', notification_prefs: { campaign_approved: false } }} />);
    const switches = screen.getAllByRole('switch');
    expect(switches[0]).toHaveAttribute('aria-checked', 'false');
    expect(switches[1]).toHaveAttribute('aria-checked', 'false');
  });

  it('toggling the in-app switch for an event does not affect its email switch', () => {
    render(<NotificationsTab profile={{ id: 'adv-1' }} />);
    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[0]); // campaign_approved / in-app
    expect(switches[0]).toHaveAttribute('aria-checked', 'false');
    expect(switches[1]).toHaveAttribute('aria-checked', 'true');
  });

  it('saves the nested per-channel shape', async () => {
    const updateSpy = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }));
    supabase.from.mockReturnValue({ update: updateSpy });

    render(<NotificationsTab profile={{ id: 'adv-1' }} />);
    fireEvent.click(screen.getAllByRole('switch')[0]); // turn off campaign_approved in-app
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    const savedPrefs = updateSpy.mock.calls[0][0].notification_prefs;
    expect(savedPrefs.campaign_approved).toEqual({ inApp: false, email: true });
    // Still saves all 14 (operator-only ones default, even though not shown).
    expect(Object.keys(savedPrefs)).toHaveLength(14);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/views/advertiser/SettingsView.notificationsTab.test.jsx`
Expected: FAIL — `NotificationsTab` is not exported yet (or still renders one switch per row / shows operator-only events).

- [ ] **Step 3: Implement**

Replace the current `NotificationsTab` function (lines 298-363) with:

```jsx
export function NotificationsTab({ profile }) {
  const [prefs, setPrefs] = useState(() => normalizeChannelPrefs(profile?.notification_prefs));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    setPrefs(normalizeChannelPrefs(profile?.notification_prefs));
  }, [profile?.notification_prefs]);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ notification_prefs: prefs })
      .eq("id", profile.id);
    setSaving(false);
    setMsg(error ? "Error saving." : "Saved.");
    setTimeout(() => setMsg(null), 3000);
  }

  function toggle(key, channel) {
    setPrefs(p => ({ ...p, [key]: { ...p[key], [channel]: !p[key][channel] } }));
  }

  const items = EVENTS.filter(e => !e.operatorOnly);

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 70px", padding: "0 0 8px", borderBottom: `1px solid ${C.border}` }}>
        <span />
        <span style={{ fontSize: 11, fontWeight: 600, color: C.textSub, textAlign: "center" }}>In-app</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: C.textSub, textAlign: "center" }}>Email</span>
      </div>
      {items.map((item) => (
        <div key={item.key} style={{
          display: "grid", gridTemplateColumns: "1fr 70px 70px", alignItems: "center",
          padding: "16px 0", borderBottom: `1px solid ${C.border}`,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{item.label}</div>
            <div style={{ fontSize: 12, color: C.textSub, marginTop: 2 }}>{item.desc}</div>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Toggle checked={prefs[item.key].inApp} onChange={() => toggle(item.key, "inApp")} />
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Toggle checked={prefs[item.key].email} onChange={() => toggle(item.key, "email")} />
          </div>
        </div>
      ))}
      <div style={{ marginTop: 20, display: "flex", gap: 12, alignItems: "center" }}>
        <SaveBtn onClick={save} saving={saving} />
        {msg && <span style={{ fontSize: 13, color: msg === "Saved." ? C.green : C.red }}>{msg}</span>}
      </div>
    </div>
  );
}
```

Add the import near the top of `src/views/advertiser/SettingsView.jsx` (alongside the other imports):

```js
import { EVENTS, normalizeChannelPrefs } from '../../lib/notificationPrefs.js';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/views/advertiser/SettingsView.notificationsTab.test.jsx`
Expected: PASS, all 4 tests.

- [ ] **Step 5: Run the full advertiser settings test file to check nothing else broke**

Run: `npx vitest run src/views/advertiser/SettingsView.test.jsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/views/advertiser/SettingsView.jsx src/views/advertiser/SettingsView.notificationsTab.test.jsx
git commit -m "Add per-channel toggles to advertiser NotificationsTab

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: `initialTab` prop on both Settings views, delete `NotificationPrefsView`, rewire routing

**Files:**
- Modify: `src/views/advertiser/SettingsView.jsx:486` (`SettingsView` default export)
- Modify: `src/views/operator/OperatorSettingsView.jsx:806` (`OperatorSettingsView` export)
- Modify: `src/App.jsx:51` (remove lazy import), `:545` (advertiser route), `:583` (operator route)
- Modify: `src/components/layout/Sidebar.jsx:388-395` (remove NavItem)
- Delete: `src/views/shared/NotificationPrefsView.jsx`
- Delete: any existing test file for `NotificationPrefsView.jsx` if present (check with `git ls-files | grep -i NotificationPrefsView`)
- Test: `src/App.notificationPrefsRoute.test.jsx` (route-level check, see Step 1)

**Interfaces:**
- Consumes: `NotificationsTab` (Tasks 2 & 3) unchanged — this task only changes which tab is initially selected and how the two views are reached.
- Produces: `SettingsView({ initialTab } = {})` and `OperatorSettingsView({ setNav, initialTab } = {})` — both default `initialTab` to `'profile'` when omitted, matching current behavior for every other existing call site.

- [ ] **Step 1: Write the failing tests**

First, find the `tab` state declarations to confirm exact line context:

```bash
grep -n "const \[tab, setTab\]" src/views/advertiser/SettingsView.jsx src/views/operator/OperatorSettingsView.jsx
```

```jsx
// src/App.notificationPrefsRoute.test.jsx
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

// This is a lightweight static check rather than a full render test --
// App.jsx renders through a large auth/data-loading tree that isn't worth
// mocking end-to-end here. It locks in that the deleted view and dead
// route string are actually gone, and that both branches now forward to
// the Settings views with the notifications tab pre-selected.
describe('App.jsx notif-prefs routing', () => {
  const src = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8');

  it('no longer imports the deleted NotificationPrefsView', () => {
    expect(src).not.toMatch(/NotificationPrefsView/);
  });

  it('routes the advertiser notif-prefs id to SettingsView with the notifications tab', () => {
    expect(src).toMatch(/active === 'notif-prefs'\)\s*(?:\/\/.*)?\s*return <SettingsView initialTab="notifications" \/>/);
  });

  it('routes the operator notif-prefs id to OperatorSettingsView with the notifications tab', () => {
    expect(src).toMatch(/active === 'notif-prefs'\)\s*(?:\/\/.*)?\s*return <OperatorSettingsView setNav={navTo} initialTab="notifications" \/>/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/App.notificationPrefsRoute.test.jsx`
Expected: FAIL — `App.jsx` still imports and renders `NotificationPrefsView`.

- [ ] **Step 3: Implement each file change**

`src/views/advertiser/SettingsView.jsx` — change:
```js
export default function SettingsView() {
```
to:
```js
export default function SettingsView({ initialTab } = {}) {
```
and change (locate via the grep from Step 1):
```js
const [tab, setTab] = useState("profile");
```
to:
```js
const [tab, setTab] = useState(initialTab ?? "profile");
```

`src/views/operator/OperatorSettingsView.jsx` — change:
```js
export function OperatorSettingsView({ setNav } = {}) {
```
to:
```js
export function OperatorSettingsView({ setNav, initialTab } = {}) {
```
and change:
```js
const [tab, setTab] = useState('profile');
```
to:
```js
const [tab, setTab] = useState(initialTab ?? 'profile');
```

`src/App.jsx` — remove line 51:
```js
const NotificationPrefsView = lazy(() => import('./views/shared/NotificationPrefsView.jsx').then(m => ({ default: m.NotificationPrefsView })));
```

Change line 545 (advertiser branch) from:
```js
      if (active === 'notif-prefs')      return <NotificationPrefsView />;
```
to:
```js
      if (active === 'notif-prefs')      return <SettingsView initialTab="notifications" />;
```

Change line 583 (operator branch) from:
```js
    if (active === 'notif-prefs')   return <NotificationPrefsView />;
```
to:
```js
    if (active === 'notif-prefs')   return <OperatorSettingsView setNav={navTo} initialTab="notifications" />;
```

`src/components/layout/Sidebar.jsx` — remove the NavItem block:
```jsx
        {/* Notification Prefs */}
        <NavItem
          item={{ id: 'notif-prefs', label: 'Notification Prefs', icon: 'notifPrefs' }}
          active={active}
          collapsed={collapsed}
          pendingCount={0}
          onClick={setActive}
        />

```
(delete the whole block including its blank trailing line, leaving the surrounding `{/* Bottom section */}` div and the `{/* Account / sign-out row */}` block adjacent to each other).

Delete the file:
```bash
rm src/views/shared/NotificationPrefsView.jsx
```

Check for and remove any now-orphaned test file:
```bash
git ls-files | grep -i NotificationPrefsView
```
If any test file for the deleted view is found (e.g. `src/views/shared/NotificationPrefsView.test.jsx`), delete it too.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/App.notificationPrefsRoute.test.jsx`
Expected: PASS, all 3 tests.

- [ ] **Step 5: Confirm no remaining references and run the full suite**

```bash
grep -rn "NotificationPrefsView" src/ || echo "clean"
grep -rn "notif-prefs" src/ || echo "clean"
```
Expected: only the two `notif-prefs` string literals inside `App.jsx`'s route conditions remain (the id itself is still used by `active === 'notif-prefs'`, since old links/back-navigation into that state may still exist and should keep landing on the right place). No `NotificationPrefsView` matches anywhere.

```bash
npx vitest run
```
Expected: full suite PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Delete NotificationPrefsView, route notif-prefs to Settings > Notifications

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Update `resolveChannelPrefs()` comment

**Files:**
- Modify: `supabase/functions/_shared/notificationPrefs.ts:1-19` (header comment only)

**Interfaces:**
- Consumes: nothing new.
- Produces: no behavior change — `resolveChannelPrefs()`'s implementation is untouched; only its header comment changes to reflect that the flat-boolean shape is no longer written by any live UI.

- [ ] **Step 1: Update the comment**

Replace lines 1-19 of `supabase/functions/_shared/notificationPrefs.ts`:

```ts
// Per-channel notification preference enforcement.
//
// Product-audit finding: two separate UIs used to write notification_prefs
// in incompatible shapes -- src/views/shared/NotificationPrefsView.jsx
// wrote the nested { [eventType]: { inApp, email } } shape while the
// Settings > Notifications tabs (src/views/operator/OperatorSettingsView.jsx,
// src/views/advertiser/SettingsView.jsx) wrote a flat { [eventType]:
// boolean } shape. Both are now unified: NotificationPrefsView.jsx was
// deleted, and both Settings tabs write the nested shape via
// src/lib/notificationPrefs.js's normalizeChannelPrefs(). The flat-boolean
// branch below is kept solely to keep reading rows saved by either UI
// before this change -- nothing currently writes that shape.

export interface ChannelPrefs {
  inApp: boolean;
  email: boolean;
}

export function resolveChannelPrefs(eventPrefs: unknown): ChannelPrefs {
  if (typeof eventPrefs === "object" && eventPrefs !== null) {
    const obj = eventPrefs as Record<string, unknown>;
    return {
      inApp: obj.inApp !== false,
      email: obj.email !== false,
    };
  }
  // Legacy flat-boolean shape: a single `false` opted out of everything.
  const enabled = eventPrefs !== false;
  return { inApp: enabled, email: enabled };
}
```

- [ ] **Step 2: Check for existing tests on this file and run them**

```bash
find supabase/functions/_shared -iname "*notificationPrefs*test*"
```
If a test file exists, run it (e.g. `npx vitest run supabase/functions/_shared/notificationPrefs.test.ts` — adjust to whatever runner the `supabase/functions` tree uses, check for a local `deno.json`/`package.json` first with `cat supabase/functions/_shared/*.json 2>/dev/null` or `find supabase/functions -maxdepth 2 -iname "*.json"`). Expected: PASS (comment-only change, no behavior touched).

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/_shared/notificationPrefs.ts
git commit -m "Update resolveChannelPrefs comment: flat-boolean shape is now legacy-only

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Final verification

- [ ] Run `npx vitest run` from the repo root — full suite passes.
- [ ] Run `npx eslint .` — no new lint errors.
- [ ] `grep -rn "NotificationPrefsView" src/` returns nothing.
