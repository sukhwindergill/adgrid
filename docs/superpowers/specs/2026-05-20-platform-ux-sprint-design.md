# Platform UX Sprint — Design Spec
**Date:** 2026-05-20  
**Branch:** claude/gallant-raman-efbe8e  
**Scope:** Sidebar nav redesign + 7 UX fixes + 3 new views

---

## 1. Sidebar Navigation (Primary Deliverable)

### Layout Change
Replace the current `GlobalHeader` (60px horizontal nav) + `AppShell` layout with a two-column layout:
- **Left:** fixed `Sidebar` component (220px expanded / 52px collapsed)
- **Right:** vertical stack of `TopBar` (notifications + avatar only) + `<main>` content

The impersonation banner remains full-width at the very top of the page (above both columns), same as current behaviour.

### Sidebar Dimensions & Behaviour
- **Expanded:** 220px wide, shows icon + label per item
- **Collapsed:** 52px wide, shows icon only; label appears as tooltip on hover
- **Toggle:** chevron button at bottom of sidebar, flips between states
- **Persistence:** collapse state stored in `localStorage` key `sidebar_collapsed`
- **Mobile (< 768px):** sidebar hidden by default, hamburger button in TopBar opens it as a drawer overlay

### Nav Items — Operator
```
── Primary ──────────────────────────
  Dashboard
  Campaigns
  Analytics
  Screens
── Secondary ────────────────────────
  Revenue
  Audience & Scans
  Approval Queue        ← new (with pending count badge)
  Advertisers
  Live Signals
  Integrations
  Display Manager
── Bottom ───────────────────────────
  Notification Preferences  ← new
  Account / Sign out
```

### Nav Items — Advertiser
```
── Primary ──────────────────────────
  Dashboard
  Campaigns
  Analytics
── Secondary ────────────────────────
  Scans & Data
  Billing
  Settings
  Integrations
── Bottom ───────────────────────────
  Notifications             ← added (was missing)
  Notification Preferences  ← new
  Account / Sign out
```

### TopBar (replaces GlobalHeader nav portion)
- Height: 56px, sticky, glass background (same `glass` token as current header)
- Left: hamburger on mobile; page title (derived from active nav item) on desktop
- Right: `NotificationBell`, avatar button (opens sign-out dropdown only — no nav links)
- No nav tabs — all navigation is in the sidebar

### Files Affected
| File | Change |
|---|---|
| `src/components/layout/AppShell.jsx` | Restructure to sidebar + right column layout |
| `src/components/layout/GlobalHeader.jsx` | Strip to `TopBar` (notifications + avatar) |
| `src/components/layout/Sidebar.jsx` | New — sidebar component with collapse logic |
| `src/App.jsx` | Pass `active`/`setActive` to `Sidebar`; remove `isAdv` from GlobalHeader nav logic |

### Icons
Inline SVG per nav item (no icon library dependency). 20×20 viewBox, `currentColor` stroke. One icon per nav item defined in a `NAV_ICONS` map in `Sidebar.jsx`.

---

## 2. Quick Fixes

### 2a. Heatmap Min-Opacity
**File:** `src/views/operator/Analytics.jsx`  
**Change:** `opacity: 0.06 + (v / max) * 0.94` → `opacity: 0.20 + (v / max) * 0.80`  
Zero-value cells also get `background: C.border` so the grid structure is visible even with no data.

### 2b. Empty State — Campaigns
**File:** `src/views/operator/Campaigns.jsx` (line ~354)  
**Change:** Replace plain text "No campaigns found" with a card containing:
- Icon (📋 or simple SVG)
- Title: "No campaigns yet"
- Subtitle: "Create your first campaign to start reaching customers."
- CTA button: "Create campaign →" → calls `setActive('campaigns-create')` or opens create modal

For filtered views (e.g. status tab active), show: "No [status] campaigns" with no CTA button.

### 2c. Auth Loading Skeleton
**File:** `src/App.jsx` (auth loading gate ~L195)  
**Change:** Replace `<div>Loading…</div>` with skeleton rows matching dashboard layout — use existing `Skeleton` and `SkeletonRow` components from `src/components/ui/Skeleton.jsx`.

### 2d. Duplicate "New Campaign" CTA
**File:** `src/views/operator/Dashboard.jsx`  
**Change:** Remove "New Campaign" button from Dashboard `PageHeader`. The canonical entry point moves to the sidebar (Campaigns nav item) + the Campaigns view itself.

---

## 3. `SectionHeader` Primitive

**New file:** `src/components/primitives/SectionHeader.jsx`

```jsx
// Props: title (string), subtitle (string, optional), action (ReactNode, optional)
// Replaces inline <h2 style={{...}}> across ~8 files
```

Style: `fontSize: 16, fontWeight: 700, color: C.text, fontFamily: F.sans` for title; `fontSize: 13, color: C.textSub` for subtitle; `action` floated right via flex row.

**Call sites to update:** Dashboard, Campaigns, Analytics, Screens, Revenue, Audience, CampaignDetail, Billing.

---

## 4. Mobile — Advertiser Table

**File:** `src/views/advertiser/AdvDashboard.jsx`  
**Change:** Use existing `useBreakpoint` hook. 
- Above 900px: current fixed grid (`1fr 200px 120px 100px 130px`)
- Below 900px: stacked `<Card>` per campaign row with: name + status badge (row 1), budget + impressions (row 2), actions (row 3)

---

## 5. Date Range Filter — Analytics

**File:** `src/views/operator/Analytics.jsx`  
**Current:** `<select>` with options `[7, 30, 90]` days  
**New:** Same dropdown but adds `Custom…` option. Selecting `Custom…` reveals two `<input type="date">` fields (From / To) inline in the filter bar. Query uses `from`/`to` dates directly instead of computing `since = now - N days`. No new dependencies.

**State change:**
```js
// Before
const [period, setPeriod] = useState(7);

// After
const [period, setPeriod] = useState(7); // 7 | 30 | 90 | 'custom'
const [customFrom, setCustomFrom] = useState('');
const [customTo, setCustomTo]   = useState('');
```

---

## 6. Notification Preferences View

**New file:** `src/views/shared/NotificationPrefsView.jsx`  
**Accessible from:** Sidebar bottom section (both operator and advertiser roles)

### Data
Preferences stored in `profiles.notification_prefs` JSONB column. Schema:
```json
{
  "campaign_approved":  { "inApp": true,  "email": true },
  "campaign_rejected":  { "inApp": true,  "email": true },
  "scan_spike":         { "inApp": true,  "email": false },
  "payout_processed":   { "inApp": true,  "email": true },
  "new_advertiser":     { "inApp": true,  "email": false }
}
```
Default: all `inApp: true`, email varies by event type as above.

### UI
Toggle grid — one row per event type, two toggle columns (In-app / Email). Uses existing `Btn` and `Card` primitives. Saves on toggle change (optimistic update, revert on error via toast).

### Migration
Add `notification_prefs JSONB DEFAULT '{}'` column to `profiles` table via Supabase migration file.

---

## 7. Operator Approval Queue

**New file:** `src/views/operator/ApprovalQueue.jsx`  
**Nav item:** "Approval Queue" in sidebar secondary section, badge shows count of `pending_review` campaigns  

### Data
Filters `campaigns` prop (passed from App.jsx) to `status === 'pending_review'`. No new fetch required.

### Layout
- `PageHeader` with title "Approval Queue" + subtitle "{n} campaigns pending review"
- List of campaign cards (not table — more space for creative preview)
- Each card shows:
  - Advertiser name + campaign title
  - Budget, target screens, date range
  - Creative preview: headline, CTA, accent colour swatch
  - Destination URL (truncated)
  - **Approve** (green) and **Reject** (red) buttons → reuse existing approve/reject handlers from `Campaigns.jsx` (extract to `src/lib/campaignActions.js`)

### Shared Logic Extraction
Extract `approveCampaign` and `rejectCampaign` functions from `Campaigns.jsx` into `src/lib/campaignActions.js` so both `Campaigns` and `ApprovalQueue` use the same implementation.

---

## 8. Screen Detail Page

**New file:** `src/views/operator/ScreenDetail.jsx`  
**Navigation:** Clicking a screen card in `Screens.jsx` calls `setActive('screen-detail')` and stores selected screen ID in App-level state (`selectedScreenId`). Back button returns to `setActive('screens')`.

### Sections

**1. Header**
- Screen name (large), location subtitle
- Status badge (online/offline)
- "Edit" button → opens existing edit modal from Screens.jsx
- "← Back to Screens" link

**2. KPI Row** (4 cards)
- Total Revenue (£)
- Active Campaigns (count)
- Uptime % (7-day)
- Avg CPM (£)

**3. Uptime Grid**
- Extract `UptimeGrid` component from `Screens.jsx` → `src/components/shared/UptimeGrid.jsx`
- Reuse in both `Screens.jsx` (existing expandable row) and `ScreenDetail.jsx`

**Edit Screen Modal**
- Extract existing edit modal from `Screens.jsx` → `src/components/screens/EditScreenModal.jsx`
- Import in both `Screens.jsx` and `ScreenDetail.jsx`

**4. Active Campaigns**
- Table of campaigns with `status IN ('active', 'scheduled')` filtered to this screen
- Columns: Campaign name, advertiser, budget, start/end dates, impressions

**5. Campaign History**
- All past campaigns on this screen (status: completed/rejected/paused)
- Sortable by date or revenue
- Same table component as section 4

**6. Revenue Chart**
- Monthly bar chart — revenue per month for last 6 months
- Data from `impression_events` grouped by month for this screen's ID
- Simple inline SVG bar chart (same pattern as existing charts, no chart library)

### Data Fetching
`ScreenDetail` fetches its own data on mount using `screenId` prop:
- Screen record from `screens` table
- Campaigns linked to this screen from `bookings` joined with `screen_bookings`
- Monthly revenue from `impression_events` grouped by month

---

## Implementation Order

Recommended sequence to minimise merge conflicts:

1. `SectionHeader` primitive (no deps, unblocks other files)
2. Quick fixes: heatmap opacity, auth skeleton, duplicate CTA, empty state, mobile table
3. `UptimeGrid` extraction → `src/components/shared/UptimeGrid.jsx` (unblocks ScreenDetail)
4. `EditScreenModal` extraction → `src/components/screens/EditScreenModal.jsx` (unblocks ScreenDetail)
5. `campaignActions.js` extraction (unblocks ApprovalQueue)
6. Sidebar + TopBar + AppShell restructure (biggest change, do after other files stabilised)
7. Date range filter
8. Notification preferences (requires DB migration)
9. Approval Queue view
10. Screen Detail page
