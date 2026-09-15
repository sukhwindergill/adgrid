# Approval Queue Campaign Preview Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the ApprovalQueue card to surface creative preview + destination URL + earnings upfront, pushing all secondary detail behind "View Details".

**Architecture:** Single file change to `src/views/operator/ApprovalQueue.jsx`. Add a `SCREEN_OWNER_SHARE` constant and `earningsDisplay` helper, then strip `CampaignCard`'s body down to: creative preview column + 3-fact column (URL, budget+earnings, dates) + actions column. All `InfoRow` detail fields remain in the existing detail panel only.

**Tech Stack:** React, inline styles, existing design tokens (`C`, `F` from `../../design/tokens.js`), existing primitives (`Card`, `Btn`, `ApproveBtn`)

---

## File Map

| File | Action |
|---|---|
| `src/views/operator/ApprovalQueue.jsx` | Modify — rewrite `CampaignCard` body, add `SCREEN_OWNER_SHARE` + `earningsDisplay` |

---

### Task 1: Add revenue split constant and helper

**Files:**
- Modify: `src/views/operator/ApprovalQueue.jsx`

- [ ] **Step 1: Open the file and locate the top of the module** (after the imports, before `CreativePreview`)

- [ ] **Step 2: Add the constant and helper immediately after the import block**

```jsx
// TODO: make SCREEN_OWNER_SHARE configurable per screen/tier when pricing model is finalised
const SCREEN_OWNER_SHARE = 0.70;

function earningsDisplay(budget) {
  if (!budget) return null;
  return `~£${Math.round(budget * SCREEN_OWNER_SHARE).toLocaleString()}`;
}
```

- [ ] **Step 3: Verify the file still parses** — run the dev server (`npm run dev`) and confirm no console errors. No visual change expected yet.

- [ ] **Step 4: Commit**

```bash
git add src/views/operator/ApprovalQueue.jsx
git commit -m "feat: add SCREEN_OWNER_SHARE constant and earningsDisplay helper"
```

---

### Task 2: Rewrite CampaignCard body

**Files:**
- Modify: `src/views/operator/ApprovalQueue.jsx` — `CampaignCard` component (lines ~89–171)

The current body uses a 3-column grid: `280px creative | 1fr details | auto actions`. We keep that grid but replace the middle column's content.

- [ ] **Step 1: Replace the entire `{/* Body */}` div inside `CampaignCard`**

Find this opening line:
```jsx
{/* Body: creative + details + actions */}
<div style={{ display: 'grid', gridTemplateColumns: '280px 1fr auto', gap: 0 }}>
```

Replace everything from that line through the closing `</div>` that ends the grid (just before the final `</Card>`) with:

```jsx
{/* Body: creative + quick facts + actions */}
<div style={{ display: 'grid', gridTemplateColumns: '280px 1fr auto', gap: 0 }}>

  {/* Creative preview */}
  <div style={{ padding: 14, borderRight: `1px solid ${C.border}` }}>
    <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Creative Preview</div>
    <CreativePreview campaign={campaign} />
  </div>

  {/* Quick facts */}
  <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'center' }}>
    {campaign.destination ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Destination</div>
        <a
          href={campaign.destination} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 13, color: C.purple, fontFamily: F.mono, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}
        >{campaign.destination}</a>
      </div>
    ) : (
      <div style={{ fontSize: 11, color: C.amber, fontFamily: F.sans }}>⚠ No destination URL</div>
    )}

    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Budget</div>
        <div style={{ fontSize: 12, fontWeight: 500, color: C.text, fontFamily: F.mono }}>
          {campaign.budget ? `£${campaign.budget.toLocaleString()}` : '—'}
        </div>
      </div>
      {earningsDisplay(campaign.budget) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans, textTransform: 'uppercase', letterSpacing: '0.5px' }}>You Earn</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.purple, fontFamily: F.mono }}>{earningsDisplay(campaign.budget)}</div>
        </div>
      )}
    </div>

    {(campaign.start || campaign.end) && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontSize: 10, color: C.textMuted, fontFamily: F.sans, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dates</div>
        <div style={{ fontSize: 12, fontWeight: 500, color: C.text, fontFamily: F.mono }}>{campaign.start} – {campaign.end}</div>
      </div>
    )}
  </div>

  {/* Actions */}
  <div style={{
    padding: '14px 16px', borderLeft: `1px solid ${C.border}`,
    display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center', alignItems: 'stretch',
    minWidth: 130,
  }}>
    <ApproveBtn campaign={campaign} setCampaigns={setCampaigns} />
    <Btn variant="danger" size="sm" onClick={reject}>✗ Reject</Btn>
    <Btn variant="secondary" size="sm" onClick={() => setDetail(campaign)}>View Details →</Btn>
  </div>
</div>
```

- [ ] **Step 2: Save and verify dev server has no errors**

Run: `npm run dev` (or check running server). Open Approval Queue in browser. Confirm:
- Card shows creative preview on left
- Middle column shows destination URL (clickable), budget, "You Earn" in purple, and date range
- Right column has Approve / Reject / View Details buttons
- No detail rows (screen, city, category, headline, CTA) visible on the card itself
- "View Details →" still opens the detail panel correctly

- [ ] **Step 3: Commit**

```bash
git add src/views/operator/ApprovalQueue.jsx
git commit -m "feat: redesign approval queue card with quick-decision layout and earnings display"
```

---

### Task 3: Verify end-to-end flow

- [ ] **Step 1: Check approve flow** — click ✓ Approve on a pending campaign. Confirm it clears from the queue.

- [ ] **Step 2: Check reject flow** — click ✗ Reject. Confirm the confirmation modal appears with correct advertiser name. Confirm rejection removes it from queue.

- [ ] **Step 3: Check View Details** — click View Details →. Confirm detail panel opens and shows all the fields that were removed from the card (headline, CTA, screen, city, category).

- [ ] **Step 4: Check empty state** — if no pending campaigns, confirm "All clear" empty state still renders correctly.

- [ ] **Step 5: Check earnings math** — for a campaign with `budget: 1000`, "You Earn" should display `~£700`. For `budget: 2400`, should display `~£1,680`.
