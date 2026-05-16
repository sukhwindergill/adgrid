# Critical UX Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the 4 critical UX fixes from the May 2026 design critique: nav architecture, replace window.confirm modals, advertiser table mobile layout, and textMuted contrast.

**Architecture:** Fixes are independent — each touches a different file or component. No new routing or state management required. One new shared component (`ConfirmModal`) is created for the modal fix, then consumed where `window.confirm` was called.

**Tech Stack:** React 18, inline CSS with `src/design/tokens.js` design system, `useBreakpoint` hook already in `src/lib/useBreakpoint.js`.

---

## File Map

| File | Action | Fix |
|------|--------|-----|
| `src/design/tokens.js` | Modify | Fix `textMuted` contrast |
| `src/components/primitives/ConfirmModal.jsx` | Create | New modal component |
| `src/views/operator/Campaigns.jsx` | Modify | Replace `window.confirm` with `ConfirmModal` |
| `src/components/layout/GlobalHeader.jsx` | Modify | Add secondary sub-nav bar below primary tabs |
| `src/views/advertiser/AdvDashboard.jsx` | Modify | Responsive campaign row layout |

---

## Task 1: Fix textMuted contrast (tokens.js)

**Files:**
- Modify: `src/design/tokens.js`

This is the fastest fix. `#a3a3a3` on white = 2.85:1 contrast ratio, failing WCAG AA (requires 4.5:1 for normal text). `#737373` = 4.6:1, passes. This single change propagates everywhere `C.textMuted` is used (chart axis labels, form hints, sub-labels).

- [ ] **Step 1: Change textMuted in tokens.js**

In `src/design/tokens.js` line 11, change:
```js
  textMuted: '#a3a3a3',
```
to:
```js
  textMuted: '#737373',
```

- [ ] **Step 2: Verify the change is the only one needed**

Run:
```bash
grep -r "a3a3a3" src/
```
Expected: no hits (the only occurrence was `tokens.js`).

Also check `src/lib/constants.js` — it has a separate `textMuted: '#9ca3af'`. That file is used only in non-design-system code. Run:
```bash
grep -r "textMuted" src/lib/constants.js
```
If it exists, change it to `#737373` too to avoid divergence.

- [ ] **Step 3: Commit**

```bash
git add src/design/tokens.js src/lib/constants.js
git commit -m "fix: raise textMuted contrast to #737373 (WCAG AA pass)"
```

---

## Task 2: Build ConfirmModal component

**Files:**
- Create: `src/components/primitives/ConfirmModal.jsx`

The app already has an inline modal pattern (used in `NewCampaignModal` in Campaigns.jsx: `position: fixed`, `inset: 0` backdrop, `zIndex: 500`). Follow that pattern exactly. No new dependencies.

- [ ] **Step 1: Create ConfirmModal.jsx**

Create `src/components/primitives/ConfirmModal.jsx`:

```jsx
import { C, F } from '../../design/tokens.js';
import { Btn } from './Btn.jsx';

/**
 * Drop-in replacement for window.confirm().
 *
 * Props:
 *   title       string   — modal heading
 *   message     string   — body text
 *   confirmLabel string  — confirm button label (default "Confirm")
 *   cancelLabel  string  — cancel button label (default "Cancel")
 *   danger       bool    — use red confirm button instead of primary (default false)
 *   onConfirm   () => void
 *   onCancel    () => void
 */
export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: C.surface, borderRadius: 16,
        padding: '28px 32px', width: 400, maxWidth: 'calc(100vw - 48px)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <div style={{ fontFamily: F.sans, fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 10 }}>
          {title}
        </div>
        <div style={{ fontFamily: F.sans, fontSize: 14, color: C.textSub, lineHeight: 1.6, marginBottom: 24 }}>
          {message}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Btn variant="ghost" onClick={onCancel}>{cancelLabel}</Btn>
          <Btn
            variant={danger ? 'danger' : 'primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Btn>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Check Btn variants**

Run:
```bash
grep -n "variant" src/components/primitives/Btn.jsx | head -20
```

Confirm `ghost` and `primary` variants exist. If `danger` variant does not exist, use `variant="primary"` with an explicit red background via the `style` prop override:
```jsx
<Btn variant="primary" onClick={onConfirm} style={{ background: C.red }}>
  {confirmLabel}
</Btn>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/primitives/ConfirmModal.jsx
git commit -m "feat: add ConfirmModal component — replaces window.confirm()"
```

---

## Task 3: Replace window.confirm in Campaigns.jsx

**Files:**
- Modify: `src/views/operator/Campaigns.jsx` (lines 7–64, the `ApproveBtn` component)

The `window.confirm` at line 36 blocks the browser thread and looks terrible in production. Replace with `ConfirmModal` rendered inline via `useState`.

- [ ] **Step 1: Add ConfirmModal import at the top of Campaigns.jsx**

Find the existing import block at the top of `src/views/operator/Campaigns.jsx`. Add:
```js
import { ConfirmModal } from '../../components/primitives/ConfirmModal.jsx';
```

- [ ] **Step 2: Rewrite ApproveBtn to use ConfirmModal**

Replace the entire `ApproveBtn` function (lines 7–64) with:

```jsx
function ApproveBtn({ campaign, setCampaigns }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [pendingManual, setPendingManual] = useState(null); // holds { msg } when we need confirmation

  const approve = async e => {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    setErr(null);

    const { data: { session } } = await supabase.auth.getSession();

    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/charge-campaign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ campaign_id: campaign.id }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = body.error ?? 'Charge failed';
      const isNoPayment = msg.toLowerCase().includes('no payment') || msg.toLowerCase().includes('no card');
      if (isNoPayment) {
        setLoading(false);
        setPendingManual({ msg }); // show ConfirmModal instead of window.confirm
        return;
      }
      setErr(msg);
      setLoading(false);
      return;
    }

    setCampaigns(prev => prev.map(x => x.id === campaign.id ? { ...x, status: 'scheduled', payment_status: 'paid' } : x));
    setLoading(false);
  };

  const confirmManual = async () => {
    setPendingManual(null);
    setLoading(true);
    const { error: dbErr } = await supabase.from('bookings').update({ status: 'scheduled' }).eq('id', campaign.id);
    if (dbErr) { setErr(dbErr.message); setLoading(false); return; }
    setCampaigns(prev => prev.map(x => x.id === campaign.id ? { ...x, status: 'scheduled' } : x));
    setLoading(false);
  };

  return (
    <div>
      {pendingManual && (
        <ConfirmModal
          title="No payment method on file"
          message={`${pendingManual.msg}\n\nApprove anyway? You can collect payment manually.`}
          confirmLabel="Approve without charging"
          cancelLabel="Cancel"
          onConfirm={confirmManual}
          onCancel={() => { setPendingManual(null); setLoading(false); }}
        />
      )}
      <Btn variant="success" size="sm" onClick={approve} disabled={loading}>
        {loading ? '…' : '✓ Approve'}
      </Btn>
      {err && <div style={{ fontSize: 10, color: C.red, fontFamily: F.sans, marginTop: 3, maxWidth: 110 }}>{err}</div>}
    </div>
  );
}
```

- [ ] **Step 3: Verify no other window.confirm/alert in billing flows**

```bash
grep -rn "window\.confirm\|window\.alert" src/
```

If `CampaignDetail.jsx` or any other file has hits, apply the same pattern there: add `pendingModal` state, render `<ConfirmModal>`, call the async action from `onConfirm`.

- [ ] **Step 4: Commit**

```bash
git add src/views/operator/Campaigns.jsx
git commit -m "fix: replace window.confirm in ApproveBtn with ConfirmModal"
```

---

## Task 4: Fix AdvDashboard mobile layout

**Files:**
- Modify: `src/views/advertiser/AdvDashboard.jsx` (lines 24, 43)

Two grids need fixing:
1. Line 24 — KPI cards: `repeat(4,1fr)` → `repeat(2,1fr)` on mobile
2. Line 43 — Campaign row: `'1fr 200px 120px 100px 130px'` → stacked card on mobile

`useBreakpoint` is already imported in this file (line 73 of Campaigns.jsx imports it, and it's in `src/lib/useBreakpoint.js`).

- [ ] **Step 1: Add useBreakpoint import to AdvDashboard.jsx**

In `src/views/advertiser/AdvDashboard.jsx`, add to the import block:
```js
import { useBreakpoint } from '../../lib/useBreakpoint.js';
```

- [ ] **Step 2: Destructure isMobile inside the component**

Inside `AdvDashboard` function body, add after the `myCampaigns` declarations:
```js
const { isMobile } = useBreakpoint();
```

- [ ] **Step 3: Make KPI cards grid responsive**

Change line 24 from:
```jsx
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
```
to:
```jsx
<div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
```

- [ ] **Step 4: Make campaign row responsive**

Replace the campaign row grid (currently a single `<div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 120px 100px 130px', ... }}>`) with a conditional layout.

Change the inner card content (line 43 area) from:
```jsx
<div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 120px 100px 130px', gap: 16, alignItems: 'center' }}>
  <div>
    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 2 }}>{c.screen}</div>
    <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans }}>{c.city} · {c.category} · {c.start} → {c.end}</div>
  </div>
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
      <span style={{ fontSize: 11, color: C.textSub, fontFamily: F.sans }}>Spend</span>
      <span style={{ fontSize: 11, fontWeight: 500, color: C.text, fontFamily: F.mono }}>£{c.spent.toLocaleString()} / £{c.budget.toLocaleString()}</span>
    </div>
    <ProgressBar value={c.spent} max={c.budget} height={4} />
  </div>
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: F.mono }}>{(c.impressions / 1000).toFixed(1)}K</div>
    <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>impressions</div>
  </div>
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: 18, fontWeight: 700, color: C.purple, fontFamily: F.mono }}>{c.scans}</div>
    <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>scans</div>
  </div>
  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
    <Badge status={c.status} />
  </div>
</div>
```

to:
```jsx
{isMobile ? (
  /* Mobile: stacked card */
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 2 }}>{c.screen}</div>
        <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans }}>{c.city} · {c.category}</div>
        <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans }}>{c.start} → {c.end}</div>
      </div>
      <Badge status={c.status} />
    </div>
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: C.textSub, fontFamily: F.sans }}>Spend</span>
        <span style={{ fontSize: 11, fontWeight: 500, color: C.text, fontFamily: F.mono }}>£{c.spent.toLocaleString()} / £{c.budget.toLocaleString()}</span>
      </div>
      <ProgressBar value={c.spent} max={c.budget} height={4} />
    </div>
    <div style={{ display: 'flex', gap: 24 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: F.mono }}>{(c.impressions / 1000).toFixed(1)}K</div>
        <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>impressions</div>
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.purple, fontFamily: F.mono }}>{c.scans}</div>
        <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>scans</div>
      </div>
    </div>
  </div>
) : (
  /* Desktop: original grid */
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 120px 100px 130px', gap: 16, alignItems: 'center' }}>
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 2 }}>{c.screen}</div>
      <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans }}>{c.city} · {c.category} · {c.start} → {c.end}</div>
    </div>
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: C.textSub, fontFamily: F.sans }}>Spend</span>
        <span style={{ fontSize: 11, fontWeight: 500, color: C.text, fontFamily: F.mono }}>£{c.spent.toLocaleString()} / £{c.budget.toLocaleString()}</span>
      </div>
      <ProgressBar value={c.spent} max={c.budget} height={4} />
    </div>
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: F.mono }}>{(c.impressions / 1000).toFixed(1)}K</div>
      <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>impressions</div>
    </div>
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: C.purple, fontFamily: F.mono }}>{c.scans}</div>
      <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>scans</div>
    </div>
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <Badge status={c.status} />
    </div>
  </div>
)}
```

- [ ] **Step 5: Commit**

```bash
git add src/views/advertiser/AdvDashboard.jsx
git commit -m "fix: responsive layout for AdvDashboard KPI grid and campaign rows"
```

---

## Task 5: Navigation architecture — add secondary sub-nav

**Files:**
- Modify: `src/components/layout/GlobalHeader.jsx`
- Modify: `src/components/layout/AppShell.jsx`

**Approach:** Add a slim secondary nav bar (40px) rendered below the main header. It shows the secondary links (Revenue, Audience, Advertisers, etc.) as horizontal tabs, always visible — no longer buried in the avatar dropdown. The avatar dropdown keeps only: user info, Sign out. This approach requires no routing changes and no sidebar rewrite.

On mobile (`isMobile`), the secondary nav scrolls horizontally with `overflowX: auto`.

- [ ] **Step 1: Add useBreakpoint import to GlobalHeader.jsx**

```js
import { useBreakpoint } from '../../lib/useBreakpoint.js';
```

- [ ] **Step 2: Rewrite GlobalHeader to add secondary sub-nav**

Replace the entire content of `src/components/layout/GlobalHeader.jsx` with:

```jsx
import { useState } from 'react';
import { C, F, glass } from '../../design/tokens.js';
import { Btn } from '../primitives/Btn.jsx';
import NotificationBell from '../NotificationBell.jsx';
import { useBreakpoint } from '../../lib/useBreakpoint.js';

const OP_TABS = [
  { id: 'overview',  label: 'Dashboard' },
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'screens',   label: 'Screens' },
];
const ADV_TABS = [
  { id: 'adv-overview',  label: 'Dashboard' },
  { id: 'adv-campaigns', label: 'Campaigns' },
  { id: 'adv-analytics', label: 'Analytics' },
];

const OP_SECONDARY = [
  { id: 'revenue',      label: 'Revenue' },
  { id: 'audience',     label: 'Audience' },
  { id: 'advertisers',  label: 'Advertisers' },
  { id: 'signals',      label: 'Live Signals' },
  { id: 'billing',      label: 'Billing' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'display',      label: 'Display' },
];
const ADV_SECONDARY = [
  { id: 'adv-audience',     label: 'Scans & Data' },
  { id: 'adv-billing',      label: 'Billing' },
  { id: 'adv-settings',     label: 'Settings' },
  { id: 'adv-integrations', label: 'Integrations' },
];

export function GlobalHeader({ active, setActive, user, onSignOut, isAdv }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isMobile } = useBreakpoint();

  const tabs = isAdv ? ADV_TABS : OP_TABS;
  const secondaryLinks = isAdv ? ADV_SECONDARY : OP_SECONDARY;
  const initials = (user?.name || user?.email || 'U').slice(0, 2).toUpperCase();

  const isSecondaryActive = secondaryLinks.some(l => l.id === active);

  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 100 }}>
      {/* ── Primary bar ── */}
      <header style={{
        height: 60, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 28px',
        ...glass, borderBottom: '1px solid rgba(0,0,0,0.07)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: F.sans,
          }}>A</div>
          {!isMobile && (
            <span style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 15, letterSpacing: '0.04em', color: C.text }}>ADGRID</span>
          )}
        </div>

        {/* Primary tabs */}
        <nav style={{ display: 'flex', alignItems: 'stretch', gap: 0, height: 60 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActive(t.id)} style={{
              padding: isMobile ? '0 10px' : '0 16px',
              background: 'none', border: 'none',
              borderBottom: active === t.id && !isSecondaryActive ? `2px solid ${C.purple}` : '2px solid transparent',
              color: active === t.id && !isSecondaryActive ? C.text : C.textSub,
              fontFamily: F.sans, fontSize: isMobile ? 12 : 14,
              fontWeight: active === t.id && !isSecondaryActive ? 600 : 400,
              cursor: 'pointer', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center',
              whiteSpace: 'nowrap',
            }}>{t.label}</button>
          ))}
        </nav>

        {/* Right actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <NotificationBell aria-label="Notifications" />
          {!isMobile && (
            <Btn
              variant="primary"
              size="sm"
              onClick={() => setActive(isAdv ? 'adv-create' : 'campaigns')}
              style={{ boxShadow: '0 4px 14px rgba(124,58,237,0.3)' }}
            >
              + New Campaign
            </Btn>
          )}

          {/* Avatar + dropdown (user info + sign out only) */}
          <div style={{ position: 'relative' }}>
            <div
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Account menu"
              role="button"
              style={{
                width: 34, height: 34, borderRadius: '50%',
                background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: F.sans,
                cursor: 'pointer', userSelect: 'none',
              }}
            >{initials}</div>

            {menuOpen && (
              <>
                <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 190 }} />
                <div style={{
                  position: 'absolute', right: 0, top: 42, width: 200,
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                  padding: '8px 0', zIndex: 200,
                }}>
                  <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 600, color: C.text }}>{user?.name || 'User'}</div>
                    <div style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted, marginTop: 2 }}>{user?.email}</div>
                  </div>
                  <button onClick={() => { onSignOut(); setMenuOpen(false); }} style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '8px 16px', background: 'none', border: 'none',
                    fontFamily: F.sans, fontSize: 13, color: C.red, cursor: 'pointer',
                  }}>Sign out</button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Secondary sub-nav ── */}
      <div style={{
        height: 40,
        display: 'flex', alignItems: 'stretch',
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        overflowX: 'auto',
        padding: '0 28px',
        gap: 0,
      }}>
        {secondaryLinks.map(l => (
          <button
            key={l.id}
            onClick={() => setActive(l.id)}
            style={{
              padding: '0 14px',
              background: 'none', border: 'none',
              borderBottom: active === l.id ? `2px solid ${C.purple}` : '2px solid transparent',
              color: active === l.id ? C.text : C.textMuted,
              fontFamily: F.sans, fontSize: 12,
              fontWeight: active === l.id ? 600 : 400,
              cursor: 'pointer', transition: 'color 0.15s',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
            onMouseEnter={e => { if (active !== l.id) e.currentTarget.style.color = C.textSub; }}
            onMouseLeave={e => { if (active !== l.id) e.currentTarget.style.color = C.textMuted; }}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Adjust AppShell main padding to account for taller nav**

The header is now 100px tall (60 primary + 40 secondary). `AppShell` just renders `{header}` followed by `<main>`, so no padding change is needed — it stacks naturally. But verify that the `position: sticky` wrapper doesn't cause scroll issues.

Open `src/components/layout/AppShell.jsx` and confirm `{header}` is rendered inside the `paddingTop` div. No changes needed — the sticky wrapper on the outer `<div>` in GlobalHeader handles it.

- [ ] **Step 4: Verify no dead references**

The old `secondaryLinks` map in the dropdown is removed. Confirm the view IDs (`revenue`, `audience`, etc.) still exist as cases in `App.jsx`'s view-switcher:

```bash
grep -n "revenue\|audience\|advertisers\|signals\|display" src/App.jsx | head -20
```

Expected: each ID appears as a view case. If any are missing, they'll just render the `<Placeholder />` component — acceptable.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/GlobalHeader.jsx
git commit -m "feat: promote secondary nav links to persistent sub-nav bar"
```

---

## Self-Review

**Spec coverage:**
- ✅ textMuted: Task 1
- ✅ window.confirm: Tasks 2 & 3
- ✅ AdvDashboard mobile: Task 4
- ✅ Nav architecture: Task 5

**No placeholders:** All steps contain actual code.

**Type consistency:** `ConfirmModal` props (`title`, `message`, `confirmLabel`, `cancelLabel`, `danger`, `onConfirm`, `onCancel`) are defined in Task 2 and consumed in Task 3 with matching names.

**One risk:** Task 5 removes secondary links from the avatar dropdown and adds `aria-label` to the avatar button but not to the `NotificationBell`. The bell fix is in the moderate/accessibility backlog — intentionally out of scope here.
