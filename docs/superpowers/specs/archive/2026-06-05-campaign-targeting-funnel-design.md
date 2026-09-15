# Campaign Targeting Funnel — Design Spec
**Date:** 2026-06-05
**Priority:** P0 — core advertiser flow

---

## Problem

Campaign creation is a single form tied to one screen. No geographic targeting, no multi-screen selection, no per-screen creative overrides, no approval logic for multi-owner scenarios. Advertisers can't run campaigns across multiple screens the way they'd expect from a modern ad platform.

---

## Solution

Replace `CreateCampaign` with a 7-step targeting funnel. Add `campaign_screens` junction table for multi-screen relationships. Update approval queue for per-screen-owner decisions with email one-click approve. Add auto-approve mode per screen.

---

## 1. DB Schema

### New table: `campaign_screens`

```sql
CREATE TABLE campaign_screens (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id     text NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  screen_id       text NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'pending',
    -- 'pending' | 'approved' | 'rejected' | 'auto_approved'
  headline        text,       -- per-screen override, null = use campaign default
  cta_text        text,       -- override
  accent_color    text,       -- override
  destination_url text,       -- override
  reject_reason   text,       -- filled on rejection
  approved_at     timestamptz,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(campaign_id, screen_id)
);
```

### New columns on `bookings`

```sql
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS budget_mode text DEFAULT 'total',
    -- 'daily' | 'total'
  ADD COLUMN IF NOT EXISTS start_when text DEFAULT 'partial',
    -- 'partial' (go live as screens approve) | 'all' (wait for all)
  ADD COLUMN IF NOT EXISTS peak_hours_preferred boolean DEFAULT false;
```

### New column on `screens`

```sql
ALTER TABLE screens
  ADD COLUMN IF NOT EXISTS auto_approve boolean DEFAULT false;
```

### Approval token table (for email one-click)

```sql
CREATE TABLE approval_tokens (
  token       text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  campaign_id text NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  screen_id   text NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
  action      text NOT NULL,  -- 'approve' | 'reject'
  used        boolean DEFAULT false,
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '7 days',
  created_at  timestamptz DEFAULT now()
);
```

---

## 2. Campaign Status Logic

Campaign `status` in `bookings` is derived from `campaign_screens`:

| Condition | Campaign status |
|---|---|
| All rows `pending` | `pending_review` |
| ≥1 approved/auto_approved, rest pending, `start_when='partial'` | `scheduled` |
| All approved/auto_approved | `scheduled` |
| `start_when='all'`, any still pending | `pending_review` |
| All rejected | `rejected` |
| Mix of approved + rejected (no pending) | `scheduled` (runs on approved only) |

---

## 3. CreateCampaign — 7-Step Wizard

**File:** `src/views/advertiser/CreateCampaign.jsx` — full rewrite

**Shared wizard state:**
```js
{
  // Step 1
  area_type: 'city',        // 'country' | 'state' | 'city' | 'radius'
  country: 'CA',
  state: '',
  city: '',
  radius_center: '',        // city/address text for radius mode
  radius_km: 10,

  // Step 2
  env_filter: 'any',        // 'any' | 'indoor' | 'outdoor'
  venue_filter: '',         // '' = any, or VENUE_TAXONOMY key

  // Step 3
  matched_screens: [],      // fetched from DB
  selected_screen_ids: [],  // pre-filled with all matched, advertiser can deselect

  // Step 4
  headline: '',
  cta_text: '',
  destination_url: '',
  accent_color: '#7c3aed',
  category: '',
  per_screen_overrides: {}, // { [screen_id]: { headline, cta_text, accent_color, destination_url } }
  show_overrides: false,

  // Step 5
  budget_mode: 'total',
  budget: '',
  start_date: '',
  end_date: '',
  schedule_days: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
  time_start: '07:00',
  time_end: '22:00',
  peak_hours_preferred: false,

  // Step 6
  start_when: 'partial',

  // Duplicate source
  duplicate_from: null,
}
```

---

### Step 1 — Area

**Area type selector:** 4 pill buttons — Country / State-Province / City / Radius

**Fields shown by area_type:**
- `country` → Country dropdown (COUNTRIES from venueTypes.js)
- `state` → Country + State/Province text input
- `city` → Country + State + City text input
- `radius` → "Center location" text input (city or address) + radius slider: 5 / 10 / 25 / 50 / 100 km pills

**Live reach counter** (updates on any field change):
```
~14 screens · ~180K impressions/mo estimated
```
Derived by running the area match query against `screens` with lat/lon for radius mode, or text field matches for country/state/city.

**Screen matching logic (run in Step 1 + Step 2, final results in Step 3):**
- `country` → `screens.country = form.country`
- `state` → country match + `screens.state ILIKE form.state`
- `city` → country + state match + `screens.city ILIKE form.city`
- `radius` → fetch all screens with non-null lat/lon, filter client-side using haversine:
  ```js
  function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }
  ```
  For radius center, geocode the text input using `https://nominatim.openstreetmap.org/search?q={city}&format=json&limit=1` (free, no API key). Parse `lat` and `lon` from response.

**"Duplicate a previous campaign" shortcut** — shown above the area selector:
- "Start from a previous campaign →" text link → opens a simple modal listing advertiser's past campaigns. Selecting one pre-fills all wizard state from that campaign. Advertiser can then modify any step.

---

### Step 2 — Filters *(optional)*

- Environment pills: Any / Indoor / Outdoor
- Venue category dropdown: Any + all VENUE_TAXONOMY categories
- Live reach counter updates

"Skip →" link advances to Step 3 without changing filters from defaults.

---

### Step 3 — Screen Picker

**Query:** fetch screens matching area + filter criteria. Apply environment + venue_category filters on top.

**Display:** grid of screen cards (same `ScreenCard` style but with checkbox overlay). Each card shows:
- First photo (if available), name, location, venue badge, environment chip
- Checkbox in top-left corner (ticked by default)
- Estimated impressions/mo

**Controls:**
- "Select all" / "Deselect all" links
- Selected count + total impressions: `"12 of 14 screens selected · ~165K impressions/mo"`

**Empty state:** "No screens match your filters. Try widening your area or removing filters."

---

### Step 4 — Creative

**Campaign-level fields:**
- Headline (`Inp`, max 60 chars, character counter)
- CTA Text (`Inp`, max 20 chars)
- Destination URL (`Inp`, type=url)
- Accent Color (color picker input, default `#7c3aed`)
- Category (`SelInput` — same options as current CreateCampaign)

**Live creative preview:**
Reuse `CreativePreview` component from `src/views/operator/ApprovalQueue.jsx`. Move it to `src/components/shared/CreativePreview.jsx` (extract from ApprovalQueue). Renders in real time as fields update.

**Per-screen creative overrides:**
"Customise creative per screen →" accordion toggle. When open, shows a list of each selected screen with 4 override fields (headline, CTA, color, URL). Empty = use campaign default. Helps advertisers tailor copy to each venue type (e.g. "Try our coffee" for cafés, "Fuel your workout" for gyms).

---

### Step 5 — Budget & Schedule

**Budget:**
- Mode toggle: "Daily limit" / "Total budget" — pill buttons
- Amount field (£) with `Inp`
- **Budget guidance:** `"For {N} screens over {days} days, suggested range: £{min}–£{max}"` — calculated as `(totalImpressions / 1000) × 3 × days` for min, `× 8` for max (rough £3–£8 CPM estimate).
- **Minimum budget warning:** if `budget / selectedScreens.length / campaignDays < 0.50`, show amber warning: "Budget may be too low to run consistently across all selected screens. Consider increasing or reducing screen count."

**Schedule:**
- Start date + End date (`<input type="date">`)
- Days of week: 7 pill toggles (Mon–Sun), all on by default
- Time window: start time + end time (`<input type="time">`)
- Peak hours toggle: "Prioritise peak footfall periods" — checkbox with note: "Ad system will favour slots when screen CV data shows highest foot traffic."

---

### Step 6 — Launch Preference

Two large pill options:
- **"Go live as screens approve"** — campaign starts running on each screen as soon as that screen's owner approves. Other screens join when they approve.
- **"Wait for all screens"** — campaign stays pending until every targeted screen owner has approved. Safer, coordinated launch.

Brief explanation text beneath each option.

---

### Step 7 — Review & Submit

Summary card showing:
- Area + filter summary
- Selected screens count + total impressions estimate
- Creative preview (CreativePreview component, small)
- Budget mode + amount + dates + time window
- Launch preference
- "Edit" link per section → jumps back to that step

**Submit handler:**
```js
async function handleSubmit() {
  // 1. Insert bookings row
  const { data: booking } = await supabase.from('bookings').insert({
    id: crypto.randomUUID(),
    advertiser_id: user.id,
    advertiser_name: profile.name,
    screen_name: selectedScreens[0]?.name || '',  // backward compat
    city: form.city || form.state || form.country,
    headline: form.headline,
    cta_text: form.cta_text,
    destination_url: form.destination_url,
    accent_color: form.accent_color,
    category: form.category,
    budget: parseFloat(form.budget),
    budget_mode: form.budget_mode,
    start_when: form.start_when,
    start_date: form.start_date,
    end_date: form.end_date,
    schedule_days: form.schedule_days,
    time_start: form.time_start,
    time_end: form.time_end,
    peak_hours_preferred: form.peak_hours_preferred,
    status: 'pending_review',
    payment_status: 'unpaid',
    impressions: 0,
    spent: 0,
    scans: 0,
  }).select('id').single();

  // 2. Insert campaign_screens rows
  const screenRows = form.selected_screen_ids.map(screen_id => {
    const screen = form.matched_screens.find(s => s.id === screen_id);
    const override = form.per_screen_overrides[screen_id] || {};
    return {
      campaign_id: booking.id,
      screen_id,
      status: screen.auto_approve ? 'auto_approved' : 'pending',
      headline: override.headline || null,
      cta_text: override.cta_text || null,
      accent_color: override.accent_color || null,
      destination_url: override.destination_url || null,
    };
  });
  await supabase.from('campaign_screens').insert(screenRows);

  // 3. Update campaign status if applicable
  const allAutoApproved = screenRows.every(r => r.status === 'auto_approved');
  if (allAutoApproved || (form.start_when === 'partial' && screenRows.some(r => r.status === 'auto_approved'))) {
    await supabase.from('bookings').update({ status: 'scheduled' }).eq('id', booking.id);
  }

  // 4. Notify operators (via existing callNotification)
  // Group screen_ids by operator_id, send one notification per operator
}
```

---

## 4. Approval Queue — Updated

**File:** `src/views/operator/ApprovalQueue.jsx`

### Card layout (multi-screen aware)

New `CampaignCard` layout:

```
┌─────────────────────────────────────────────────────────┐
│ HEADER: Advertiser name · PENDING · Category · [Age]    │
├─────────────────┬───────────────────────────────────────┤
│ CreativePreview │ Campaign details:                     │
│ (reused)        │ · Area / targeting summary            │
│                 │ · Budget mode + amount                │
│                 │ · Dates + time window                 │
│                 │ · Destination URL (clickable)         │
│                 │ · Earnings estimate                   │
├─────────────────┴───────────────────────────────────────┤
│ YOUR SCREENS:                                           │
│ [✓] Corner Brew — King St  [Approve] [Reject ▾]        │
│ [✓] Corner Brew — Queen St [Approve] [Reject ▾]        │
│ [Approve all my screens]                               │
└─────────────────────────────────────────────────────────┘
```

**Mobile layout (< 768px):** Stack vertically. CreativePreview full width → campaign details → per-screen actions.

**Age indicator:** `"Submitted {timeAgo(campaign.created_at)}"` — shown in header strip.

**Offline screen warning:** for each of operator's screens in the card, if `healthSignal(screen).label !== 'Live'`, show amber chip: "⚠ Currently offline".

### Reject with reason

"Reject ▾" opens a small dropdown with reason options:
- Inappropriate content
- Competitor brand
- Not relevant to my venue
- Other

Selecting reason → confirms rejection → `campaign_screens.status = 'rejected'`, `reject_reason = reason`. Reason included in advertiser notification.

### Bulk approve

Button at top of page: "Approve all pending ({N})" — iterates all pending `campaign_screens` for this operator's screens and approves in bulk. Confirm modal first.

### Auto-approve toggle

Card at top of ApprovalQueue (above the list):
```
┌────────────────────────────────────────────────────────┐
│ ⚡ Auto-approve campaigns for my screens               │
│ Campaigns go live instantly without manual review.     │
│ [Toggle ON/OFF]                                        │
│ By enabling auto-approve you accept responsibility for │
│ ensuring advertised content complies with local        │
│ advertising regulations applicable to your location.  │
└────────────────────────────────────────────────────────┘
```

Toggle updates `screens.auto_approve` for ALL of this operator's screens at once (they can refine per-screen in ScreenDetail later).

### Email one-click approve/reject

When a campaign is submitted targeting a non-auto-approve screen:
1. Generate two `approval_tokens` rows (one approve, one reject) for each pending screen
2. Include in notification email:
   ```
   Campaign: "Corner Brew Coffee" wants to advertise on your screen.
   Budget: £200 total · 7 days · Toronto
   
   [✓ Approve]  [✗ Reject]
   ```
   Buttons link to: `{appUrl}/api/approve?token={token}`

3. **Edge function `handle-approval-token`:** validates token (not used, not expired), sets `campaign_screens.status`, marks token used, updates campaign status if needed, redirects to a simple "Done" page.

Token links work without login. Expire after 7 days.

---

## 5. AdvDashboard + Campaigns + CampaignDetail Updates

### AdvDashboard / Campaigns

Campaign cards show:
- Screen count instead of single screen name: `"{N} screens · {city}"` — derived from `campaign_screens` count
- Status badge: if any `campaign_screens` are `pending` and rest approved → show "Partially approved" amber badge
- Full `approved` / `scheduled` → existing green badge

### CampaignDetail

New "Screens" section below existing campaign details:
- List of all `campaign_screens` rows for this campaign
- Per row: screen name, location, status chip, earnings estimate, per-screen creative (if override set)
- Operator can still approve/reject from here

---

## 6. CreativePreview — Shared Component

**Extract from ApprovalQueue to:** `src/components/shared/CreativePreview.jsx`

Same component, now used in:
- `ApprovalQueue.jsx` (existing)
- `CreateCampaign.jsx` Step 4 (live preview)
- `CreateCampaign.jsx` Step 7 (review summary)
- `CampaignDetail.jsx`

Props: `{ campaign }` where campaign has `headline`, `cta_text`, `accent_color`, `destination_url`, `category`.

---

## 7. Out of Scope

- Actual pacing algorithm (daily budget distribution across screens) — display player / backend
- Stripe payouts per screen owner — Sprint 2B
- Saved targeting presets
- Per-screen audience insights in picker
- A/B creative testing
- Radius geocoding beyond Nominatim (no paid geocoding APIs)
- Push notifications (email only for approval flow)
