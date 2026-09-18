# Operator Mobile App — Design Spec
_Date: 2026-06-21_

## Overview

React Native (Expo) mobile app for AdGrid operators. Lets operators register screens, approve/reject ads, and monitor their network from iOS and Android. Full operator feature parity with the web app, excluding campaign creation/launch.

---

## Repository Structure

```
adgrid/
├── src/                         (web app — unchanged)
├── mobile/                      (new Expo app)
│   ├── app/                     (Expo Router file-based routing)
│   │   ├── (tabs)/
│   │   │   ├── index.tsx        (Home / Dashboard)
│   │   │   ├── screens/
│   │   │   │   ├── index.tsx    (Screen list)
│   │   │   │   └── [id].tsx     (Screen detail)
│   │   │   ├── approvals.tsx    (Approval queue)
│   │   │   ├── revenue.tsx      (Revenue)
│   │   │   └── more/
│   │   │       ├── index.tsx    (More menu)
│   │   │       ├── analytics.tsx
│   │   │       ├── advertisers.tsx
│   │   │       ├── billing.tsx
│   │   │       └── settings.tsx
│   │   ├── onboard/             (Screen registration wizard)
│   │   │   ├── welcome.tsx
│   │   │   ├── venue.tsx
│   │   │   ├── hours.tsx
│   │   │   ├── photos.tsx
│   │   │   └── connect.tsx      (QR scan step)
│   │   └── login.tsx
│   ├── components/
│   ├── hooks/
│   └── package.json
└── packages/
    └── core/                    (shared between web + mobile)
        ├── supabase.js
        ├── venueTypes.js
        ├── constants.js
        └── formatCurrency.js
```

Web app imports updated from `../../lib/supabase` → `@adgrid/core/supabase` etc. `pnpm workspaces` manages the monorepo.

---

## Navigation

Bottom tab bar (5 tabs):

| Tab | Badge | Content |
|-----|-------|---------|
| Home | — | Dashboard KPIs, screen health summary |
| Screens | — | Screen list → detail; FAB to add new screen |
| Approvals | Pending count (red) | Ad approval queue, approve/reject with reason |
| Revenue | — | Earnings summary, payout history |
| More | — | Analytics, Advertisers, Billing, Settings, Sign out |

Push notification for new pending ad deep-links directly to Approvals tab.

---

## Features & Flows

### Authentication
- Supabase email/password auth (same as web)
- Session persisted via `expo-secure-store`
- Profile `active_mode` forced to `operator` on mobile
- On login: register Expo push token → upsert into `push_tokens(operator_id, expo_token)`

### Screen Registration Wizard (5 steps)

1. **Welcome** — intro copy, "Add your screen" CTA
2. **Venue info** — screen name, venue category + subtype (from `VENUE_TAXONOMY`), address (street, city, province/state, country)
3. **Operating hours** — start/end time, timezone (auto-derived from country + province via `STATE_TIMEZONE`)
4. **Photos** — upload 1–3 photos via camera or image library (`expo-image-picker`), uploaded to Supabase Storage
5. **Connect** — camera opens via `expo-camera`, operator scans QR code displayed on their screen device, extracts `screen_token`, calls `screens` table to confirm token → marks screen as claimed

### Approval Queue
- Lists all `campaign_screens` with `status = 'pending'` across operator's screens
- Shows: advertiser name, campaign name, creative preview (image/video), estimated revenue share, screen name
- Actions: **Approve** (one tap) or **Reject** (tap → pick reason from 4 options)
- Real-time updates via Supabase channel subscription
- Same business logic as `ApprovalQueue.jsx` — 70% revenue share, `partial` start_when handling

### Dashboard (Home tab)
- KPIs: total screens, live screens, pending approvals, revenue this month
- Screen health summary (live / stale / offline counts)
- Recent activity feed

### Screens
- Card list matching web `Screens.jsx` (health dot, venue type, last seen)
- Screen detail: health status, uptime, active campaigns, photos, edit metadata
- FAB (floating action button) → launches registration wizard

### Revenue
- Earnings by period (week / month / all time)
- Per-screen breakdown
- Payout history

### Analytics
- Impression counts, scan data
- Read-only, mirrors web `Analytics.jsx`

### Advertisers
- List of advertisers running campaigns on operator's screens
- Read-only

### Billing
- Payout method, billing info
- Mirrors web `Billing.jsx`

### Settings
- Profile info, notification preferences
- Sign out

---

## Push Notifications

- **Trigger**: when `campaign_screens.status` is set to `pending`, the `notification-cron` edge function (or a Supabase DB webhook) sends an Expo push notification to all registered tokens for that screen's `operator_id`
- **Payload**: advertiser name, screen name, deep link → Approvals tab
- **Token management**: stored in `push_tokens` table `(id, operator_id, expo_token, created_at)`. Upserted on each login. Deleted on sign-out.

---

## Tech Stack

| Concern | Choice |
|---------|--------|
| Framework | Expo SDK 52 + Expo Router v4 |
| Language | JavaScript (matches web app) |
| Navigation | `expo-router` tabs + `@react-navigation/bottom-tabs` |
| Auth persistence | `expo-secure-store` |
| Camera / QR scan | `expo-camera` (barcode scanning built in) |
| Image picker | `expo-image-picker` |
| Push notifications | `expo-notifications` + Expo Push Service |
| Shared logic | `packages/core` via pnpm workspaces |
| Styling | React Native `StyleSheet` — tokens ported from `src/design/tokens.js` |
| Builds | Expo EAS Build → TestFlight + Play Store internal track |

---

## Database Changes

| Change | Details |
|--------|---------|
| New table `push_tokens` | `id uuid PK, operator_id uuid FK profiles, expo_token text, created_at timestamptz` |
| `notification-cron` update | Add Expo push dispatch when `campaign_screens.status = 'pending'` |

---

## Out of Scope (v1)

- Campaign creation or launch
- Advertiser-side features
- Offline mode
- Biometric login
