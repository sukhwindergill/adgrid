# Screen Metadata, Categorisation & Photos — Design Spec
**Date:** 2026-06-05
**Priority:** P0 — required for advertiser targeting (Sprint 2 depends on this)

---

## Problem

Screens have no venue context. Advertisers cannot make informed decisions about where to run campaigns — they can't filter by café vs gym, indoor vs outdoor, or verify what a screen looks like. Without lat/lon and state/country fields, geographic targeting (radius, city, state, country) is impossible.

---

## Solution

Add venue metadata + photo upload to the `screens` table, capture it in the onboarding wizard, surface it on screen cards and ScreenDetail, and make it editable afterwards.

---

## 1. DB Migration

Add the following columns to the `screens` table. All nullable — no breaking changes to existing rows.

| Column | Type | Notes |
|---|---|---|
| `venue_category` | `text` | Slug e.g. `'food_drink'` |
| `venue_subtype` | `text` | Slug e.g. `'cafe'` |
| `environment` | `text` | `'indoor'` \| `'outdoor'` |
| `screen_position` | `text` | `'window'` \| `'interior'` \| `'counter'` \| `'waiting_area'` |
| `state` | `text` | Province/state e.g. `'Ontario'` |
| `country` | `text` | ISO code e.g. `'CA'` \| `'GB'` \| `'US'` \| `'AU'` — default `'CA'` |
| `screen_photos` | `text[]` | Array of public Supabase Storage URLs, default `'{}'` |

`lat` and `lon` already exist on `screens` — no new columns needed.

**SQL:**
```sql
ALTER TABLE screens
  ADD COLUMN IF NOT EXISTS venue_category text,
  ADD COLUMN IF NOT EXISTS venue_subtype text,
  ADD COLUMN IF NOT EXISTS environment text,
  ADD COLUMN IF NOT EXISTS screen_position text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'CA',
  ADD COLUMN IF NOT EXISTS screen_photos text[] DEFAULT '{}';
```

**Supabase Storage bucket:** `screen-photos` — public read, authenticated write. Create via Supabase dashboard or migration.

---

## 2. Venue Taxonomy

Stored as a constant in `src/lib/venueTypes.js` (new file). Used by wizard, ScreenDetail, and future targeting filters.

```js
export const VENUE_TAXONOMY = {
  food_drink:     { label: 'Food & Drink',        subtypes: ['Café', 'Restaurant', 'Bar', 'Fast Food', 'Bakery'] },
  fitness:        { label: 'Fitness & Wellness',   subtypes: ['Gym', 'Yoga Studio', 'Spa', 'Barber / Salon'] },
  retail:         { label: 'Retail',               subtypes: ['Clothing', 'Electronics', 'Supermarket', 'Pharmacy', 'Convenience'] },
  transport:      { label: 'Transport',            subtypes: ['Bus Stop', 'Train Station', 'Airport', 'Metro / Tube'] },
  healthcare:     { label: 'Healthcare',           subtypes: ['GP / Clinic', 'Hospital', 'Dentist'] },
  hospitality:    { label: 'Hospitality',          subtypes: ['Hotel', 'Co-working Space'] },
  education:      { label: 'Education',            subtypes: ['University', 'School', 'Library'] },
  entertainment:  { label: 'Entertainment',        subtypes: ['Cinema', 'Events Venue', 'Sports Venue'] },
  other:          { label: 'Other',                subtypes: [] },
};

export const COUNTRIES = [
  { code: 'CA', label: 'Canada' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'US', label: 'United States' },
  { code: 'AU', label: 'Australia' },
];

export const ENVIRONMENT_OPTIONS = ['indoor', 'outdoor'];

export const SCREEN_POSITION_OPTIONS = [
  { value: 'window',       label: 'Window-facing' },
  { value: 'interior',     label: 'Interior' },
  { value: 'counter',      label: 'Counter' },
  { value: 'waiting_area', label: 'Waiting Area' },
];
```

---

## 3. Wizard Step 2 — Extended Form

**File:** `src/views/operator/ScreenOnboard.jsx` — `StepRegister` component

Form fields in order (all required unless marked optional):

1. **Screen Name** — `Inp`, placeholder "e.g. Corner Brew — King St"
2. **Business / Owner Name** — `Inp`, placeholder "e.g. Corner Brew Coffee"
3. **Country** — `SelInput`, options from `COUNTRIES`
4. **State / Province** — `Inp`, placeholder "e.g. Ontario" — label changes: "State" for US/AU, "Province" for CA, "Region" for GB
5. **City** — `Inp` (free text, replacing dropdown — supports any city)
6. **Location / Address** — `Inp`, placeholder "e.g. King St W & Bay St"
7. **Venue Category** — `SelInput`, options from `VENUE_TAXONOMY` keys
8. **Venue Subtype** — `SelInput`, options from `VENUE_TAXONOMY[category].subtypes` — updates when category changes
9. **Environment** — two pill buttons: Indoor / Outdoor. Selected pill uses `C.purple` background.
10. **Screen Position** — four pill buttons from `SCREEN_POSITION_OPTIONS`. Same pill style.
11. **Display Size** — `Inp`, placeholder "e.g. 55 inch 4K, 72 inch LED"
12. **Lat / Lng** — collapsible section, collapsed by default. Toggle label: "Add location coordinates (for radius targeting)". Two `Inp` fields side by side.

**Validation:** All fields except Lat/Lng required. "Next →" disabled until all required fields filled.

**Supabase insert additions** (on top of existing fields):
```js
venue_category: form.venue_category,
venue_subtype:  form.venue_subtype,
environment:    form.environment,
screen_position: form.screen_position,
state:          form.state.trim(),
country:        form.country,
lat:            form.lat ? parseFloat(form.lat) : null,
lon:            form.lng ? parseFloat(form.lng) : null,
```

Note: DB column is `lon` not `lng`.

---

## 4. Wizard Step 3 — Photo Upload (before hardware instructions)

**File:** `src/views/operator/ScreenOnboard.jsx` — `StepSetup` component

Add a photo upload section at the top of Step 3, before the hardware selector.

**Layout:**
- Heading: "Add photos of your screen" + subtext: "Advertisers use these to verify placement before booking."
- Upload area: dashed border box, click to open file picker or drag-and-drop. Accept: `image/*`. Max 4 photos.
- Thumbnails: show uploaded photos in a 2×2 grid. Each thumbnail has a remove (×) button.
- Upload state: show per-photo progress or spinner.
- "Skip for now" link if no photos uploaded yet.

**Upload logic:**
- On file select: upload each file to Supabase Storage path `screen-photos/{screen.id}/{crypto.randomUUID()}`
- On success: call `supabase.from('screens').update({ screen_photos: [...existing, publicUrl] }).eq('id', screen.id)`
- On remove: remove URL from array, delete from Storage
- Max 4 photos enforced client-side (hide/disable upload once 4 reached)

**Public URL:** `supabase.storage.from('screen-photos').getPublicUrl(path).data.publicUrl`

---

## 5. ScreenDetail — Details Tab

**File:** `src/views/operator/ScreenDetail.jsx`

Add a "Details" tab to the existing tab bar (after Overview, before CV Insights, before Setup Guide):

Tab order: **Overview | Details | CV Insights | Setup Guide**

**Details tab content:**

### Photos section
- Grid of existing photos (2 per row on desktop, 1 on mobile)
- Each photo has remove (×) button
- "Add photo" button — opens file picker, same upload logic as wizard
- Max 4 total enforced
- Empty state: "No photos yet — add photos so advertisers can see your screen"

### Venue details section (editable)
All fields editable inline with a single "Save changes" button at bottom.

Fields:
- Country — `SelInput`
- State / Province — `Inp`
- City — `Inp`
- Venue Category — `SelInput`
- Venue Subtype — dependent `SelInput`
- Environment — pill buttons (Indoor / Outdoor)
- Screen Position — pill buttons
- Lat / Lng — two `Inp` fields side by side (optional)

On save: `supabase.from('screens').update({...fields}).eq('id', screen.id)`
Show success/error via existing Toast system.

---

## 6. Screen Cards — Updated Display

**File:** `src/views/operator/Screens.jsx` — `ScreenCard` component

Changes:
- **Photo thumbnail:** if `screen.screen_photos?.length > 0`, show first photo as a banner at top of card (full width, 80px tall, `object-fit: cover`, `border-radius: 10px 10px 0 0`).
- **Venue badge:** show `screen.venue_subtype || screen.venue_category` as a small chip beneath the screen name (same style as existing status badge but using `C.blueSoft` / `C.blue`).
- **Environment chip:** show "Indoor" or "Outdoor" in small text next to the neighbourhood/city line.

---

## 7. Out of Scope

- Advertiser targeting filters in CreateCampaign (Sprint 2 — campaign targeting funnel)
- `campaign_screens` junction table (Sprint 2)
- Map view of screens by location
- Photo moderation / approval
- Video upload (photos only for now)
- `venue_category` / `venue_subtype` as enum types in DB (text is fine for now)
