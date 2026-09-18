# Screen Onboarding Wizard — Design Spec
**Date:** 2026-06-05
**Priority:** P0 — blocks first live operator

---

## Problem

New operators cannot discover or complete the screen setup flow. The existing `AddScreenModal` is hidden behind the Screens nav item, overwhelms with unnecessary fields (CPM floor, footfall, lat/lng), and shows critical setup instructions (token, Docker compose) in a dismissible modal — meaning they are lost as soon as the user closes it. There is no guided path from signup → screen live.

---

## Solution

Replace `AddScreenModal` with a full-page 4-step onboarding wizard. Entry points updated across Dashboard and Screens. Setup instructions permanently accessible via ScreenDetail → Setup Guide tab (already built).

---

## Wizard Structure

Nav key: `screen-onboard`
File: `src/views/operator/ScreenOnboard.jsx`

```
Step 1: Welcome
Step 2: Register (Basics)
Step 3: Setup Guide
Step 4: Connect
```

Progress bar at top showing current step (1–4). Back button on steps 2–4. Each step is a named sub-component inside the one file.

---

## Step Designs

### Step 1 — Welcome

Full-width card layout. No form fields.

**Content:**
- Headline: "Let's get your screen on the network"
- Subtext: "ADGRID connects your display to advertisers who pay to reach your audience. Setup takes about 5 minutes."
- Three icon + text items:
  - 📺 "Works on any display — TV, monitor, or commercial screen"
  - ⚡ "5 minutes to set up"
  - 💰 "Start earning from day one"
- Single primary CTA: "Get Started →"

---

### Step 2 — Register (Basics)

Supabase insert happens on "Next →" click.

**Required fields:**
| Field | Component | Placeholder |
|---|---|---|
| Screen Name | `Inp` | "e.g. Corner Brew — King St" |
| Location / Address | `Inp` | "e.g. King St W & Bay St, Toronto" |
| City | `SelInput` | Toronto / London / Manchester / Birmingham / Vancouver / Edinburgh |
| Display Size | `Inp` | "e.g. 55 inch 4K, 72 inch LED" |

All four fields required — "Next →" disabled until all filled.

**On submit:**
- Insert to `screens` table with: `name`, `location`, `city`, `display_size`, `status: 'pending'`, `operator_id: user.id`, `max_ad_duration: 30`, `monthly_revenue: 0`, `campaigns: 0`
- Store returned `{ id, screen_token, name }` in wizard state
- Navigate to Step 3

**Error handling:** Inline error banner beneath form on Supabase error. Button re-enables, user can retry.

---

### Step 3 — Setup Guide

Reads `screen_token` and `screen.id` from wizard state (set in Step 2).

**Hardware selector:** 4 pill buttons — Browser Kiosk · Raspberry Pi 5 · Mini PC · Android TV. Default: Browser Kiosk.

**Screen Token section:**
- Label: "Your Screen Token"
- Monospace box with token value
- Copy button (copies to clipboard, shows "Copied!" for 2s)
- Warning note: "Keep this private — it authenticates your display."

**Per-hardware instructions:**

*Browser Kiosk:*
- Player URL: `{window.location.origin}/display/{screen_token}` in monospace box with copy button
- Instructions: "Open this URL fullscreen on your display. On Chrome: press F11 for fullscreen. The screen will automatically show ads when campaigns are running."

*Raspberry Pi 5 / Mini PC:*
- Docker Compose snippet (pre-filled with token + env vars) in dark code block with copy button
- Instructions: "1. Install Docker on your device. 2. Save the above as docker-compose.yml. 3. Run: `docker-compose up -d`. 4. Connect a USB camera to /dev/video0 for CV impression tracking."

*Android TV:*
- Instructions: "1. Enable Developer Options on your Android TV. 2. Install the ADGRID APK via sideloading. 3. Enter your screen token when prompted." (static copy for now)

**Navigation:**
- "I've completed setup →" → Step 4
- "Do this later →" → completes wizard, navigates to `screen-detail`

---

### Step 4 — Connect

Single purpose: verify the display is sending heartbeats.

**Layout:**
- Heading: "Test your connection"
- Subtext: "Click the button below after your display is running. We'll check if it's sending a heartbeat to our servers."
- "Test Connection" button
- On click: query `display_heartbeats` where `screen_id = screen.id` and `created_at > now() - 5 min`, limit 1
  - Result found → green success state: "✓ Connected! Your screen is live." + "Go to my screen →" button
  - No result → amber state: "No heartbeat detected yet. Make sure your display is running and try again." + "Retry" link + "Skip for now →" link
- "Skip for now →" always available — navigates to `screen-detail`

**On completion (any path):**
- `navigate('screen-detail')`
- `setSelectedScreenId(newScreen.id)`

---

## Entry Points

### Dashboard — empty screens state

When `dbScreens.length === 0`, replace the existing empty campaign card in the "Active Campaigns" section with a full-width onboarding hero card:

```
┌─────────────────────────────────────────────┐
│  📺  No screens yet                          │
│  Register your first screen to start        │
│  receiving campaign bookings.               │
│                                             │
│  [Set up your first screen →]               │
└─────────────────────────────────────────────┘
```

Button: `onClick={() => setNav('screen-onboard')}`

### Screens page — header button

Change `onClick={() => setShowAdd(true)}` on the "+ Register Screen" `Btn` to `onClick={() => onStartOnboard()}`.

Pass `onStartOnboard` prop down from App.jsx: `() => navigate('screen-onboard')`.

### Screens page — empty state

Existing empty state CTA button: change `onClick={() => setShowAdd(true)}` to `onClick={() => onStartOnboard()}`.

---

## Routing Changes (App.jsx)

Add route:
```js
if (active === 'screen-onboard') return (
  <ScreenOnboardView
    onComplete={(newScreen) => {
      setDbScreens(prev => [...prev, { ...newScreen, neighbourhood: newScreen.location, cpm: 3.00, maxDuration: 30, revenue: 0, campaigns: 0 }]);
      setSelectedScreenId(newScreen.id);
      navigate('screen-detail');
    }}
    onCancel={() => navigate('screens')}
  />
);
```

---

## Deletions

- Remove `AddScreenModal` component from `Screens.jsx`
- Remove `showAdd` state and `setShowAdd` calls from `ScreensView`
- Remove `profile` prop pass-through to `ScreensView` if it was only used for `AddScreenModal` (verify first)

---

## CPM / Pricing Note

CPM floor field removed from registration entirely. Platform will use an auction/bidding model where advertisers bid for placement and operators receive maximum yield automatically. CPM floor concept is deprecated — remove from any UI that surfaces it. (Full bidding model is a separate spec.)

---

## Out of Scope

- Editing screen details after registration (ScreenDetail settings tab handles this)
- CV camera configuration beyond Docker compose snippet
- Android TV APK (static instructions only for now)
- Auto-approve / approval flow (separate sprint)
- Bidding model implementation (separate spec)
