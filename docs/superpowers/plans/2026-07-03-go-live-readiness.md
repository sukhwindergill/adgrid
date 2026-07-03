# AdGrid Go-Live Readiness — Deep Pass (2026-07-03)

Audience: advertisers, screen owners/operators, marketing agencies, large corporations.
Scope of this pass: full sweep across all 9 readiness areas + physical-device plan +
enterprise roadmap. Fixes for the top blocker/should-fix items were applied and
committed in this session (see "Fixed this session").

---

## Verdict

**Conditional NO-GO for a wide public launch; GO for a controlled pilot** (a handful of
hand-held operators + invited advertisers) once the two remaining blockers below are
closed. The payment pipeline, RLS model, moderation queue, notifications, cron, and the
kiosk/agent stack are genuinely in good shape and recently hardened. The gaps that stop a
*public* launch are (1) advertisers cannot upload their own creative, and (2) a few
trust/compliance essentials. The critical `screen_token` leak found this pass is **fixed**.

---

## Fixed this session (committed `5fcb192`)

| Fix | Rank | Where |
|-----|------|-------|
| `screen_token` no longer readable by advertisers; owner-scoped `get_screen_token()` RPC | **Blocker** | migration `20260703000000`, `ScreenDetail.jsx`, `ScreenOnboard.jsx` |
| Operator scan visibility scoped to own screens (was cross-tenant) | Should-fix | migration |
| `campaign_stats` / `presence_current` views set `security_invoker` (advisor ERROR) | Should-fix | migration |
| Dropped broad public-listing policies on `creatives` / `screen-photos` buckets | Should-fix | migration |
| DisplayPlayer keeps last-approved ads during transient feed error (was blanking to idle) | Should-fix | `DisplayPlayer.jsx` |

Verified: build passes; RPC returns the token for the owning operator and `null` for anyone
else; `screen_token` column SELECT grant removed for `anon`/`authenticated`.

---

## Remaining blockers (must fix before public go-live)

### B1 — Advertisers can't upload their own creative
The campaign builder collects only a headline, CTA text, destination URL, category, and an
accent colour. The display renders a **generated gradient slide** — never an uploaded image
or video. The `creatives` storage bucket and its RLS policies exist but **nothing in the app
writes to them**. No real advertiser, and certainly no agency or corporation, will run a
campaign that can't show their designed ad.
- **Impact:** the product's core promise ("run *your* advertisement") isn't met.
- **Work:** add an image/video upload step to `CreateCampaign` → store in `creatives/<uid>/…`
  → persist `creative_url` on `bookings` + per-screen override on `campaign_screens` →
  render it in `DisplayPlayer` (`<img>`/`<video>` layer) and `CreativePreview`. Keep the
  generated slide as a fallback when no asset is uploaded. Enforce type/size limits and
  aspect-ratio guidance (landscape 16:9, portrait 9:16 for `screen_position`).

### B2 — Stub impressions are fabricated on camera-less screens
`DisplayPlayer` posts `people_count: 1, attention_score: 1.0` every rotation regardless of
whether a camera/CV agent is attached. Screens running display-only (the majority at launch)
will report a steady stream of fake "1 person watched" impressions to advertisers.
- **Impact:** advertisers are billed against / shown fabricated audience numbers — a
  material-misrepresentation and trust problem.
- **Work:** stop sending synthetic `people_count` from the browser. Either (a) send a
  *playback* event (ad was on screen) distinct from a *measured impression*, and only count
  real audience from the CV agent; or (b) clearly label browser-only numbers as "plays," not
  "impressions/people." Advertiser analytics must distinguish measured vs estimated.

---

## Should-fix (will cause support burden / trust issues)

- **S1 — Email one-click approve is a GET** (`handle-approval-token`). Email security
  scanners / link prefetchers (Outlook SafeLinks, Gmail, etc.) will fetch the URL and
  silently consume the single-use token, auto-approving or auto-rejecting a campaign the
  operator never clicked. Change to a landing page with an explicit POST confirm button.
  (The `approval_tokens` table is currently empty, so this path may be dormant — verify it's
  either wired safely or disabled before launch.)
- **S2 — Leaked-password protection disabled** (Supabase Auth). Enable HaveIBeenPwned check
  (Auth → Providers/Policies). One toggle; can't be set from SQL.
- **S3 — `service_insert_*` RLS policies use `WITH CHECK (true)`** on `operator_transfers`,
  `payouts`, `pixel_events`, `presence_logs`, `scan_events`. These are inserted by the
  service role (which bypasses RLS anyway), so scope the policies to
  `auth.role() = 'service_role'` to satisfy the linter and prevent an authenticated client
  from inserting forged rows.
- **S4 — Legacy dead schema.** `advertisers`, `campaigns`, `campaign_placements`,
  `scan_events`, `impression_logs`, `pixel_events`, `presence_logs`, `revenue_ledger`,
  `transactions`, `campaign_analytics`, `screen_host_revenue` are all empty, from the old
  `screens.owner_id` data model, and several carry broad `is_operator()` `ALL` policies that
  would leak cross-tenant if ever populated. Plan a reviewed `DROP` migration (they're not
  referenced by the live app, which uses `bookings`/`campaign_screens`/`scans`/
  `impression_events`).
- **S5 — Search-path-mutable functions** (`is_operator`, `is_advertiser`,
  `current_advertiser_id`, `current_role`, `set_updated_at`). Add `SET search_path` to each
  (advisor WARN, privilege-escalation hardening).
- **S6 — `ingest-impressions` has no rate-limit or bounds validation.** With B1/token fixed
  the blast radius shrinks, but a valid screen token can still spam arbitrary
  `people_count`. Add basic clamping (e.g. 0–2000) and a per-token rate cap.

## Nice-to-have

- **N1 — Phantom `screen-health-cron`.** Cron job #2 (every 5 min) POSTs to a
  `screen-health-cron` edge function that **does not exist in the repo** → 404 each run, and
  `screens.health_status` is never written (so the "Degraded" badge in the dashboards is dead
  code; offline detection still works via `last_seen` in `notification-cron`). Either build
  the function or drop the cron job + the `health_status` UI path.
- **N2 — `notification-cron` stale check is N+1** (one heartbeat query per screen). Fine for
  dozens; rewrite as a single grouped query before hundreds of screens.
- **N3 — Bundle size** ~888 kB JS in one chunk. Code-split (Leaflet, marketing home, display
  player) for faster first paint, especially on operator mobile.
- **N4 — ToS wording vs. reality:** ToS says budgets are "charged in full at the time the
  Operator approves" but the code charges when the advertiser clicks Pay (advertiser-driven,
  can precede approval). Align the copy or the flow.

---

## Go / No-Go by area (this pass)

| Area | Status | Note |
|------|--------|------|
| 1. Onboarding (advertiser + operator) | 🟡 GO w/ B1 | Wizards are solid; blocked only by missing creative upload |
| 2. Payments (Stripe) | 🟢 GO | Charge lock, 3DS handling, refund/dispute webhooks, operator transfers all present & recently fixed |
| 3. Approval / moderation queue | 🟢 GO | End-to-end, bulk approve, per-screen reject reasons, auto-approve w/ liability notice |
| 4. Screen agent / display player | 🟡 GO w/ B2 | Kiosk service + Docker CV agent solid; fix fabricated impressions |
| 5. Security (RLS / auth / secrets) | 🟢 GO | Token leak fixed this pass; remaining items are S2/S3/S5 hardening |
| 6. Notifications | 🟢 GO | Cron scheduled & active (daily/health/pending push); email + Expo push wired |
| 7. Mobile / responsive | 🟡 | Mobile app exists; public marketing/site responsive recently patched — re-verify next pass |
| 8. Error / empty states | 🟢 GO | Login, wizards, queue, display all handle empty/error paths |
| 9. Legal / compliance | 🟡 GO w/ S1 | ToS + Privacy present; add cookie/consent posture + fix GET-approve |

---

## Feature gaps for agencies & large corporations

Already built (good foundation): delegate accounts / account switching (`account_grants`,
`activeAccount`), agency-vs-client billing choice at checkout (`billed_to_profile_id`),
team members + per-client roles (`team_members`, `team_member_client_roles`), multi-currency,
Stripe Connect payouts, per-screen creative overrides, radius/venue targeting.

Missing for that segment (see roadmap): rich-media + multi-asset creatives, reporting/export
API, bulk campaign import, programmatic/PMP buying, white-label, SSO/SAML, invoicing (vs.
card-only), and audience guarantees / make-goods.

---

## Enterprise / agency roadmap (post-launch phases)

**Phase 1 — "Real ads" (launch-critical, overlaps B1):**
image/video creatives, multi-asset rotation, aspect-ratio presets, creative moderation of
uploaded media (not just text), scheduling by daypart already exists.

**Phase 2 — Agency scale:**
bulk/CSV campaign creation, saved audiences & reusable targeting, org-level rollup reporting
across client accounts, seat management UI, approval workflows (maker/checker), consolidated
monthly invoicing + credit terms (Stripe Invoicing) instead of per-campaign card charge.

**Phase 3 — Corporation / programmatic:**
Reporting API + webhooks (impressions, scans, spend) for BI tools, read/write campaign API,
private-marketplace deals, SSO/SAML + SCIM, audit logs, contracted CPM with make-good
credits when delivery falls short, brand-safety category controls at the org level,
white-label operator networks.

**Phase 4 — Marketplace depth:**
programmatic auction / real-time bidding across the screen inventory, dynamic pricing by
venue/daypart/measured audience, third-party measurement partners, proof-of-play
certification for OOH buyers.

---

## Physical device — recommendation, buy list, runbook

Goal: one physical screen that (a) runs ads and (b) sends results to the platform. Two tiers,
because the display and the audience-measurement agent are independent.

### Recommendation

- **Pilot / cheapest path to "ads + heartbeat + play events": Raspberry Pi 5 (8 GB)** running
  the existing `adgrid-display.service` Chromium kiosk. Matches the repo exactly, ~CAD $150
  all-in, boots straight into the player, auto-restarts on crash. This alone gets a real
  device showing ads and reporting online status today.
- **Recommended for real audience metrics: Pi 5 (8 GB) + USB webcam + the Docker CV agent**
  (`camera`/`inference`/`pusher`). CV inference on the Pi 5 CPU is fine at the configured
  1 fps / 30 s aggregation window.
- **Scale-up when CV accuracy/throughput matters: Intel N100 mini PC.** x86 (easier Docker),
  4K output, more headroom for the detector, ~CAD $250–350. Recommend this once you move past
  the first 1–2 pilot screens or want reliable demographic estimation.
- **Avoid for now: Android TV / Fire Stick.** Display-only works via Fully Kiosk Browser, but
  there is **no native agent port**, so no CV/audience data. Fine as a dumb display, not for
  the measured-impressions story.

### Buy list (Pi 5 pilot with camera)

| Item | Approx CAD |
|------|-----------|
| Raspberry Pi 5, 8 GB | 110 |
| 27 W USB-C PSU (official) | 20 |
| Active-cooler or case w/ fan | 15 |
| 64 GB A2 microSD (or NVMe HAT + SSD for reliability) | 15 |
| microHDMI→HDMI cable | 10 |
| USB webcam (Logitech C270/C920 class, UVC) | 30–90 |
| The screen/TV (HDMI input) | existing |
| **Total (ex-screen)** | **~200–260** |

### Setup runbook (already scaffolded in-repo)

1. **Display (required):** flash Raspberry Pi OS → `sudo apt install chromium-browser` →
   install `screen-agent/display/adgrid-display.service` + `/etc/adgrid-display.env` with
   `DISPLAY_URL=https://app.adgrid.io/display/<SCREEN_TOKEN>` → `systemctl enable --now
   adgrid-display`. Screen token comes from the operator's **Setup Guide** tab (now served via
   the `get_screen_token` RPC). Disable screen blanking (`xset s off/-dpms/s noblank`).
2. **Camera agent (optional, for real metrics):** plug in the USB camera → set
   `SCREEN_TOKEN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` in the compose env →
   `docker compose up -d`. Camera → inference → pusher sends anonymous aggregate stats to
   `ingest-impressions`.
3. **Verify:** operator dashboard "Test Connection" checks for a heartbeat in the last 5 min;
   `screens.status` flips to `live` on first heartbeat.

Gaps to close in the runbook before handing hardware to a non-technical operator: a
pre-flashed image or one-line installer (curl|bash) instead of manual systemd copying, and a
factory-reset / re-pair path if the token is rotated.

---

## Next pass — focus areas

Rotate to the areas not deep-dived this pass:
1. **Mobile / responsive (area 7)** — re-verify the public marketing site + operator dashboard
   on real phone widths after recent patches; the operator mobile app auth/push paths.
2. **Creative pipeline (B1) implementation review** — once built, moderate *uploaded media*,
   not just text.
3. **Legal/compliance depth (area 9)** — cookie/consent banner, DOOH privacy signage copy,
   data-retention policy for `scans`/`impression_events`, GDPR/PIPEDA posture.

Areas already covered deeply and not worth re-flagging next pass unless code changes:
payments, moderation queue, RLS/security core, notifications/cron.
