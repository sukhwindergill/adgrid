# Hardware Screens, CV Insights, Advertiser Mobile & Cleanup — Design Spec
Date: 2026-06-02

## Scope

Five deliverables in one sprint:
1. Screen health badges on Screens list
2. ScreenDetail tabbed layout (Overview | CV Insights | Setup Guide)
3. SecurityTab split msg state fix
4. Advertiser views mobile audit + fixes
5. Vercel deploy verification

---

## 1. Screen Health Badges — `Screens.jsx`

### Goal
Surface `last_seen` / `health_status` per screen card so the operator knows health at a glance without drilling into each screen.

### Logic
Derive a `healthSignal(screen)` helper:
- `last_seen` within 5 min → `live` (existing green pulse)
- `last_seen` 5–60 min → `stale` (amber dot, label "Stale")
- `last_seen` > 60 min OR null → `offline` (red dot, label "Offline")
- Override with `screen.health_status` if it equals `"degraded"` → amber

### Changes
- `ScreenCard`: replace/augment existing `screen.status === 'live'` pulse with `healthSignal`. Show coloured dot + text beneath screen name.
- No DB changes. `screens.*` already fetched in App.jsx.
- `AddScreenModal`: add a "Test Connection" step after registration — poll for a heartbeat for up to 60 s, show spinner then pass/fail. On fail, show retry + link to setup instructions.

---

## 2. ScreenDetail Tabs — `ScreenDetail.jsx`

### Tab chrome
Add `tab` state (`'overview' | 'cv' | 'setup'`). Render a `<TabBar>` at the top using the existing `Tabs` primitive. All existing ScreenDetail content becomes the Overview tab — no logic changes to that tab.

### CV Insights tab

**Data source:** `impression_events` table, `screen_id = screen.id`, last 30 days.

**Query fields:**
`window_start, people_count, avg_dwell_seconds, avg_attention_score, age_18_24, age_25_34, age_35_44, age_45_54, age_55_plus, gender_male, gender_female, gender_unknown`

**UI sections:**
1. KPI row (3 cards): Total People Seen · Avg Dwell (s) · Avg Attention (%)
2. Age breakdown: horizontal bar chart — 5 bars (18-24, 25-34, 35-44, 45-54, 55+). Each bar is a `div` with `width: X%` relative to max bucket. Pure CSS, no chart library.
3. Gender split: 3 horizontal bars (Male / Female / Unknown).
4. 7-day people trend: aggregate `people_count` per day, render as a sparkline (14 vertical bars in a flex row, heights proportional to max day).

**Empty state:** "No CV data yet — requires screen-agent with camera."

### Setup Guide tab

**Hardware selector:** 4 pill buttons — Browser Kiosk | Raspberry Pi 5 | Mini PC | Android TV.

**Per-hardware content:**
- **Browser Kiosk:** Player URL (existing logic from AddScreenModal) + fullscreen launch instructions.
- **Raspberry Pi 5 / Mini PC:** Docker compose snippet (from AddScreenModal) + camera wiring steps (USB camera → `/dev/video0`).
- **Android TV:** APK sideload instructions (static copy).

**Screen token section:** show `screen.screen_token` in a monospace box (same style as AddScreenModal). Copy button.

**Test Connection button:** fetch `display_heartbeats` for this screen where `created_at > now() - 5 min`. If row exists → green "Connected". If none → "No heartbeat yet — check your setup".

---

## 3. SecurityTab Msg State Fix — `OperatorSettingsView.jsx`

### Problem
`SecurityTab` has one shared `msg` state. Updating email and updating password both write to it, so they overwrite each other.

### Fix
Replace `const [msg, setMsg] = useState(null)` with two independent states:
```js
const [emailMsg, setEmailMsg] = useState(null); // { text, ok }
const [pwMsg,    setPwMsg]    = useState(null);  // { text, ok }
```
Each section renders its own message beneath its own button. Reset the relevant state at the start of each submit handler.

---

## 4. Advertiser Mobile Audit — `src/views/advertiser/`

### Views to check and fix

| File | Known issue | Fix |
|---|---|---|
| `AdvDashboard.jsx` | KPI grid `repeat(4,1fr)` hardcoded | `isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)'` |
| `CreateCampaign.jsx` | Unknown — audit needed | Fix any fixed-width containers, multi-col grids |
| `BillingView.jsx` | Unknown — audit needed | Fix any fixed-width or overflow issues |
| `ScansView.jsx` | Unknown — audit needed | Fix table overflow on narrow viewports |

All fixes use existing `useBreakpoint` → `{ isMobile }`.

---

## 5. Vercel Deploy Verification

Check latest deployment via Vercel MCP. Confirm last push (`10cd0c2`) deployed successfully and is the live production build.

---

## Data Model

No schema migrations required. All tables (`display_heartbeats`, `impression_events`, `screens`) already have the needed columns. Existing RLS policies apply — operator fetches only screens they own.

---

## Out of Scope

- Android TV APK (static copy instructions only, no actual APK)
- Map view for screen lat/lng
- Camera calibration tooling
- Advertiser-side screen browsing
