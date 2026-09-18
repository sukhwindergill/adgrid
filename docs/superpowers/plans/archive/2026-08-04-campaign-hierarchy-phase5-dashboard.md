# Campaign Hierarchy — Phase 5: Dashboard & "+ Add Targeting Group" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Group the flat campaign list into an accordion by parent `campaigns` row (single-Targeting-group campaigns render as an unchanged single row), and add a "+ Add Targeting Group" action that reuses Phase 3's wizard scoped to an existing campaign, so an advertiser can add a second targeting group (e.g. "Westside Gyms" alongside an existing "Downtown Malls") without creating a whole new campaign.

**Architecture:** `src/views/operator/Campaigns.jsx` (shared by both the advertiser and operator campaign-list routes — confirmed by reading `src/App.jsx`, both routes render the same component) already fetches `campaign_screens` per booking; this phase adds one more fetch (the parent `campaigns` rows) and a pure grouping/rollup module, then extracts the existing per-row JSX into its own component so it's reused unmodified for both the flat and nested-in-accordion cases. The "+ Add Targeting Group" flow reuses the exact `CreateCampaign` wizard from Phase 3 with one new optional prop rather than building a second creation flow.

**Tech Stack:** Same as prior phases — React 19, vitest, no new libraries.

**Naming collision, called out explicitly:** the app's existing global state variable is named `campaigns` (in `App.jsx`) and holds **booking/Targeting-tier rows** — a legacy artifact from before this restructure. This phase introduces the actual `campaigns` (parent) **table**. To keep this readable, every variable in this plan that refers to the new parent table is named `campaignParents` or similar — never a bare `campaigns` — so it's never confused with the existing booking-list variable of the same name.

---

### Task 1: Operator read access to the parent `campaigns` table

**Files:**
- Create: `supabase/migrations/20260804000000_campaigns_operator_read.sql`

Phase 1's RLS (Task 4) only gave advertisers access to the parent `campaigns` table. The operator-facing campaign list (Task 3 below) also needs to read a campaign's `name` to label a group, for any campaign that has a booking targeting one of the operator's screens.

- [ ] **Step 1: Write the migration**

```sql
-- Operators need to read a campaign's name to label a grouped row in their
-- own campaign list, for any campaign with a booking targeting one of their
-- screens. Mirrors the ownership-chain pattern used throughout this feature.
CREATE POLICY "operator_read_relevant_campaigns" ON campaigns
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bookings
      JOIN campaign_screens ON campaign_screens.campaign_id = bookings.id
      JOIN screens ON screens.id = campaign_screens.screen_id
      WHERE bookings.campaign_id = campaigns.id
        AND screens.operator_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Apply and verify**

Run:
```bash
supabase db push
```

```sql
SELECT policyname FROM pg_policies WHERE tablename = 'campaigns' ORDER BY policyname;
```
Expected: 4 policies now — the 3 advertiser ones from Phase 1 plus `operator_read_relevant_campaigns`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260804000000_campaigns_operator_read.sql
git commit -m "feat: grant operators read access to relevant parent campaigns"
```

---

### Task 2: `src/lib/campaignRollup.js` — pure grouping and aggregation

**Files:**
- Create: `src/lib/campaignRollup.js`
- Create: `src/lib/campaignRollup.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// src/lib/campaignRollup.test.js
import { describe, it, expect } from 'vitest';
import { groupByCampaignId, rollupGroup } from './campaignRollup.js';

describe('groupByCampaignId', () => {
  it('groups bookings sharing the same campaign_id together', () => {
    const bookings = [
      { id: 'b1', campaign_id: 'c1' },
      { id: 'b2', campaign_id: 'c1' },
      { id: 'b3', campaign_id: 'c2' },
    ];
    const groups = groupByCampaignId(bookings);
    expect(groups.get('c1')).toHaveLength(2);
    expect(groups.get('c2')).toHaveLength(1);
    expect(groups.size).toBe(2);
  });

  it('falls back to the booking\'s own id as its group key when campaign_id is missing', () => {
    const bookings = [{ id: 'b1', campaign_id: null }];
    const groups = groupByCampaignId(bookings);
    expect(groups.get('b1')).toEqual(bookings);
  });

  it('returns an empty map for an empty list', () => {
    expect(groupByCampaignId([]).size).toBe(0);
  });
});

describe('rollupGroup', () => {
  it('sums budget, spent, impressions, and scans across the group', () => {
    const group = [
      { budget: 100, spent: 40, impressions: 1000, scans: 5 },
      { budget: 50, spent: 10, impressions: 500, scans: 2 },
    ];
    expect(rollupGroup(group)).toEqual({ budget: 150, spent: 50, impressions: 1500, scans: 7 });
  });

  it('treats missing numeric fields as zero rather than NaN', () => {
    const group = [{ budget: 100 }, { spent: 5 }];
    expect(rollupGroup(group)).toEqual({ budget: 100, spent: 5, impressions: 0, scans: 0 });
  });

  it('returns all zeros for an empty group', () => {
    expect(rollupGroup([])).toEqual({ budget: 0, spent: 0, impressions: 0, scans: 0 });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run:
```bash
npx vitest run src/lib/campaignRollup.test.js
```
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write the implementation**

```js
// src/lib/campaignRollup.js
//
// Pure grouping/aggregation for the accordion campaign list. No DOM, no
// network -- same shape as creativeFit.js and creativeAssignment.js.

export function groupByCampaignId(bookings) {
  const groups = new Map();
  for (const b of bookings) {
    // A booking created before Phase 1's backfill logic ran, or by any path
    // that somehow skipped it, gets its own singleton group rather than
    // being silently dropped -- every booking must appear somewhere in the list.
    const key = b.campaign_id ?? b.id;
    const list = groups.get(key) ?? [];
    list.push(b);
    groups.set(key, list);
  }
  return groups;
}

export function rollupGroup(bookings) {
  return {
    budget: bookings.reduce((a, b) => a + (b.budget || 0), 0),
    spent: bookings.reduce((a, b) => a + (b.spent || 0), 0),
    impressions: bookings.reduce((a, b) => a + (b.impressions || 0), 0),
    scans: bookings.reduce((a, b) => a + (b.scans || 0), 0),
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run:
```bash
npx vitest run src/lib/campaignRollup.test.js
```
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/campaignRollup.js src/lib/campaignRollup.test.js
git commit -m "feat: add pure campaign grouping/rollup module"
```

---

### Task 3: Accordion in `Campaigns.jsx`

**Files:**
- Create: `src/views/operator/CampaignRow.jsx`
- Modify: `src/views/operator/Campaigns.jsx`

Extracts today's per-booking row (lines 218-274 of the current file) into its own component, then groups the list by `campaign_id`. A group of exactly one booking renders that one `CampaignRow` directly — identical markup to today, no accordion chrome. A group of 2+ renders a new parent header row (name, aggregate budget/impressions/scans, expand toggle) with each booking's `CampaignRow` nested beneath when expanded.

- [ ] **Step 1: Create `CampaignRow.jsx`** (verbatim extraction of the existing per-booking row, unchanged behavior)

```jsx
// src/views/operator/CampaignRow.jsx
import { supabase } from '../../lib/supabase.js';
import { C, F } from '../../design/tokens.js';
import { Badge } from '../../components/primitives/Badge.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { ProgressBar } from '../../components/primitives/ProgressBar.jsx';
import { ApproveBtn } from '../../lib/campaignActions.jsx';

export function CampaignRow({ c, screenCount, displayCity, isMobile, allowCancel, setDetail, setCampaigns }) {
  const pct = c.budget > 0 ? Math.round((c.spent / c.budget) * 100) : 0;
  const isPending = c.status === 'pending_review';
  // The partially_approved derivation needs campaignScreens data, which this
  // component doesn't have -- Campaigns.jsx computes it per booking and
  // passes the result as c.badgeStatus (see Task 3 Step 3).
  const badgeStatus = c.badgeStatus ?? c.status;

  return (
    <div
      onClick={e => { if (!e.defaultPrevented) setDetail(c); }}
      style={{
        background: isPending ? C.amberSoft : C.surface,
        border: `1px solid ${isPending ? C.amberBorder : C.border}`,
        borderRadius: 12, padding: '16px 20px', cursor: 'pointer', transition: 'all 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = isPending ? C.amber : C.purpleBorder; e.currentTarget.style.boxShadow = '0 4px 12px rgba(124,58,237,0.08)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = isPending ? C.amberBorder : C.border; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 180px 120px 80px 110px 110px', gap: 16, alignItems: 'start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <div style={{ fontWeight: 600, color: C.text, fontFamily: F.sans }}>{c.advertiser}</div>
            {isPending && <span style={{ fontSize: 10, background: C.amber, color: '#fff', padding: '1px 6px', borderRadius: 10, fontFamily: F.sans, fontWeight: 600 }}>REVIEW</span>}
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans }}>{c.category} · {screenCount} screens · {displayCity}</div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.text, fontFamily: F.mono }}>${c.spent.toLocaleString()}</span>
            <span style={{ fontSize: 12, color: C.textMuted, fontFamily: F.mono }}>${c.budget.toLocaleString()}</span>
          </div>
          <ProgressBar value={c.spent} max={c.budget} height={4} />
          <div style={{ fontSize: 10, color: pct > 90 ? C.red : pct > 70 ? C.amber : C.textMuted, fontFamily: F.sans, marginTop: 2 }}>{pct}% used</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: F.mono, fontSize: 14, fontWeight: 600, color: C.text }}>{(c.impressions / 1000).toFixed(1)}K</div>
          <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>impressions</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: F.mono, fontSize: 14, fontWeight: 600, color: C.purple }}>{c.scans}</div>
          <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>scans</div>
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 11, color: C.textSub, whiteSpace: 'nowrap' }}>{c.start} →<br />{c.end}</div>
        {isPending ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} onClick={e => e.preventDefault()}>
            <ApproveBtn campaign={c} setCampaigns={setCampaigns} />
            <Btn variant="danger" size="sm" onClick={e => { e.preventDefault(); e.stopPropagation(); setDetail(c); }}>✗ Reject…</Btn>
          </div>
        ) : allowCancel && (c.status === 'scheduled' || c.status === 'active') ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }} onClick={e => e.preventDefault()}>
            <Badge status={badgeStatus} />
            <Btn variant="danger" size="sm" onClick={async e => {
              e.preventDefault(); e.stopPropagation();
              if (!window.confirm(`Cancel campaign "${c.advertiser}"? This cannot be undone.`)) return;
              const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', c.id);
              if (!error) setCampaigns(prev => prev.map(x => x.id === c.id ? { ...x, status: 'cancelled' } : x));
            }}>✕ Cancel</Btn>
          </div>
        ) : (
          <Badge status={badgeStatus} />
        )}
      </div>
    </div>
  );
}
```

Note: `badgeStatus` (the `hasPending`/`hasApproved` → `'partially_approved'` derivation) is computed in `Campaigns.jsx`, since it needs `campaignScreens` data this component doesn't have — see Step 2, which threads it in as `c.badgeStatus`.

- [ ] **Step 2: Rewrite `Campaigns.jsx`'s list rendering**

Add the parent-campaign fetch alongside the existing `campaign_screens` fetch (after the existing `useEffect` at lines 22-75, which is unchanged):

```js
  const [campaignParents, setCampaignParents] = useState({}); // campaignParentId -> { id, name }

  useEffect(() => {
    const ids = [...new Set(campaigns.map(c => c.campaign_id).filter(Boolean))];
    if (ids.length === 0) { setCampaignParents({}); return; }
    supabase.from('campaigns').select('id, name').in('id', ids).then(({ data }) => {
      const byId = {};
      (data || []).forEach(row => { byId[row.id] = row; });
      setCampaignParents(byId);
    });
  }, [campaigns.map(c => c.campaign_id).join(',')]);

  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const toggleGroup = (id) => setExpandedGroups(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
```

Add the import at the top:
```js
import { groupByCampaignId, rollupGroup } from '../../lib/campaignRollup.js';
import { CampaignRow } from './CampaignRow.jsx';
```

Replace the `shown.map(c => { ... return (...) })` block (lines 196-275, everything inside the `<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>` wrapper) with:

```jsx
          {Array.from(groupByCampaignId(shown).entries()).map(([groupId, groupBookings]) => {
            const withBadge = groupBookings.map(c => {
              const screens = campaignScreens[c.id] || [];
              let badgeStatus = c.status;
              if (c.status === 'approved' || c.status === 'scheduled') {
                const hasPending = screens.some(s => s.status === 'pending');
                const hasApproved = screens.some(s => s.status === 'approved' || s.status === 'auto_approved');
                if (hasPending && hasApproved) badgeStatus = 'partially_approved';
              }
              const cities = [...new Set(screens.map(s => screenData[s.screen_id]?.city).filter(Boolean))];
              return { ...c, badgeStatus, screenCount: screens.length, displayCity: cities.length === 1 ? cities[0] : (c.city || '') };
            });

            if (withBadge.length === 1) {
              const c = withBadge[0];
              return (
                <CampaignRow key={c.id} c={c} screenCount={c.screenCount} displayCity={c.displayCity}
                  isMobile={isMobile} allowCancel={allowCancel} setDetail={setDetail} setCampaigns={setCampaigns} />
              );
            }

            const parentName = campaignParents[groupId]?.name || withBadge[0].advertiser;
            const rollup = rollupGroup(withBadge);
            const totalScreens = withBadge.reduce((a, c) => a + c.screenCount, 0);
            const expanded = expandedGroups.has(groupId);

            return (
              <div key={groupId} style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
                <div
                  onClick={() => toggleGroup(groupId)}
                  style={{ padding: '14px 20px', background: C.surfaceAlt, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div>
                    <div style={{ fontWeight: 700, color: C.text, fontFamily: F.sans }}>{expanded ? '▾' : '▸'} {parentName}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 2 }}>
                      {withBadge.length} targeting groups · {totalScreens} screens · ${rollup.spent.toLocaleString()} of ${rollup.budget.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 20 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: F.mono, fontSize: 13, fontWeight: 600, color: C.text }}>{(rollup.impressions / 1000).toFixed(1)}K</div>
                      <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>impressions</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: F.mono, fontSize: 13, fontWeight: 600, color: C.purple }}>{rollup.scans}</div>
                      <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans }}>scans</div>
                    </div>
                  </div>
                </div>
                {expanded && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: C.bg }}>
                    {withBadge.map(c => (
                      <CampaignRow key={c.id} c={c} screenCount={c.screenCount} displayCity={c.displayCity}
                        isMobile={isMobile} allowCancel={allowCancel} setDetail={setDetail} setCampaigns={setCampaigns} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
```

- [ ] **Step 3: Verify the app builds**

Run:
```bash
npm run build
```
Expected: clean build.

- [ ] **Step 4: Manual verification**

1. With a single-Targeting-group campaign (the common case today), confirm the list row is visually identical to before this task.
2. Create a 2nd Targeting group under an existing campaign (once Tasks 4-6 below are done) and confirm it now renders as a collapsed accordion header showing both groups' rolled-up totals, expanding to reveal both `CampaignRow`s unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/views/operator/Campaigns.jsx src/views/operator/CampaignRow.jsx
git commit -m "feat: group campaign list into an accordion by parent campaign"
```

---

### Task 4: "+ Add Targeting Group" action on `CampaignDetail`

**Files:**
- Modify: `src/views/operator/CampaignDetail.jsx:79-84`

- [ ] **Step 1: Add the prop and the button**

Change the function signature:
```js
export function CampaignDetail({ campaign, onBack, onUpdate, onAddTargeting }) {
```

Add the button to the `PageHeader`'s `actions`:
```jsx
      <PageHeader
        title={c.advertiser}
        subtitle={`${c.screen} · ${c.city} · ${c.category}`}
        back="All Campaigns" onBack={onBack}
        actions={<>
          {onAddTargeting && <Btn variant="secondary" size="sm" onClick={() => onAddTargeting(c)}>+ Add targeting group</Btn>}
          {statusAction(c.status)}
          <Btn variant="secondary" size="sm" onClick={() => setSharing(true)}>Share report</Btn>
          <Btn variant="secondary" size="sm" onClick={() => { setEditForm({ budget: c.budget, start: c.start, end: c.end }); setEditing(true); }}>✏ Edit</Btn>
        </>}
      />
```

The button only renders when `onAddTargeting` is passed — the operator-side use of `CampaignDetail` (Task 5 doesn't wire it there) never shows it, since adding a targeting group is an advertiser action.

- [ ] **Step 2: Commit**

```bash
git add src/views/operator/CampaignDetail.jsx
git commit -m "feat: add + Add targeting group action to campaign detail"
```

---

### Task 5: Wire `App.jsx` — advertiser-only entry point

**Files:**
- Modify: `src/App.jsx:331-347`

- [ ] **Step 1: Add state for which campaign is being added to**

Near the other `useState` declarations (alongside `detail`):
```js
  const [addingToCampaign, setAddingToCampaign] = useState(null); // { id, name } | null
```

- [ ] **Step 2: Wire the advertiser's `CampaignDetail` render to pass `onAddTargeting`**

The `CampaignDetail` render at line 331-333 is shared between advertiser and operator routes (`active === 'campaigns' || 'analytics' || 'adv-campaigns' || 'approval'`). Only pass `onAddTargeting` for the advertiser routes:

```jsx
    if (detail && (active === 'campaigns' || active === 'analytics' || active === 'adv-campaigns' || active === 'approval')) {
      const isAdvertiserDetail = active === 'adv-campaigns' || active === 'analytics';
      return (
        <CampaignDetail
          campaign={detail}
          onBack={() => setDetail(null)}
          onUpdate={updateCampaign}
          onAddTargeting={isAdvertiserDetail ? (c) => {
            setAddingToCampaign({ id: c.campaign_id, name: c.campaign_name || c.advertiser });
            navTo('adv-create');
          } : undefined}
        />
      );
    }
```

- [ ] **Step 3: Pass it to `CreateCampaign` and clear it on cancel/save**

Update the `adv-create` route:
```jsx
      if (active === 'adv-create')       return (
        <CreateCampaign
          dbScreens={dbScreens}
          campaigns={campaigns}
          existingCampaign={addingToCampaign}
          onSave={c => {
            setCampaigns(p => [c, ...p]);
            setAddingToCampaign(null);
            navTo('adv-campaigns');
          }}
          onCancel={() => { setAddingToCampaign(null); navTo('adv-overview'); }}
        />
      );
```

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire + Add targeting group entry point through App.jsx"
```

---

### Task 6: `CreateCampaign.jsx` accepts `existingCampaign`

**Files:**
- Modify: `src/views/advertiser/CreateCampaign.jsx`
- Modify: `src/views/advertiser/createCampaign/StepTargeting.jsx`

When `existingCampaign` is passed: skip the `campaigns` table insert entirely (use `existingCampaign.id` as `bookings.campaign_id` directly), and hide the campaign-name field in Targeting — it already has a name, chosen when the campaign was first created.

- [ ] **Step 1: Accept and thread the prop in `CreateCampaign.jsx`**

Change the export signature:
```js
export function CreateCampaign({ onSave, onCancel, dbScreens = [], campaigns = [], existingCampaign = null }) {
```

Pass it to `StepTargeting`:
```jsx
      {step === 0 && <StepTargeting form={form} setForm={setForm} reachSummary={reachSummary} allScreens={dbScreens} existingCampaign={existingCampaign} onPrevCampaigns={campaigns.length > 0 ? () => setShowDupModal(true) : null} />}
```

- [ ] **Step 2: Hide the name field in `StepTargeting.jsx` when adding to an existing campaign**

Change the signature:
```js
export function StepTargeting({ form, setForm, reachSummary, allScreens, existingCampaign, onPrevCampaigns }) {
```

Replace the campaign-name block:
```jsx
        {existingCampaign ? (
          <div style={{ marginBottom: 24, padding: '10px 14px', background: C.purpleSoft, borderRadius: 8, fontSize: 13, color: C.purple, fontFamily: F.sans }}>
            Adding a new targeting group to <strong>{existingCampaign.name}</strong>
          </div>
        ) : (
          <div style={{ marginBottom: 24 }}>
            <Inp
              label="Campaign name"
              placeholder="e.g. Summer Promo 2026"
              value={form.name}
              onChange={e => setField('name', e.target.value)}
            />
          </div>
        )}
```

- [ ] **Step 3: Update `handleSubmit` to skip the parent insert when adding to an existing campaign**

Replace the campaign-insert block:
```js
      let campaignParentId = existingCampaign?.id;
      if (!campaignParentId) {
        const { data: campaignRow, error: campaignErr } = await supabase
          .from('campaigns')
          .insert({ advertiser_id: user.id, name: form.name || 'Untitled Campaign' })
          .select('id')
          .single();
        if (campaignErr) throw new Error(campaignErr.message);
        campaignParentId = campaignRow.id;
      }
```

And change the `bookings` insert's `campaign_id` field:
```js
        campaign_id:           campaignParentId,
```

- [ ] **Step 4: Verify the app builds**

Run:
```bash
npm run build
```
Expected: clean build.

- [ ] **Step 5: Manual verification**

1. From a campaign's detail page, click "+ Add targeting group" — confirm the wizard opens with the purple "Adding a new targeting group to ..." banner instead of a name field, and no campaign-name input anywhere in the flow.
2. Complete the wizard with a different area/screens — confirm the new booking lands with `campaign_id` equal to the original campaign's parent id (no new `campaigns` row created), and the campaign list (Task 3) now shows this campaign as a 2-group accordion.
3. Confirm the normal "+ New Campaign" flow (no `existingCampaign`) is completely unchanged — name field present, new parent row created, single-row list entry as before.

- [ ] **Step 6: Commit**

```bash
git add src/views/advertiser/CreateCampaign.jsx src/views/advertiser/createCampaign/StepTargeting.jsx
git commit -m "feat: CreateCampaign supports adding a targeting group to an existing campaign"
```

---

## Phase 5 exit criteria

- [ ] Single-Targeting-group campaigns render identically to before this phase, everywhere (advertiser list, operator list, detail page).
- [ ] A campaign with 2+ Targeting groups renders as a collapsed-by-default accordion row with correct rolled-up totals, expanding to show each group's unchanged row.
- [ ] "+ Add targeting group" only appears on the advertiser's own campaign detail view, reuses the exact Phase 3 wizard, skips creating a redundant parent `campaigns` row, and hides the now-irrelevant campaign-name field.
- [ ] Operators can read the parent campaign name for any campaign touching their screens (new RLS policy), without gaining any write access to it.
- [ ] `npm run build` and `npm test` both pass.

This closes out the campaign hierarchy design end-to-end: Phase 1 (schema) → Phase 2 (weighted serving + attribution) → Phase 3 (wizard) → Phase 4 (approval queue) → Phase 5 (dashboard + multi-group entry point).
