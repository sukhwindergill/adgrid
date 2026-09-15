# Marketplace: Exclusive Placement — Design

New subsystem letting board operators list a screen as exclusive to one advertiser for a fixed window, letting advertisers browse/book/pay through the platform, and folding the pre-sale conversation into the existing notification system rather than building a second inbox. Platform takes a service fee on every booking; it does not set deal terms.

## Context / prior art

- **Screens/boards** already support per-screen advertiser targeting (`campaign_screens`, `advertiser_screens_view`) — advertisers picking specific boards is an existing, kept feature. This spec adds an *exclusive* booking type on top, not a replacement.
- **Payments**: `screen_tokens_payments` (migration `20260509000000_screen_tokens_payments.sql`) already processes screen-related payments. Marketplace booking payment reuses this path with an added marketplace-fee line rather than a new payment pipeline.
- **Impression/traffic data**: `impression_events` (migration `20260509000002_impression_events.sql`) and seeded traffic estimates (`20260714000002_backfill_seed_screen_traffic_estimates.sql`) already exist. This spec derives the marketplace's traffic-analytics panel from that data — no new collection mechanism.
- **Notifications**: a full system already exists — `NotificationBell.jsx`, `NotificationPrefsView.jsx`, `send-notification` and `notification-cron` Supabase functions, `notifications` + prefs tables (`20260507000001_notifications.sql`, `20260520000000_add_notification_prefs.sql`). Marketplace pre-sale messaging and booking-status updates are a new *notification type* inside this system, not a separate messaging product.
- **Demographic data**: does not exist anywhere in the current schema. Net new — see Analytics section.

## Scope decisions (from brainstorming)

- **Deal model**: fixed listing (op sets price + window), advertiser books — not an auction, not open-ended negotiation. Keeps deal terms structured data the platform can take a cut on, avoids haggling/spam surface.
- **Exclusivity shape**: time-boxed *full* exclusivity only. No priority-tier/partial-share listings in v1.
- **Displacement**: an op can only list a window with no conflicting active booking on that screen. No mid-flight bump, no proration/refund logic.
- **Messaging**: pre-sale Q&A thread tied to a listing, extends the existing notification system as a new type. Not general-purpose negotiation chat — price/dates are fixed on the listing; the thread is for questions before commit.
- **Analytics**: traffic panel from existing scan/impression data (real, already collected). Demographic panel from a new census/location-intelligence overlay keyed to the screen's lat/long, labeled as an area-level estimate, not board-verified.
- **Op incentive**: no fee discount, no forced mechanic — a revenue-comparison tool at listing time projects shared-rotation earnings (from the screen's own delivery history) against the suggested exclusive price, so op prices with real information.
- **Out of scope v1**: bidding/auction model, displacement + refund/proration, reduced platform fee tier on exclusive deals, partial/priority-tier exclusivity.

## Scope (in this spec)

1. `marketplace_listings` schema + RLS
2. Marketplace tab (browse/filter, listing detail)
3. Screen analytics panel: traffic (existing data) + demographic overlay (new)
4. Pre-sale Q&A thread as a new notification type
5. Booking + payment flow (reuses existing payment infra, adds fee line)
6. Auto-renewal (opt-in, reminder, one-click rebook)
7. Op revenue-comparison tool at listing creation

## Architecture

### 1. Data model

`marketplace_listings`
- `id`, `screen_id` (FK screens), `operator_id`, `price_cents`, `start_date`, `end_date`, `status` (`draft` / `active` / `booked` / `expired` / `cancelled`), `auto_renew` (bool), `created_at`

`marketplace_bookings`
- `id`, `listing_id` FK, `advertiser_id`, `campaign_id` (nullable — the exclusive slot's creative can be attached like a normal campaign), `price_cents`, `platform_fee_cents`, `booked_at`, `payment_ref` (FK into existing payment table), `status` (`confirmed` / `active` / `completed` / `cancelled`)

Conflict check on listing creation and on booking confirm: no overlapping `marketplace_bookings` (status `confirmed`/`active`) or normal `campaign_screens` bookings for that `screen_id` in the requested window. Enforced at both the listing-creation step (op can't even list a conflicting window) and booking-confirm step (race-condition guard), via a DB constraint/exclusion range on `(screen_id, daterange(start_date, end_date))`.

RLS: op sees/manages own listings; advertisers see `active` listings publicly, see own bookings; both sides see bookings they're party to.

### 2. Marketplace tab

New top-level nav tab, advertiser-facing browse view (`src/views/advertiser/MarketplaceView.jsx`) and operator-facing listing management (`src/views/operator/MarketplaceListingsView.jsx`), following existing view folder split (`src/views/advertiser`, `src/views/operator`).

Browse view: filter by location, price range, date window, screen traffic tier. Card shows screen photo (reuses `screen_photo_frames` infra), price, dates, quick traffic summary. Detail view shows full analytics panel + book button + message-op button.

### 3. Analytics panel

**Traffic (real data, existing)**: query `impression_events` for the screen — daily volume, time-of-day distribution, repeat-visit rate (already inferable from token/scan re-hits per `secure_screen_token_and_scans.sql`). Rendered as the panel's primary, "platform-verified" section.

**Demographic (new)**: screen has `lat`/`lng` (per `screen_coordinates.sql`). New lookup service (`supabase/functions/screen-demographics`) resolves lat/lng → census block group or equivalent public geography → age-distribution / income-band stats from a public data source (e.g. US Census ACS API, or regional equivalent if boards are outside the US — needs a decision if operating internationally). Cached per screen (`screen_demographics` table, refreshed on a slow cadence, not per-request) since census data doesn't change in real time. Rendered as a clearly separate, labeled "Area estimate (not board-verified)" section — never merged visually with the traffic section, to avoid advertisers mistaking area demographics for board-verified foot traffic.

Note: if any listed boards are outside a country with an available public census API, demographic panel degrades gracefully to "not available for this location" rather than blocking the listing.

### 4. Pre-sale messaging

Extends the existing notification system rather than adding a new inbox.

- New notification type `marketplace_thread_message`, new table `marketplace_threads` (`id`, `listing_id`, `advertiser_id`, `operator_id`) and `marketplace_thread_messages` (`id`, `thread_id`, `sender_id`, `body`, `created_at`).
- Thread created lazily on first message from advertiser on a listing detail page.
- New message triggers existing `send-notification` function with the new type, appears in the existing `NotificationBell` alongside approvals/completions.
- `NotificationPrefsView` gets one new toggle: "Marketplace messages."
- No free-form price negotiation in-thread — listing price/dates stay authoritative on `marketplace_listings`; thread is Q&A only. (If op wants to change price, they edit/relist; doesn't happen inside the thread.)

Booking status changes (booked, confirmed, expiring soon, expired) also fire as normal notifications through the same system — no separate mechanism.

### 5. Booking + payment

Advertiser clicks Book on an active listing → confirms → payment processed through existing screen-payment path with an added `platform_fee_cents` line (marketplace fee %, configurable, distinct from any existing screen-token fee). On success: `marketplace_bookings` row created, listing flips to `booked`, screen pulled from shared-rotation eligibility for that window (booking's daterange excludes it from normal `campaign_screens` availability), confirmation notifications sent to both parties.

### 6. Auto-renewal

`marketplace_listings.auto_renew` opt-in by op at listing time; advertiser can opt in per-booking. `notification-cron` (already running on a schedule) gets a new check: bookings expiring in N days with auto-renew on both sides → reminder notification; if both parties have pre-authorized, one-click rebook re-runs the booking flow at the same price for the next window (no silent auto-charge without both sides opting in explicitly — avoids surprise billing).

### 7. Op revenue-comparison tool

At listing creation, before op sets price: query the screen's historical shared-rotation delivery data (`campaign_delivery_daily.sql` infra) to project expected shared-rotation earnings over the proposed window, show alongside a suggested exclusive price (simple heuristic — e.g. shared-projection × multiplier, refined later). Informational only, op sets final price manually.

## Testing

- Conflict-range constraint: overlapping listings/bookings on same screen rejected at both listing-create and booking-confirm.
- Booking payment path: fee line correctly split, existing payment tests extended not duplicated.
- Notification type routing: new `marketplace_thread_message` type respects prefs toggle, doesn't leak into unrelated notification types.
- Demographic lookup: graceful degrade when screen location has no census coverage.
- Auto-renewal: no charge fires without both-side opt-in; reminder fires once, not per-cron-tick.

## Open questions for follow-up (not blocking this spec)

- International boards: which public demographic data sources are usable outside the US? Needs research before non-US launch.
- Marketplace fee %: exact rate TBD by business, not engineering — treat as a config value, not hardcoded.
