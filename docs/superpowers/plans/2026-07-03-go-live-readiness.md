# AdGrid Go-Live Readiness — Deep Pass (2026-07-03)

Audience: advertisers, screen owners/operators, marketing agencies, large corporations.
Scope of this pass: full sweep across all 9 readiness areas + physical-device plan +
enterprise roadmap. Fixes for the top blocker/should-fix items were applied and
committed in this session (see "Fixed this session").

---

## Verdict

**Both go-live blockers are closed and every actionable should-fix is done.** The **only
remaining action is S2** — a one-toggle Auth setting that can't be changed from code/SQL/MCP
(exact steps below). Recommended path: **GO for a controlled pilot now**; flip S2 before a
**wide public launch**. The payment pipeline, RLS model (critical `screen_token` leak fixed),
moderation queue, notifications, cron, and kiosk/agent stack are in good shape.

> **Update — session 2 (2026-07-03):** Shipped B1, B2, S3, S4, S5, S6, S7, N1, and retired the
> legacy GBP payment path. Final security-advisor state: all ERROR + all fixable WARNs cleared;
> what remains is intentional-by-design (7 SECURITY-DEFINER helpers that RLS policies must call),
> 2 harmless INFO (deny-all `approval_tokens`/`cities`), and S2. Commits `5fcb192`→`f622f0a`.

---

## Fixed this session (committed `5fcb192`)

| Fix | Rank | Where |
|-----|------|-------|
| `screen_token` no longer readable by advertisers; owner-scoped `get_screen_token()` RPC | **Blocker** | migration `20260703000000`, `ScreenDetail.jsx`, `ScreenOnboard.jsx` |
| Operator scan visibility scoped to own screens (was cross-tenant) | Should-fix | migration |
| `campaign_stats` / `presence_current` views set `security_invoker` (advisor ERROR) | Should-fix | migration |
| Dropped broad public-listing policies on `creatives` / `screen-photos` buckets | Should-fix | migration |
| DisplayPlayer keeps last-approved ads during transient feed error (was blanking to idle) | Should-fix | `DisplayPlayer.jsx` |
| **B1** — advertiser image/video creative upload (builder → bucket → feed → player/preview) | **Blocker** | `CreateCampaign.jsx`, `CreativePreview.jsx`, `DisplayPlayer.jsx`, `display-feed` v8, migration `…000002` |
| **B2** — stop fabricated `people_count:1` from browser; real audience only from CV agent | **Blocker** | `DisplayPlayer.jsx`, `Dashboard.jsx` |
| **S3** — scope `service_insert_*` INSERT policies to `service_role` | Should-fix | migration `…000001` |
| **S5** — pin `search_path`; revoke client EXECUTE on trigger/internal functions | Should-fix | migration `…000001` |

Verified: build passes; token RPC returns the token for the owning operator and `null` for
anyone else; deployed `display-feed` returns `media_url`/`media_type` through the new columns;
advisor no longer reports the security-definer-view ERROR, always-true INSERT, trigger-exec,
or search_path warnings.

---

## Blockers — DONE this session

Both launch blockers are implemented and committed (`acca238`, `e3435b8`):

- **B1 (creative upload).** `CreateCampaign` has an image/video upload step (own-folder RLS,
  validation matching the bucket: images ≤15 MB, video ≤100 MB, JPG/PNG/GIF/WEBP/MP4/WEBM/MOV).
  Media persists to `bookings.media_url/media_type` with per-screen override columns on
  `campaign_screens`; `display-feed` (v8) serves it with override precedence; `DisplayPlayer` +
  `CreativePreview` render it full-bleed with a legibility scrim and fall back to the generated
  card when absent. Operators now moderate the *actual* creative in the approval queue.
- **B2 (honest impressions).** The browser player no longer posts synthetic `people_count:1`;
  measured audience comes only from the CV screen-agent, online/proof-of-play via
  `display_heartbeats`. Removed the `|| 1` people fallback in the operator dashboard.

Follow-up (not blocking): a "plays vs measured impressions" split in advertiser analytics, and
per-screen media override UI (columns already exist).

---

## Should-fix (will cause support burden / trust issues)

- **S1 — Email one-click approve is a GET** (`handle-approval-token`). Email security
  scanners / link prefetchers (Outlook SafeLinks, Gmail, etc.) will fetch the URL and
  silently consume the single-use token, auto-approving or auto-rejecting a campaign the
  operator never clicked. Change to a landing page with an explicit POST confirm button.
  **Confirmed dormant this session:** nothing in the app or edge functions issues
  `approval_tokens` or emails a `handle-approval-token` link, so it is not currently
  exploitable — but fix the GET→POST design *before* wiring it up (all approvals today go
  through the in-app queue + `campaign_approved` notification).
- **S2 — Leaked-password protection disabled** (Supabase Auth). ⚠️ **Only remaining manual
  action** — cannot be set via SQL or the MCP tools. In the Supabase Dashboard:
  **Authentication → Sign In / Providers → Password → enable "Leaked password protection"**
  (or Authentication → Policies on older UI). Verifies passwords against HaveIBeenPwned on
  signup/change. ~30 seconds; no code impact.
- **S3 — `service_insert_*` RLS policies use `WITH CHECK (true)`** on `operator_transfers`,
  `payouts`, `pixel_events`, `presence_logs`, `scan_events`. These are inserted by the
  service role (which bypasses RLS anyway), so scope the policies to
  `auth.role() = 'service_role'` to satisfy the linter and prevent an authenticated client
  from inserting forged rows.
- **S4 — Legacy dead schema.** ✅ **Dropped** (`…000003`): the 10 empty legacy tables
  (`campaigns`, `campaign_placements`, `campaign_analytics`, `scan_events`, `impression_logs`,
  `pixel_events`, `presence_logs`, `revenue_ledger`, `transactions`, `screen_host_revenue`) +
  the 2 unused views (`campaign_stats`, `presence_current`). Verified 0 rows, no live
  references, no FKs. `advertisers` (4 rows of old data) kept — not load-bearing
  (`current_advertiser_id()` is `SELECT auth.uid()`), retire separately if desired.
- **S5 — Search-path-mutable functions.** ✅ **Applied** (`…000001`): `SET search_path` on the
  five helpers + client `EXECUTE` revoked on the trigger/internal functions.
- **S6 — `ingest-impressions` input clamping.** ✅ **Done** (deployed v6): every numeric field
  is clamped (people/demographics 0–5000, attention 0–1, dwell 0–86400) so a leaked token can't
  poison analytics. Verified 999999→5000. A per-token *rate* cap is still a future add.
- **S7 — Backend source drift.** ✅ **Recovered** (`44b7af6`): all 10 deployed-but-untracked
  functions pulled into `supabase/functions/`. Follow-ups surfaced:
  - **Legacy GBP payment path** — ✅ **Retired** (`f622f0a`): confirmed no client calls, then
    redeployed `stripe-create-intent`, `stripe-capture-payment`, `stripe-refund`,
    `create-checkout-session` as `410 Gone` stubs (v12). No delete API is exposed here, so full
    removal from the project is a one-line CLI follow-up (`supabase functions delete <slug>`).
  - **Operator identity verification (Stripe Identity)** — `create-identity-session`,
    `stripe-identity-webhook`, `manual-review-operator` are a whole KYC flow that was live but
    undocumented; now in source control. Follow-up: fold into the operator onboarding story and
    confirm `STRIPE_IDENTITY_WEBHOOK_SECRET` is set.

## Nice-to-have

- **N1 — `screen-health-cron` value mismatch.** ✅ **Fixed** (`f622f0a`): dashboards map
  `offline`→Offline, `idle`→Stale (with `last_seen` fallback). **Plus a real bug found & fixed**
  (`4b39e48`): the cron called `send-notification` with no auth header, so every near-real-time
  `screen_offline` alert silently 401'd — offline alerts only went out in the daily batch. Added
  the `x-internal-secret` header + `minutes`/`appUrl` data (deployed v3).
- **N2 — `notification-cron` N+1 offline scan.** ✅ **Removed** (`4b39e48`): offline alerting now
  lives solely in `screen-health-cron` (transition-based, deduped). Killed the per-screen
  heartbeat query and the double-alert. Deployed notification-cron v12.
- **N3 — Bundle size.** ✅ **Split** (`a9073c6`): public routes (MarketingHome, DisplayPlayer,
  Privacy, Terms) are `React.lazy` chunks. Main chunk 888 kB → 812 kB; marketing home (63 kB) +
  display + legal load on demand instead of with the dashboard.
- **N4 — ToS payment wording.** ✅ **Fixed** (`a9073c6`): §5 now states the charge is
  advertiser-initiated at payment submission and a screen only airs once payment is captured AND
  the operator approves — matching the real flow.
- **N5 — Operator identity KYC has no UI (NEW, optional).** The recovered `create-identity-session`
  / `stripe-identity-webhook` / `manual-review-operator` (Stripe Identity) flow + the
  `identity_verifications` table are fully deployed but **zero frontend references them**. Not
  launch-blocking — Stripe **Connect** already runs KYC during payout onboarding
  (`create-connect-account`). Wire a "Verify identity" button + status badge into operator
  settings only if you want stronger KYC than Connect provides.

---

## Go / No-Go by area (this pass)

| Area | Status | Note |
|------|--------|------|
| 1. Onboarding (advertiser + operator) | 🟢 GO | Wizards solid; creative upload (B1) now shipped |
| 2. Payments (Stripe) | 🟢 GO | Charge lock, 3DS handling, refund/dispute webhooks, operator transfers all present & recently fixed. See S7 (two payment code paths, drift) |
| 3. Approval / moderation queue | 🟢 GO | End-to-end, bulk approve, per-screen reject reasons, auto-approve w/ liability notice; now shows real uploaded creative |
| 4. Screen agent / display player | 🟢 GO | Kiosk service + Docker CV agent solid; fabricated impressions (B2) fixed |
| 5. Security (RLS / auth / secrets) | 🟢 GO | Token leak + RLS/function hardening done; remaining: S2 toggle, S7 drift |
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
