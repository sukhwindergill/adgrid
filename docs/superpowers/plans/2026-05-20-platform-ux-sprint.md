# Platform UX Sprint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a collapsible sidebar nav, 5 quick UX fixes, and 3 new views (Approval Queue, Screen Detail, Notification Preferences) across the Adgrid React frontend.

**Architecture:** Replace the horizontal GlobalHeader nav with a fixed left Sidebar (220px expanded / 52px icon rail) + slim TopBar (notifications + avatar only). New views are standalone JSX files wired into App.jsx's `active` state router. No new dependencies — all inline SVG icons, existing Supabase client, existing primitive components.

**Tech Stack:** React 18 (JSX, hooks), Vite, Supabase JS v2, inline CSS (no CSS modules), existing design tokens (`src/design/tokens.js`). No test framework — verify each task in the dev server (`npm run dev`).

---

## File Map

| Action | Path | Purpose |
|---|---|---|
| Create | `src/components/primitives/SectionHeader.jsx` | Shared section heading primitive |
| Create | `src/components/shared/UptimeGrid.jsx` | Extracted uptime heat-grid, used in Screens + ScreenDetail |
| Create | `src/components/screens/EditScreenModal.jsx` | Edit screen fields modal |
| Create | `src/lib/campaignActions.js` | Extracted ApproveBtn + shared approve logic |
| Create | `src/components/layout/Sidebar.jsx` | Collapsible left sidebar |
| Create | `src/views/shared/NotificationPrefsView.jsx` | Notification toggle grid |
| Create | `src/views/operator/ApprovalQueue.jsx` | Pending-review campaigns dedicated view |
| Create | `src/views/operator/ScreenDetail.jsx` | Full-page screen drill-down |
| Create | `supabase/migrations/20260520000000_add_notification_prefs.sql` | Add JSONB prefs column |
| Modify | `src/components/layout/GlobalHeader.jsx` | Strip to TopBar (notifications + avatar only) |
| Modify | `src/components/layout/AppShell.jsx` | Two-column layout: sidebar + content |
| Modify | `src/App.jsx` | Wire sidebar, selectedScreenId state, new views |
| Modify | `src/views/operator/Analytics.jsx` | Heatmap opacity + date range filter |
| Modify | `src/views/operator/Campaigns.jsx` | Empty state CTA, import ApproveBtn from campaignActions |
| Modify | `src/views/operator/Dashboard.jsx` | Remove duplicate New Campaign CTA |
| Modify | `src/views/operator/Screens.jsx` | Remove UptimeGrid (now imported), add click-to-detail nav |
| Modify | `src/views/advertiser/AdvDashboard.jsx` | Mobile-responsive campaign table |
| Modify | `src/App.jsx` | Auth loading skeleton |

---

## Task 1: SectionHeader Primitive

**Files:**
- Create: `src/components/primitives/SectionHeader.jsx`

- [ ] **Step 1: Create the component**

```jsx
// src/components/primitives/SectionHeader.jsx
import { C, F } from '../../design/tokens.js';

export function SectionHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text, fontFamily: F.sans }}>{title}</h2>
        {subtitle && <p style={{ margin: '3px 0 0', fontSize: 13, color: C.textSub, fontFamily: F.sans }}>{subtitle}</p>}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Replace inline h2 headers in operator views**

In each file below, find inline `<h2 style={{...}}>` or `<div style={{ fontSize: 16, fontWeight: 700 ... }}>` section headings and replace with `<SectionHeader title="..." subtitle="..." />`. Add the import `import { SectionHeader } from '../../components/primitives/SectionHeader.jsx';` to each file.

Files to update (grep for `fontSize: 16, fontWeight: 7` or `fontSize: 18, fontWeight: 7` to locate the headings):
- `src/views/operator/Dashboard.jsx`
- `src/views/operator/Revenue.jsx`
- `src/views/operator/Audience.jsx`
- `src/views/operator/Analytics.jsx`
- `src/views/operator/CampaignDetail.jsx`
- `src/views/operator/Billing.jsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/primitives/SectionHeader.jsx src/views/operator/
git commit -m "feat: SectionHeader primitive, replace inline h2 headers in operator views"
```

---

## Task 2: Heatmap Min-Opacity Fix

**Files:**
- Modify: `src/views/operator/Analytics.jsx:24`

- [ ] **Step 1: Update heatmap opacity formula**

In `src/views/operator/Analytics.jsx`, find the `HeatmapGrid` component (~line 10–30). Change the opacity calculation:

```jsx
// BEFORE
opacity: 0.06 + (v / max) * 0.94,

// AFTER
opacity: v === 0 ? 0 : 0.20 + (v / max) * 0.80,
```

Also add a background for zero cells so the grid structure is visible:

```jsx
// In the same cell div, change background logic:
background: v === 0 ? C.surfaceAlt : C.purple,
```

The full cell div becomes:
```jsx
<div
  key={`${ri}-${ci}`}
  title={`${HOUR_LABELS[ci]} — ${DAY_LABELS[ri]}: ${v} people`}
  style={{
    flex: 1,
    aspectRatio: '1',
    borderRadius: 3,
    background: v === 0 ? C.surfaceAlt : C.purple,
    opacity: v === 0 ? 0 : 0.20 + (v / max) * 0.80,
    transition: 'opacity 0.2s',
  }}
/>
```

- [ ] **Step 2: Verify in dev server**

Run `npm run dev`, navigate to Analytics tab as operator. The heatmap grid should show faint purple cells at low values (not nearly-invisible) and the grid structure (empty cells) should be visible as `C.surfaceAlt` background.

- [ ] **Step 3: Commit**

```bash
git add src/views/operator/Analytics.jsx
git commit -m "fix: heatmap min-opacity 6% → 20%, zero cells use surfaceAlt"
```

---

## Task 3: Auth Loading Skeleton

**Files:**
- Modify: `src/App.jsx` (~line 195)

- [ ] **Step 1: Replace loading div with skeleton**

In `src/App.jsx`, find the auth loading gate that renders `Loading…`. Replace it:

```jsx
// BEFORE (find this block):
if (loading) {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans }}>Loading…</div>
    </div>
  );
}

// AFTER:
if (loading) {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '40px 28px' }}>
      <div style={{ maxWidth: 1320, margin: '0 auto' }}>
        <Skeleton height={32} radius={8} style={{ width: 180, marginBottom: 32 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          {[0,1,2,3].map(i => <Skeleton key={i} height={90} radius={12} />)}
        </div>
        <Skeleton height={220} radius={12} style={{ marginBottom: 20 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <Skeleton height={160} radius={12} />
          <Skeleton height={160} radius={12} />
        </div>
      </div>
    </div>
  );
}
```

Add the Skeleton import at the top of `src/App.jsx`:

```jsx
import { Skeleton } from './components/ui/Skeleton.jsx';
```

- [ ] **Step 2: Verify**

Hard-refresh the app. The initial load should show skeleton cards instead of centered "Loading…" text.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "fix: auth loading gate uses skeleton instead of plain text"
```

---

## Task 4: Remove Duplicate New Campaign CTA

**Files:**
- Modify: `src/views/operator/Dashboard.jsx`

- [ ] **Step 1: Remove the New Campaign button from Dashboard PageHeader**

In `src/views/operator/Dashboard.jsx`, find the `PageHeader` usage. Remove the `action` prop (or whatever prop renders the "New Campaign" button):

```jsx
// BEFORE — find the PageHeader with a New Campaign action and remove the action prop:
<PageHeader
  title="Dashboard"
  subtitle="..."
  action={<Btn onClick={...}>New Campaign</Btn>}
/>

// AFTER:
<PageHeader
  title="Dashboard"
  subtitle="..."
/>
```

The canonical entry point for creating campaigns is the Campaigns nav item in the sidebar.

- [ ] **Step 2: Verify**

Navigate to Dashboard — no "New Campaign" button should appear in the page header.

- [ ] **Step 3: Commit**

```bash
git add src/views/operator/Dashboard.jsx
git commit -m "fix: remove duplicate New Campaign CTA from Dashboard header"
```

---

## Task 5: Campaign Empty State Onboarding Card

**Files:**
- Modify: `src/views/operator/Campaigns.jsx` (~line 350)

- [ ] **Step 1: Update the empty state block**

In `src/views/operator/Campaigns.jsx`, find the `shown.length === 0` block. Replace with a version that distinguishes between zero campaigns (global) and zero matching a filter:

```jsx
{shown.length === 0 ? (
  <div style={{
    textAlign: 'center', padding: '56px 24px',
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
  }}>
    <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
    {campaigns.length === 0 ? (
      <>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: F.sans, marginBottom: 6 }}>
          No campaigns yet
        </div>
        <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, marginBottom: 20, maxWidth: 320, margin: '0 auto 20px' }}>
          Create your first campaign to start reaching customers on your screens.
        </div>
        <Btn onClick={() => setShowCreate(true)}>
          + Create your first campaign
        </Btn>
      </>
    ) : (
      <>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 6 }}>
          No campaigns match these filters
        </div>
        <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans }}>
          Try adjusting the status filter or city selector.
        </div>
      </>
    )}
  </div>
) : (
```

Note: `setShowCreate` is the state setter that opens the new campaign modal — verify the exact variable name in the file and match it.

- [ ] **Step 2: Verify**

With no campaigns, the empty state should show the campaign icon, "No campaigns yet" heading, subtitle, and a CTA button. With campaigns but a filter that matches nothing, it shows the "No campaigns match these filters" message only.

- [ ] **Step 3: Commit**

```bash
git add src/views/operator/Campaigns.jsx
git commit -m "fix: campaign empty state with onboarding CTA for zero-campaign state"
```

---

## Task 6: AdvDashboard Mobile Responsive

**Files:**
- Modify: `src/views/advertiser/AdvDashboard.jsx`

- [ ] **Step 1: Add useBreakpoint and conditional layout**

In `src/views/advertiser/AdvDashboard.jsx`, add the import:

```jsx
import { useBreakpoint } from '../../lib/useBreakpoint.js';
```

Inside the component, destructure `isMobile`:

```jsx
const { isMobile } = useBreakpoint();
```

- [ ] **Step 2: Replace the fixed grid table with responsive layout**

Find the campaign list rendering. Replace the fixed-column grid rows with a mobile-aware layout:

```jsx
{campaigns.map(c => (
  isMobile ? (
    // Mobile: stacked card
    <div key={c.id} style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
      padding: 16, marginBottom: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 600, color: C.text, fontFamily: F.sans, fontSize: 14 }}>{c.advertiser}</div>
          <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans }}>{c.category} · {c.screen}</div>
        </div>
        <Badge status={c.status} />
      </div>
      <div style={{ display: 'flex', gap: 20, marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 11, color: C.textSub, fontFamily: F.sans }}>Budget</div>
          <div style={{ fontFamily: F.mono, fontWeight: 600, color: C.text }}>£{c.budget.toLocaleString()}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.textSub, fontFamily: F.sans }}>Impressions</div>
          <div style={{ fontFamily: F.mono, fontWeight: 600, color: C.text }}>{(c.impressions / 1000).toFixed(1)}K</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.textSub, fontFamily: F.sans }}>Scans</div>
          <div style={{ fontFamily: F.mono, fontWeight: 600, color: C.purple }}>{c.scans}</div>
        </div>
      </div>
      <ProgressBar value={c.spent} max={c.budget} height={4} />
    </div>
  ) : (
    // Desktop: existing fixed-grid row — keep unchanged
    <div key={c.id} style={{
      display: 'grid',
      gridTemplateColumns: '1fr 200px 120px 100px 130px',
      // ... existing desktop row styles ...
    }}>
      {/* existing desktop content */}
    </div>
  )
))}
```

Adapt the exact column content from the existing desktop row — do not change desktop rendering, only wrap in the `isMobile` conditional.

- [ ] **Step 3: Verify**

Open dev tools, set viewport to 375px wide. Campaign list should show as stacked cards. At 900px+ it should show the original grid layout.

- [ ] **Step 4: Commit**

```bash
git add src/views/advertiser/AdvDashboard.jsx
git commit -m "fix: AdvDashboard campaign list stacks to cards on mobile (<900px)"
```

---

## Task 7: Analytics Date Range Filter

**Files:**
- Modify: `src/views/operator/Analytics.jsx`

- [ ] **Step 1: Update state declarations**

In `src/views/operator/Analytics.jsx`, find:

```jsx
const [period, setPeriod] = useState(7);
```

Replace with:

```jsx
const [period, setPeriod] = useState(7); // 7 | 30 | 90 | 'custom'
const [customFrom, setCustomFrom] = useState('');
const [customTo, setCustomTo]   = useState('');
```

- [ ] **Step 2: Update the `since` computation in the data hook**

Find where `since` is computed from `period` (inside `useImpressionStats` hook). Update it to handle the `'custom'` option. Pass `customFrom`/`customTo` into the hook:

```jsx
function useImpressionStats(period, customFrom, customTo) {
  // ...existing state...

  useEffect(() => {
    let from, to;
    if (period === 'custom' && customFrom && customTo) {
      from = new Date(customFrom);
      to   = new Date(customTo);
      to.setHours(23, 59, 59, 999);
    } else {
      to   = new Date();
      from = new Date();
      from.setDate(from.getDate() - Number(period));
    }

    // Replace the existing `since` variable with `from` in the query:
    supabase
      .from('impression_events')
      .select('...')
      .gte('window_start', from.toISOString())
      .lte('window_start', to.toISOString())
      // ...rest of query unchanged
  }, [period, customFrom, customTo]);
}
```

Update the hook call site:

```jsx
const { stats, loading, hasReal } = useImpressionStats(period, customFrom, customTo);
```

- [ ] **Step 3: Update the filter bar UI**

Find the period `<select>` element in the filter bar. Add a `Custom…` option and conditional date inputs:

```jsx
<select
  value={period}
  onChange={e => setPeriod(e.target.value === 'custom' ? 'custom' : Number(e.target.value))}
  style={{ padding: '6px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, fontFamily: F.sans, color: C.textMid, background: C.surface, outline: 'none' }}
>
  <option value={7}>Last 7 days</option>
  <option value={30}>Last 30 days</option>
  <option value={90}>Last 90 days</option>
  <option value="custom">Custom range…</option>
</select>

{period === 'custom' && (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <input
      type="date"
      value={customFrom}
      onChange={e => setCustomFrom(e.target.value)}
      style={{ padding: '6px 10px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, fontFamily: F.sans, background: C.surface, color: C.text, outline: 'none' }}
    />
    <span style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans }}>to</span>
    <input
      type="date"
      value={customTo}
      onChange={e => setCustomTo(e.target.value)}
      style={{ padding: '6px 10px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, fontFamily: F.sans, background: C.surface, color: C.text, outline: 'none' }}
    />
  </div>
)}
```

- [ ] **Step 4: Verify**

Select "Custom range…" — two date inputs should appear. Pick a date range — data should update.

- [ ] **Step 5: Commit**

```bash
git add src/views/operator/Analytics.jsx
git commit -m "feat: analytics date range filter with custom from/to date picker"
```

---

## Task 8: Extract UptimeGrid Component

**Files:**
- Create: `src/components/shared/UptimeGrid.jsx`
- Modify: `src/views/operator/Screens.jsx`

- [ ] **Step 1: Create the shared component**

Copy the `UptimeGrid` function verbatim from `src/views/operator/Screens.jsx` (~line 89) into a new file:

```jsx
// src/components/shared/UptimeGrid.jsx
import { C, F } from '../../design/tokens.js';

export function UptimeGrid({ hourly }) {
  // 168 hourly buckets (7 days), grouped into 7 rows of 24
  const days = [];
  for (let d = 0; d < 7; d++) days.push(hourly.slice(d * 24, d * 24 + 24));
  const dayLabels = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    dayLabels.push(d.toLocaleDateString('en', { weekday: 'short' }));
  }
  return (
    <div>
      {days.map((row, di) => (
        <div key={di} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
          <span style={{ fontSize: 9, color: C.textMuted, fontFamily: F.sans, width: 26, flexShrink: 0 }}>{dayLabels[di]}</span>
          <div style={{ display: 'flex', gap: 2, flex: 1 }}>
            {row.map((v, hi) => (
              <div key={hi} title={`${String(hi).padStart(2,'0')}:00`} style={{
                flex: 1, height: 12, borderRadius: 2,
                background: v === 1 ? C.green : v === -1 ? C.surfaceAlt : C.border,
                opacity: v === 1 ? 0.85 : 0.4,
              }} />
            ))}
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 4, marginTop: 6, alignItems: 'center' }}>
        <div style={{ width: 10, height: 10, borderRadius: 2, background: C.green, opacity: 0.85 }} />
        <span style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans, marginRight: 10 }}>Online</span>
        <div style={{ width: 10, height: 10, borderRadius: 2, background: C.border, opacity: 0.4 }} />
        <span style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>No data</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update Screens.jsx imports**

In `src/views/operator/Screens.jsx`:
1. Delete the `UptimeGrid` function definition (lines ~89–124)
2. Add import at the top:

```jsx
import { UptimeGrid } from '../../components/shared/UptimeGrid.jsx';
```

- [ ] **Step 3: Verify**

Navigate to Screens, click a screen to expand — uptime grid should render exactly as before.

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/UptimeGrid.jsx src/views/operator/Screens.jsx
git commit -m "refactor: extract UptimeGrid to shared component"
```

---

## Task 9: Extract ApproveBtn to campaignActions.js

**Files:**
- Create: `src/lib/campaignActions.js`
- Modify: `src/views/operator/Campaigns.jsx`

- [ ] **Step 1: Create campaignActions.js**

Move the `ApproveBtn` component from `src/views/operator/Campaigns.jsx` into a new file. Also export a standalone `approveCampaign` async function for use without the button wrapper:

```jsx
// src/lib/campaignActions.js
import { useState } from 'react';
import { supabase } from './supabase.js';
import { SUPABASE_FUNCTIONS_URL } from './constants.js';
import { C, F } from '../design/tokens.js';
import { Btn } from '../components/primitives/Btn.jsx';
import { useConfirm } from '../components/primitives/ConfirmModal.jsx';

export function ApproveBtn({ campaign, setCampaigns }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const confirm = useConfirm();

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
        const confirmed = await confirm({
          title: 'Approve without charging?',
          message: `${msg}\n\nYou can collect payment manually.`,
          confirmLabel: 'Approve',
          danger: false,
        });
        if (!confirmed) { setLoading(false); return; }
        const { error: dbErr } = await supabase.from('bookings').update({ status: 'scheduled' }).eq('id', campaign.id);
        if (dbErr) { setErr(dbErr.message); setLoading(false); return; }
        setCampaigns(prev => prev.map(x => x.id === campaign.id ? { ...x, status: 'scheduled' } : x));
        setLoading(false);
        return;
      }
      setErr(msg);
      setLoading(false);
      return;
    }

    setCampaigns(prev => prev.map(x => x.id === campaign.id ? { ...x, status: 'scheduled', payment_status: 'paid' } : x));
    setLoading(false);
  };

  return (
    <div>
      <Btn variant="success" size="sm" onClick={approve} disabled={loading}>
        {loading ? '…' : '✓ Approve'}
      </Btn>
      {err && <div style={{ fontSize: 10, color: C.red, fontFamily: F.sans, marginTop: 3, maxWidth: 110 }}>{err}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Update Campaigns.jsx**

In `src/views/operator/Campaigns.jsx`:
1. Delete the `ApproveBtn` function definition (lines ~8–75)
2. Add import:

```jsx
import { ApproveBtn } from '../../lib/campaignActions.js';
```

- [ ] **Step 3: Verify**

Navigate to Campaigns, find a `pending_review` campaign — Approve button should still function.

- [ ] **Step 4: Commit**

```bash
git add src/lib/campaignActions.js src/views/operator/Campaigns.jsx
git commit -m "refactor: extract ApproveBtn to campaignActions.js"
```

---

## Task 10: Sidebar Component

**Files:**
- Create: `src/components/layout/Sidebar.jsx`

- [ ] **Step 1: Create the Sidebar component**

```jsx
// src/components/layout/Sidebar.jsx
import { useState, useEffect } from 'react';
import { C, F } from '../../design/tokens.js';

const ICONS = {
  overview:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  campaigns:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6M9 16h4"/></svg>,
  analytics:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>,
  screens:       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
  revenue:       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M14.5 9a2.5 2.5 0 00-5 0c0 5 5 3 5 8a2.5 2.5 0 01-5 0M12 7v1m0 8v1"/></svg>,
  audience:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  approval:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  advertisers:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>,
  signals:       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  integrations:  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>,
  display:       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="15" rx="2"/><path d="M17 2l-5 5-5-5"/></svg>,
  billing:       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>,
  scans:         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9V5a2 2 0 012-2h4M3 15v4a2 2 0 002 2h4M15 3h4a2 2 0 012 2v4M15 21h4a2 2 0 002-2v-4M9 9h6v6H9z"/></svg>,
  settings:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  notifPrefs:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>,
  user:          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"/></svg>,
  chevronLeft:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>,
  chevronRight:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>,
};

const OP_NAV = [
  { section: 'primary', items: [
    { id: 'overview',    label: 'Dashboard',       icon: 'overview' },
    { id: 'campaigns',   label: 'Campaigns',        icon: 'campaigns' },
    { id: 'analytics',   label: 'Analytics',        icon: 'analytics' },
    { id: 'screens',     label: 'Screens',          icon: 'screens' },
  ]},
  { section: 'secondary', items: [
    { id: 'revenue',      label: 'Revenue',          icon: 'revenue' },
    { id: 'audience',     label: 'Audience & Scans', icon: 'audience' },
    { id: 'approval',     label: 'Approval Queue',   icon: 'approval', badge: true },
    { id: 'advertisers',  label: 'Advertisers',      icon: 'advertisers' },
    { id: 'signals',      label: 'Live Signals',     icon: 'signals' },
    { id: 'integrations', label: 'Integrations',     icon: 'integrations' },
    { id: 'display',      label: 'Display Manager',  icon: 'display' },
  ]},
];

const ADV_NAV = [
  { section: 'primary', items: [
    { id: 'adv-overview',  label: 'Dashboard',    icon: 'overview' },
    { id: 'adv-campaigns', label: 'Campaigns',    icon: 'campaigns' },
    { id: 'adv-analytics', label: 'Analytics',    icon: 'analytics' },
  ]},
  { section: 'secondary', items: [
    { id: 'adv-audience',     label: 'Scans & Data', icon: 'scans' },
    { id: 'adv-billing',      label: 'Billing',      icon: 'billing' },
    { id: 'adv-settings',     label: 'Settings',     icon: 'settings' },
    { id: 'adv-integrations', label: 'Integrations', icon: 'integrations' },
  ]},
];

function NavItem({ item, active, setActive, collapsed, pendingCount }) {
  const isActive = active === item.id;
  const badge = item.badge && pendingCount > 0;

  return (
    <button
      title={collapsed ? item.label : undefined}
      onClick={() => setActive(item.id)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center',
        gap: collapsed ? 0 : 10, padding: collapsed ? '10px 0' : '10px 12px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        background: isActive ? C.purpleSoft : 'transparent',
        border: 'none', borderRadius: 8, cursor: 'pointer',
        color: isActive ? C.purple : C.textSub,
        fontFamily: F.sans, fontSize: 13, fontWeight: isActive ? 600 : 400,
        transition: 'all 0.15s', position: 'relative',
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = C.surfaceAlt; }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{ flexShrink: 0, display: 'flex', position: 'relative' }}>
        {ICONS[item.icon]}
        {badge && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: C.amber, color: '#fff',
            borderRadius: '50%', fontSize: 9, fontWeight: 700,
            width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: F.sans,
          }}>{pendingCount > 9 ? '9+' : pendingCount}</span>
        )}
      </span>
      {!collapsed && <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>}
    </button>
  );
}

export function Sidebar({ active, setActive, isAdv, user, onSignOut, pendingCount = 0 }) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true');

  const toggle = () => setCollapsed(c => {
    const next = !c;
    localStorage.setItem('sidebar_collapsed', next);
    return next;
  });

  const nav = isAdv ? ADV_NAV : OP_NAV;
  const W = collapsed ? 52 : 220;

  return (
    <div style={{
      width: W, minWidth: W, height: '100vh',
      position: 'sticky', top: 0, flexShrink: 0,
      background: C.surface, borderRight: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto', overflowX: 'hidden',
      transition: 'width 0.2s ease, min-width 0.2s ease',
    }}>
      {/* Logo */}
      <div style={{
        height: 56, display: 'flex', alignItems: 'center',
        padding: collapsed ? '0 14px' : '0 16px',
        borderBottom: `1px solid ${C.border}`, flexShrink: 0,
        justifyContent: collapsed ? 'center' : 'flex-start', gap: 10,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7, flexShrink: 0,
          background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 13, fontWeight: 800,
        }}>A</div>
        {!collapsed && <span style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 14, letterSpacing: '0.04em', color: C.text }}>ADGRID</span>}
      </div>

      {/* Nav sections */}
      <div style={{ flex: 1, padding: collapsed ? '12px 6px' : '12px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {nav.map((group, gi) => (
          <div key={gi}>
            {gi > 0 && <div style={{ height: 1, background: C.border, margin: '8px 4px' }} />}
            {group.items.map(item => (
              <NavItem
                key={item.id}
                item={item}
                active={active}
                setActive={setActive}
                collapsed={collapsed}
                pendingCount={item.badge ? pendingCount : 0}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Bottom: notification prefs + account */}
      <div style={{ padding: collapsed ? '8px 6px' : '8px 8px', borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <NavItem
          item={{ id: 'notif-prefs', label: 'Notification Prefs', icon: 'notifPrefs' }}
          active={active}
          setActive={setActive}
          collapsed={collapsed}
          pendingCount={0}
        />
        <button
          title={collapsed ? `${user?.name || user?.email} · Sign out` : undefined}
          onClick={onSignOut}
          style={{
            width: '100%', display: 'flex', alignItems: 'center',
            gap: collapsed ? 0 : 10, padding: collapsed ? '10px 0' : '10px 12px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            background: 'transparent', border: 'none', borderRadius: 8,
            cursor: 'pointer', color: C.textSub,
            fontFamily: F.sans, fontSize: 13, transition: 'all 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          {ICONS.user}
          {!collapsed && (
            <div style={{ flex: 1, textAlign: 'left', overflow: 'hidden' }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.name || user?.email || 'Account'}
              </div>
              <div style={{ fontSize: 10, color: C.textMuted }}>Sign out</div>
            </div>
          )}
        </button>

        {/* Collapse toggle */}
        <button
          onClick={toggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '8px', background: 'transparent', border: 'none', borderRadius: 8,
            cursor: 'pointer', color: C.textMuted, transition: 'all 0.15s', marginTop: 4,
          }}
          onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          {collapsed ? ICONS.chevronRight : ICONS.chevronLeft}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/Sidebar.jsx
git commit -m "feat: Sidebar component — collapsible 220px/52px, icons, role-based nav"
```

---

## Task 11: Strip GlobalHeader to TopBar

**Files:**
- Modify: `src/components/layout/GlobalHeader.jsx`

- [ ] **Step 1: Rewrite GlobalHeader as TopBar**

Replace the entire file content. The TopBar no longer renders nav tabs or secondary links — just sticky bar with notifications and avatar (sign-out only):

```jsx
// src/components/layout/GlobalHeader.jsx
import { useState } from 'react';
import { C, F, glass } from '../../design/tokens.js';
import NotificationBell from '../NotificationBell.jsx';

export function GlobalHeader({ user, onSignOut, active }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const initials = (user?.name || user?.email || 'U').slice(0, 2).toUpperCase();

  return (
    <header style={{
      height: 56, display: 'flex', alignItems: 'center',
      justifyContent: 'flex-end', padding: '0 20px', gap: 12,
      position: 'sticky', top: 0, zIndex: 50,
      ...glass, borderBottom: `1px solid rgba(0,0,0,0.07)`,
    }}>
      <NotificationBell />

      <div style={{ position: 'relative' }}>
        <button
          aria-label="Account menu"
          onClick={() => setMenuOpen(o => !o)}
          style={{
            width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
            color: '#fff', fontFamily: F.sans, fontSize: 12, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >{initials}</button>

        {menuOpen && (
          <>
            <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
            <div style={{
              position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 100,
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 6, minWidth: 160,
            }}>
              <div style={{ padding: '8px 12px', borderBottom: `1px solid ${C.border}`, marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.sans }}>
                  {user?.name || 'Account'}
                </div>
                <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 1 }}>
                  {user?.email}
                </div>
              </div>
              <button
                onClick={() => { setMenuOpen(false); onSignOut(); }}
                style={{
                  width: '100%', padding: '8px 12px', background: 'none', border: 'none',
                  textAlign: 'left', cursor: 'pointer', borderRadius: 6,
                  fontFamily: F.sans, fontSize: 13, color: C.red,
                }}
                onMouseEnter={e => e.currentTarget.style.background = C.redSoft}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >Sign out</button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/GlobalHeader.jsx
git commit -m "refactor: GlobalHeader stripped to TopBar (notifications + avatar only)"
```

---

## Task 12: AppShell — Two-Column Layout

**Files:**
- Modify: `src/components/layout/AppShell.jsx`

- [ ] **Step 1: Rewrite AppShell**

```jsx
// src/components/layout/AppShell.jsx
import { C, F } from '../../design/tokens.js';

export function AppShell({ sidebar, header, children, impersonating, onStopImpersonation }) {
  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {impersonating && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: C.purple, color: '#fff', height: 44,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
          fontFamily: F.sans, fontSize: 13, fontWeight: 500,
        }}>
          <span>👁 Viewing as {impersonating.name}</span>
          <button onClick={onStopImpersonation} style={{
            padding: '4px 14px', borderRadius: 20, border: '2px solid rgba(255,255,255,0.5)',
            background: 'transparent', color: '#fff', cursor: 'pointer',
            fontFamily: F.sans, fontSize: 12, fontWeight: 600,
          }}>Exit</button>
        </div>
      )}
      <div style={{
        display: 'flex',
        minHeight: '100vh',
        paddingTop: impersonating ? 44 : 0,
      }}>
        {sidebar}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {header}
          <main style={{ flex: 1, maxWidth: 1200, width: '100%', margin: '0 auto', padding: '28px 28px 60px' }}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/AppShell.jsx
git commit -m "refactor: AppShell two-column layout (sidebar + content)"
```

---

## Task 13: Wire App.jsx — Sidebar, New Views, selectedScreenId

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add Sidebar import and selectedScreenId state**

At the top of `src/App.jsx`, add:

```jsx
import { Sidebar } from './components/layout/Sidebar.jsx';
```

Inside the `App` component, add `selectedScreenId` state alongside existing state:

```jsx
const [selectedScreenId, setSelectedScreenId] = useState(null);
```

- [ ] **Step 2: Add new view imports**

```jsx
import { ApprovalQueue }          from './views/operator/ApprovalQueue.jsx';
import { ScreenDetailView }       from './views/operator/ScreenDetail.jsx';
import { NotificationPrefsView }  from './views/shared/NotificationPrefsView.jsx';
```

- [ ] **Step 3: Add new routes in the view() function**

In the `view()` function inside App, add before the final fallback return:

For operator routes (inside the `role === 'operator'` / non-adv block):
```jsx
if (active === 'approval')       return <ApprovalQueue campaigns={campaigns} setCampaigns={setCampaigns} setDetail={c => setDetail(c)} />;
if (active === 'screen-detail')  return <ScreenDetailView screenId={selectedScreenId} onBack={() => navigate('screens')} profile={profile} />;
if (active === 'notif-prefs')    return <NotificationPrefsView />;
```

For advertiser routes, add:
```jsx
if (active === 'notif-prefs')    return <NotificationPrefsView />;
```

- [ ] **Step 4: Compute pendingCount**

After `campaigns` state is populated, derive:

```jsx
const pendingCount = campaigns.filter(c => c.status === 'pending_review').length;
```

- [ ] **Step 5: Replace AppShell render with sidebar**

In the return statement, replace the `header={<GlobalHeader ... />}` prop with `sidebar` and keep `header`:

```jsx
return (
  <AppShell
    impersonating={impersonating}
    onStopImpersonation={stopImpersonation}
    sidebar={
      <Sidebar
        active={active}
        setActive={navigate}
        isAdv={isAdv}
        user={displayUser}
        onSignOut={signOut}
        pendingCount={pendingCount}
      />
    }
    header={
      <GlobalHeader
        active={active}
        user={displayUser}
        onSignOut={signOut}
      />
    }
  >
    {loadError && (
      // ... existing loadError block unchanged ...
    )}
    <ErrorBoundary key={active}>
      <div className="fade-in">
        {view()}
      </div>
    </ErrorBoundary>
  </AppShell>
);
```

- [ ] **Step 6: Expose setSelectedScreenId to Screens view**

In `view()`, update the Screens route:

```jsx
if (active === 'screens') return (
  <ScreensView
    dbScreens={dbScreens}
    setDbScreens={setDbScreens}
    profile={profile}
    loading={dataLoading}
    onSelectScreen={id => { setSelectedScreenId(id); navigate('screen-detail'); }}
  />
);
```

- [ ] **Step 7: Verify**

Run `npm run dev`. The app should show the sidebar on the left, TopBar on the right side top. All primary nav items should navigate correctly. Secondary items (Revenue, Audience, etc.) should also work. The Approval Queue badge should show the count of pending campaigns.

- [ ] **Step 8: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire sidebar nav, screen-detail routing, approval queue, notif-prefs"
```

---

## Task 14: Screens.jsx — Click-to-Detail Navigation

**Files:**
- Modify: `src/views/operator/Screens.jsx`

- [ ] **Step 1: Accept onSelectScreen prop in ScreensView**

In `src/views/operator/Screens.jsx`, update the `ScreensView` function signature:

```jsx
export function ScreensView({ dbScreens, setDbScreens, profile, loading = false, onSelectScreen }) {
```

- [ ] **Step 2: Wire screen card click to onSelectScreen**

Find where screen cards are rendered. The existing code shows an expandable `selected === screen.id` toggle. Replace the click handler so it calls `onSelectScreen` instead:

```jsx
// BEFORE (approximate — match your exact code):
onClick={() => setSelected(selected === screen.id ? null : screen.id)}

// AFTER:
onClick={() => onSelectScreen(screen.id)}
```

Remove the existing inline `ScreenDetail` expansion panel (the `{selected === screen.id && <ScreenDetail ... />}` block) from `ScreensView` — the full-page view replaces it.

- [ ] **Step 3: Verify**

Click a screen card — should navigate to screen-detail view (blank for now, wired in Task 15). Back button in that view returns to Screens.

- [ ] **Step 4: Commit**

```bash
git add src/views/operator/Screens.jsx
git commit -m "feat: screens click navigates to full-page ScreenDetail"
```

---

## Task 15: EditScreenModal

**Files:**
- Create: `src/components/screens/EditScreenModal.jsx`
- Modify: `src/views/operator/Screens.jsx` (remove any existing edit modal code)

- [ ] **Step 1: Create EditScreenModal**

```jsx
// src/components/screens/EditScreenModal.jsx
import { useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F } from '../../design/tokens.js';
import { Btn } from '../primitives/Btn.jsx';
import { Inp } from '../primitives/Inp.jsx';
import { SelInput } from '../primitives/SelInput.jsx';

export function EditScreenModal({ screen, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:                     screen.name || '',
    location:                 screen.location || '',
    city:                     screen.city || 'Toronto',
    display_size:             screen.display_size || '',
    cpm_floor:                screen.cpm_floor ?? screen.cpm ?? 3.00,
    monthly_traffic_estimate: screen.monthly_traffic_estimate || '',
    lat:                      screen.lat || '',
    lng:                      screen.lng || '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setErr(null);
    const { data, error } = await supabase
      .from('screens')
      .update({
        name:                     form.name.trim(),
        location:                 form.location.trim() || form.city,
        city:                     form.city,
        display_size:             form.display_size || null,
        cpm_floor:                parseFloat(form.cpm_floor) || 3.00,
        cpm:                      parseFloat(form.cpm_floor) || 3.00,
        monthly_traffic_estimate: form.monthly_traffic_estimate ? parseInt(form.monthly_traffic_estimate) : null,
        impressions:              form.monthly_traffic_estimate ? parseInt(form.monthly_traffic_estimate) * 1000 : screen.impressions,
        lat:                      form.lat ? parseFloat(form.lat) : null,
        lng:                      form.lng ? parseFloat(form.lng) : null,
      })
      .eq('id', screen.id)
      .select()
      .single();

    if (error) { setErr(error.message); setSaving(false); return; }
    onSaved(data);
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div style={{ background: C.surface, borderRadius: 14, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', padding: 28, boxShadow: '0 24px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: F.sans }}>Edit Screen</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: C.textMuted, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          <Inp label="Screen Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <Inp label="Location / Address" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
          <SelInput label="City" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}>
            {['Toronto', 'London', 'Manchester', 'Birmingham', 'Vancouver', 'Edinburgh'].map(c => <option key={c}>{c}</option>)}
          </SelInput>
          <Inp label="Display Size" placeholder="e.g. 55 inch 4K" value={form.display_size} onChange={e => setForm(f => ({ ...f, display_size: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label="Latitude" type="number" step="any" value={form.lat} onChange={e => setForm(f => ({ ...f, lat: e.target.value }))} />
            <Inp label="Longitude" type="number" step="any" value={form.lng} onChange={e => setForm(f => ({ ...f, lng: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label="Monthly Footfall (thousands)" type="number" value={form.monthly_traffic_estimate} onChange={e => setForm(f => ({ ...f, monthly_traffic_estimate: e.target.value }))} />
            <Inp label="CPM Floor (£)" type="number" step="0.50" value={form.cpm_floor} onChange={e => setForm(f => ({ ...f, cpm_floor: e.target.value }))} />
          </div>
        </div>
        {err && <div style={{ fontSize: 12, color: C.red, fontFamily: F.sans, marginBottom: 12 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={save} disabled={!form.name || saving}>{saving ? 'Saving…' : 'Save Changes'}</Btn>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/screens/EditScreenModal.jsx
git commit -m "feat: EditScreenModal component"
```

---

## Task 16: ScreenDetail Full-Page View

**Files:**
- Create: `src/views/operator/ScreenDetail.jsx`

- [ ] **Step 1: Create the view**

```jsx
// src/views/operator/ScreenDetail.jsx
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase.js';
import { SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js';
import { C, F } from '../../design/tokens.js';
import { Card } from '../../components/primitives/Card.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { Badge } from '../../components/primitives/Badge.jsx';
import { KPI } from '../../components/primitives/KPI.jsx';
import { Table } from '../../components/primitives/Table.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { UptimeGrid } from '../../components/shared/UptimeGrid.jsx';
import { EditScreenModal } from '../../components/screens/EditScreenModal.jsx';

function startStripeConnect(setConnecting) {
  setConnecting(true);
  const state = crypto.randomUUID();
  sessionStorage.setItem('stripe_connect_state', state);
  supabase.auth.getSession().then(({ data: { session } }) => {
    fetch(`${SUPABASE_FUNCTIONS_URL}/create-connect-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ returnUrl: window.location.origin, state }),
    })
      .then(r => r.json())
      .then(({ url }) => { window.location.href = url; })
      .catch(e => { sessionStorage.removeItem('stripe_connect_state'); setConnecting(false); console.error(e); });
  });
}

export function ScreenDetailView({ screenId, onBack, profile }) {
  const [screen, setScreen]               = useState(null);
  const [heartbeats, setHeartbeats]       = useState([]);
  const [campaigns, setCampaigns]         = useState([]);
  const [loading, setLoading]             = useState(true);
  const [editOpen, setEditOpen]           = useState(false);
  const [connecting, setConnecting]       = useState(false);

  useEffect(() => {
    if (!screenId) return;
    const since = new Date();
    since.setDate(since.getDate() - 7);

    Promise.all([
      supabase.from('screens').select('*').eq('id', screenId).single(),
      supabase.from('display_heartbeats').select('created_at').eq('screen_id', screenId).gte('created_at', since.toISOString()),
      supabase.from('bookings').select('id, advertiser_name, status, budget, start_date, end_date, impressions, scans, payment_status').eq('screen_id', screenId).order('created_at', { ascending: false }),
    ]).then(([scrRes, hbRes, campRes]) => {
      setScreen(scrRes.data);
      setHeartbeats(hbRes.data ?? []);
      setCampaigns(campRes.data ?? []);
      setLoading(false);
    });
  }, [screenId]);

  const { uptimePct, hourlyGrid } = useMemo(() => {
    const now = new Date();
    const buckets = new Set();
    for (const hb of heartbeats) {
      const hoursAgo = Math.floor((now - new Date(hb.created_at)) / 3600000);
      if (hoursAgo < 168) buckets.add(167 - hoursAgo);
    }
    const grid = Array.from({ length: 168 }, (_, i) => buckets.has(i) ? 1 : 0);
    const pct = heartbeats.length > 0 ? Math.min(100, (buckets.size / 168) * 100).toFixed(1) : null;
    return { uptimePct: pct, hourlyGrid: grid };
  }, [heartbeats]);

  if (loading || !screen) {
    return (
      <div>
        <Skeleton height={32} radius={8} style={{ width: 240, marginBottom: 8 }} />
        <Skeleton height={18} radius={6} style={{ width: 180, marginBottom: 28 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
          {[0,1,2,3].map(i => <Skeleton key={i} height={90} radius={12} />)}
        </div>
        <Skeleton height={180} radius={12} style={{ marginBottom: 20 }} />
      </div>
    );
  }

  const activeCampaigns = campaigns.filter(c => ['active','scheduled'].includes(c.status));
  const pastCampaigns   = campaigns.filter(c => !['active','scheduled'].includes(c.status));
  const totalRevenue    = campaigns.reduce((a, c) => a + (c.budget || 0), 0);
  const avgCPM          = screen.cpm?.toFixed(2) ?? '—';

  const CAMPAIGN_COLS = [
    { key: 'advertiser_name', label: 'Advertiser', render: v => <span style={{ fontWeight: 500, color: C.text, fontFamily: F.sans }}>{v}</span> },
    { key: 'status',          label: 'Status',     render: v => <Badge status={v} /> },
    { key: 'budget',          label: 'Budget',     render: v => <span style={{ fontFamily: F.mono, fontWeight: 600 }}>£{(v||0).toLocaleString()}</span> },
    { key: 'impressions',     label: 'Impressions',render: v => <span style={{ fontFamily: F.mono }}>{v ? `${(v/1000).toFixed(1)}K` : '—'}</span> },
    { key: 'start_date',      label: 'Dates',      render: (v, r) => <span style={{ fontFamily: F.mono, fontSize: 11, color: C.textSub }}>{v} → {r.end_date}</span> },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textSub, fontFamily: F.sans, fontSize: 12, padding: 0, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            ← Back to Screens
          </button>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.text, fontFamily: F.sans }}>{screen.name}</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: C.textSub, fontFamily: F.sans }}>{screen.location} · {screen.city}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Badge status={screen.status} />
          <Btn variant="secondary" size="sm" onClick={() => setEditOpen(true)}>✏ Edit</Btn>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        <KPI label="Total Revenue"    value={`£${totalRevenue.toLocaleString()}`} sub="all campaigns" color={C.green} />
        <KPI label="Active Campaigns" value={activeCampaigns.length} sub={`${campaigns.length} total`} />
        <KPI label="7-Day Uptime"     value={uptimePct !== null ? `${uptimePct}%` : '—'} sub={uptimePct !== null ? 'from heartbeats' : 'no data'} color={uptimePct > 95 ? C.green : uptimePct > 80 ? C.amber : C.red} />
        <KPI label="CPM"              value={`£${avgCPM}`} sub="per 1,000 impressions" />
      </div>

      {/* Uptime grid */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 14 }}>
          7-Day Uptime
          {heartbeats.length === 0 && <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 400, marginLeft: 8 }}>(no heartbeat data)</span>}
        </div>
        <UptimeGrid hourly={hourlyGrid} />
      </Card>

      {/* Payout setup */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 12 }}>Payout Setup</div>
        {profile?.connect_status === 'active' ? (
          <div style={{ padding: '10px 12px', background: C.greenSoft, border: `1px solid ${C.greenBorder}`, borderRadius: 8, fontSize: 12, color: C.green, fontFamily: F.sans }}>
            ✓ Stripe Connect active — payouts enabled
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans }}>Connect Stripe to receive ad revenue payouts.</div>
            <Btn size="sm" disabled={connecting} onClick={() => startStripeConnect(setConnecting)}>
              {connecting ? 'Redirecting…' : 'Connect Stripe'}
            </Btn>
          </div>
        )}
      </Card>

      {/* Active campaigns */}
      <Card style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans }}>
          Active Campaigns
          <span style={{ fontSize: 12, fontWeight: 400, color: C.textMuted, marginLeft: 8 }}>{activeCampaigns.length}</span>
        </div>
        {activeCampaigns.length === 0 ? (
          <div style={{ padding: '28px 20px', textAlign: 'center', color: C.textMuted, fontSize: 13, fontFamily: F.sans }}>No active campaigns</div>
        ) : (
          <Table columns={CAMPAIGN_COLS} rows={activeCampaigns} />
        )}
      </Card>

      {/* Campaign history */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans }}>
          Campaign History
          <span style={{ fontSize: 12, fontWeight: 400, color: C.textMuted, marginLeft: 8 }}>{pastCampaigns.length} past</span>
        </div>
        {pastCampaigns.length === 0 ? (
          <div style={{ padding: '28px 20px', textAlign: 'center', color: C.textMuted, fontSize: 13, fontFamily: F.sans }}>No past campaigns</div>
        ) : (
          <Table columns={CAMPAIGN_COLS} rows={pastCampaigns} />
        )}
      </Card>

      {editOpen && (
        <EditScreenModal
          screen={screen}
          onClose={() => setEditOpen(false)}
          onSaved={updated => setScreen(updated)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Click a screen in the Screens list — should navigate to the full-page ScreenDetail. KPIs, uptime grid, and campaign tables should render. Edit button should open the EditScreenModal. Back link should return to Screens.

- [ ] **Step 3: Commit**

```bash
git add src/views/operator/ScreenDetail.jsx
git commit -m "feat: ScreenDetail full-page view with uptime, campaigns, edit modal"
```

---

## Task 17: Notification Preferences — DB Migration

**Files:**
- Create: `supabase/migrations/20260520000000_add_notification_prefs.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/20260520000000_add_notification_prefs.sql
alter table profiles
  add column if not exists notification_prefs jsonb not null default '{}'::jsonb;

comment on column profiles.notification_prefs is
  'Per-event notification toggles. Schema: { event_key: { inApp: bool, email: bool } }';
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db push
```

Expected output: migration applies cleanly, `profiles` table now has `notification_prefs` column.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260520000000_add_notification_prefs.sql
git commit -m "feat: add notification_prefs JSONB column to profiles"
```

---

## Task 18: NotificationPrefsView

**Files:**
- Create: `src/views/shared/NotificationPrefsView.jsx`

- [ ] **Step 1: Create the view**

```jsx
// src/views/shared/NotificationPrefsView.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F } from '../../design/tokens.js';
import { Card } from '../../components/primitives/Card.jsx';
import { useToast } from '../../components/primitives/Toast.jsx';

const EVENTS = [
  { key: 'campaign_approved', label: 'Campaign approved',   defaultInApp: true,  defaultEmail: true },
  { key: 'campaign_rejected', label: 'Campaign rejected',   defaultInApp: true,  defaultEmail: true },
  { key: 'scan_spike',        label: 'Scan spike detected', defaultInApp: true,  defaultEmail: false },
  { key: 'payout_processed',  label: 'Payout processed',   defaultInApp: true,  defaultEmail: true },
  { key: 'new_advertiser',    label: 'New advertiser',      defaultInApp: true,  defaultEmail: false },
];

function defaultPrefs() {
  return Object.fromEntries(
    EVENTS.map(e => [e.key, { inApp: e.defaultInApp, email: e.defaultEmail }])
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
        background: checked ? C.purple : C.border,
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: checked ? 18 : 2,
        width: 16, height: 16, borderRadius: '50%', background: '#fff',
        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        display: 'block',
      }} />
    </button>
  );
}

export function NotificationPrefsView() {
  const [prefs, setPrefs] = useState(null);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      supabase.from('profiles').select('notification_prefs').eq('id', user.id).single()
        .then(({ data }) => {
          const stored = data?.notification_prefs ?? {};
          const merged = { ...defaultPrefs(), ...stored };
          setPrefs(merged);
          setLoading(false);
        });
    });
  }, []);

  const toggle = async (eventKey, channel) => {
    const next = { ...prefs, [eventKey]: { ...prefs[eventKey], [channel]: !prefs[eventKey][channel] } };
    setPrefs(next);
    const { error } = await supabase.from('profiles').update({ notification_prefs: next }).eq('id', userId);
    if (error) {
      toast.error('Failed to save preference');
      setPrefs(prefs); // revert
    }
  };

  if (loading) return <div style={{ padding: 40, color: C.textSub, fontFamily: F.sans, fontSize: 13 }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.text, fontFamily: F.sans }}>Notification Preferences</h2>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: C.textSub, fontFamily: F.sans }}>Choose how you want to be notified for each event.</p>
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {/* Header row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', padding: '12px 20px', borderBottom: `1px solid ${C.border}`, background: C.surfaceAlt }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.textSub, fontFamily: F.sans }}>Event</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.textSub, fontFamily: F.sans, textAlign: 'center' }}>In-app</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.textSub, fontFamily: F.sans, textAlign: 'center' }}>Email</span>
        </div>

        {EVENTS.map((event, i) => (
          <div
            key={event.key}
            style={{
              display: 'grid', gridTemplateColumns: '1fr 80px 80px',
              padding: '14px 20px', alignItems: 'center',
              borderBottom: i < EVENTS.length - 1 ? `1px solid ${C.border}` : 'none',
            }}
          >
            <span style={{ fontSize: 13, color: C.text, fontFamily: F.sans }}>{event.label}</span>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Toggle checked={prefs[event.key]?.inApp ?? true}  onChange={() => toggle(event.key, 'inApp')} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Toggle checked={prefs[event.key]?.email ?? false} onChange={() => toggle(event.key, 'email')} />
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Navigate to "Notification Prefs" via sidebar bottom — toggle grid should render. Toggling a switch should update instantly and persist on page refresh.

- [ ] **Step 3: Commit**

```bash
git add src/views/shared/NotificationPrefsView.jsx
git commit -m "feat: NotificationPrefsView with per-event in-app/email toggles"
```

---

## Task 19: Approval Queue View

**Files:**
- Create: `src/views/operator/ApprovalQueue.jsx`

- [ ] **Step 1: Create the view**

```jsx
// src/views/operator/ApprovalQueue.jsx
import { C, F } from '../../design/tokens.js';
import { Card } from '../../components/primitives/Card.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { ApproveBtn } from '../../lib/campaignActions.js';
import { useConfirm } from '../../components/primitives/ConfirmModal.jsx';
import { supabase } from '../../lib/supabase.js';

function CampaignCard({ campaign, setCampaigns, setDetail }) {
  const confirm = useConfirm();

  const reject = async e => {
    e.preventDefault();
    const ok = await confirm({
      title: 'Reject campaign?',
      message: `This will reject "${campaign.advertiser}" and notify them. This cannot be undone.`,
      confirmLabel: 'Reject',
      danger: true,
    });
    if (!ok) return;
    await supabase.from('bookings').update({ status: 'rejected' }).eq('id', campaign.id);
    setCampaigns(prev => prev.map(x => x.id === campaign.id ? { ...x, status: 'rejected' } : x));
  };

  return (
    <Card style={{ marginBottom: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.text, fontFamily: F.sans }}>{campaign.advertiser}</span>
            <span style={{ fontSize: 10, background: C.amber, color: '#fff', padding: '2px 7px', borderRadius: 10, fontFamily: F.sans, fontWeight: 600 }}>PENDING</span>
          </div>
          <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginBottom: 10 }}>
            {campaign.category} · {campaign.screen} · {campaign.city}
          </div>

          {/* Creative preview */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: C.surfaceAlt, border: `1px solid ${C.border}`,
            borderRadius: 8, padding: '8px 12px', marginBottom: 10,
          }}>
            <div style={{ width: 16, height: 16, borderRadius: 3, background: campaign.color || C.purple, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.text, fontFamily: F.sans }}>{campaign.headline || '(no headline)'}</div>
              <div style={{ fontSize: 10, color: C.textSub, fontFamily: F.sans }}>{campaign.cta || ''}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>Budget</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.mono }}>£{campaign.budget?.toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>Dates</div>
              <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.mono }}>{campaign.start} → {campaign.end}</div>
            </div>
            {campaign.destination && (
              <div>
                <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>URL</div>
                <div style={{ fontSize: 11, color: C.purple, fontFamily: F.mono, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{campaign.destination}</div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
          <ApproveBtn campaign={campaign} setCampaigns={setCampaigns} />
          <Btn variant="danger" size="sm" onClick={reject}>✗ Reject</Btn>
          <Btn variant="secondary" size="sm" onClick={() => setDetail(campaign)}>View Details</Btn>
        </div>
      </div>
    </Card>
  );
}

export function ApprovalQueue({ campaigns, setCampaigns, setDetail }) {
  const pending = campaigns.filter(c => c.status === 'pending_review');

  return (
    <div>
      <PageHeader
        title="Approval Queue"
        subtitle={pending.length === 0
          ? 'No campaigns pending review'
          : `${pending.length} campaign${pending.length === 1 ? '' : 's'} pending review`}
      />

      {pending.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '64px 24px',
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 6 }}>All clear</div>
          <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans }}>No campaigns are waiting for review.</div>
        </div>
      ) : (
        pending.map(c => (
          <CampaignCard
            key={c.id}
            campaign={c}
            setCampaigns={setCampaigns}
            setDetail={setDetail}
          />
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Navigate to "Approval Queue" via sidebar. Should show pending campaigns as cards with Approve/Reject/View Details actions. With no pending campaigns, shows the "All clear" empty state. Approve button charges Stripe and moves campaign to `scheduled`. Reject button prompts confirm modal then sets status to `rejected`.

- [ ] **Step 3: Commit**

```bash
git add src/views/operator/ApprovalQueue.jsx
git commit -m "feat: ApprovalQueue view with approve/reject per-campaign cards"
```

---

## Self-Review Checklist

After all tasks are complete, verify:

- [ ] Sidebar collapse toggle persists across page reload (check localStorage `sidebar_collapsed`)
- [ ] Approval Queue badge count updates when a campaign is approved or rejected (campaigns state is shared)
- [ ] `screen-detail` route only renders when `selectedScreenId` is set — clicking a screen must set it before navigating
- [ ] EditScreenModal `onSaved` updates local `screen` state without full page reload
- [ ] Notification prefs default values apply for new users who have no `notification_prefs` stored
- [ ] Date range filter `'custom'` option only queries when both `customFrom` and `customTo` are set
- [ ] `AdvDashboard` imports `useBreakpoint` — verify it's not already imported under a different name
- [ ] All new view files are imported in `App.jsx` before they're referenced in `view()`
