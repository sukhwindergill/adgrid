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

> **Update — session 3 (2026-07-06/07-07):** Two more go-live passes, both went deeper on areas
> already marked GO and found real problems static review alone missed.
>
> - **B3 (blocker, found + fixed) — camera collection misdescribed.** Privacy Policy flatly denied
>   any camera/CV data collection; the shipped screen-agent pipeline actually estimates and
>   transmits aggregate age/gender/dwell/attention stats. Corrected the policy copy and added an
>   operator-facing disclosure + venue-signage requirement to the Setup Guide (`607f34e`, `7611a6f`).
> - **B4 (blocker, found + fixed) — operator mobile app never worked.** `useApprovals`/`useRevenue`
>   embedded a `campaigns` table dropped in S4 and a `creatives` table that never existed;
>   `useScreens` explicitly selected the now-revoked `screen_token` column, hard-erroring the
>   entire Screens tab and cascading into Approvals. Fixed all three plus `useDashboard`'s
>   nonexistent `bookings.screen_id` filter (`ac23e53`→`7c03289`). Full mobile suite passes
>   (10/10 suites) but never verified on a real device/simulator.
> - **B5 (blocker, found + fixed) — mobile screen-registration wizard was a dead end.** Step 5/5
>   told operators to scan a pairing QR that `DisplayPlayer.jsx` never renders (its only QR is the
>   viewer-facing per-ad destination code). Replaced with the same `get_screen_token` RPC handoff
>   the web Setup Guide already uses, no camera/QR involved (`ca3e181`).
> - **S8 (should-fix, found + fixed) — `Table.jsx` clipped columns on mobile.** Shared primitive
>   used by 8 dashboard views had no horizontal scroll; wide tables (e.g. Billing's 7-column
>   Charges table) silently cut off data on narrow viewports, no way to reveal it (`9ef5294`).
> - **B6 (blocker, found live, fixed) — nobody could log in.** `RequireAuth` redirected
>   unauthenticated users to `/login`, but nothing redirected the other way. A successful
>   password sign-in updated `AuthContext`'s `user` state but the mounted `/login` route never
>   re-checked auth and never navigated anywhere — the login form just sat there forever after a
>   genuinely successful auth. Confirmed via live Supabase auth logs: 15+ successful password
>   grants in under a minute from a real user re-submitting a form that looked broken. Same gap
>   affected the OAuth callback and password-recovery links (both land on `/` post-auth). Fixed
>   with a `PublicOnlyRoute` wrapper that redirects an authenticated user away from `/` and
>   `/login` to `/app` (`f4aa58f`). **This is the one that actually mattered** — everything else
>   this session was found by reading code; this one was only found by trying to log in for real.
> - **9 local commits had never been pushed** (`05ff4a1`→`f4aa58f`) — Vercel production
>   (`adgrid-mu.vercel.app`) was serving a build from mid-June, predating the entire landing
>   redesign. Pushed + redeployed via `vercel deploy --prod`.
> - **New open item — Google OAuth is broken in production.** Every "Continue with Google"
>   attempt 500s with `oauth2: "invalid_client" "The provided client secret is invalid."`
>   Confirmed via live Supabase auth logs, not a code bug — the configured Google OAuth client
>   secret in Supabase Auth → Providers → Google is wrong/expired. Needs a fresh secret from
>   Google Cloud Console. Password login is unaffected and works.
> - **S1 and S2 re-verified, both unchanged.** S1 (`handle-approval-token` GET) still dormant —
>   nothing issues `approval_tokens` or emails that link. S2 (leaked-password protection) still
>   disabled per live Supabase advisor pull — still the one remaining manual dashboard toggle.

> **Update — session 4 (2026-07-07):** Checked the two manual-only toggles first — **both still
> open.** Live Supabase auth logs show the Google OAuth callback still 500ing with
> `invalid_client "The provided client secret is invalid"` as of 07:43 today; security advisor
> still reports `auth_leaked_password_protection` WARN. Neither can be fixed from code/SQL/MCP —
> still need a human in the Supabase/Google dashboards. No login credentials were provided this
> session, so the real logged-in click-through (Next-pass item 3) and native mobile app run
> (item 4) are still outstanding — do those next once credentials/a device are available.
>
> - **S1 (should-fix, fixed) — `handle-approval-token` GET performed the mutation directly.**
>   Re-confirmed still dormant (no code path issues `approval_tokens` rows or emails a link — same
>   as session 3). Fixed the design flaw anyway per the plan: GET now renders an inert confirmation
>   page (campaign/advertiser/screen name, single-use warning, a POST form) instead of mutating;
>   the actual approve/reject only runs on POST, triggered by the operator clicking the button.
>   Deployed `handle-approval-token` v3. **Verified live**: inserted a real disposable
>   `approval_tokens` row against an existing booking/screen, GET returned the confirmation page
>   and the token was still `used = false` in the DB afterward (prefetcher-safe); did not POST
>   against the real row (would mutate a live booking) — the POST branch itself is the prior,
>   already-verified mutation code, now just gated behind `req.method === 'POST'`. Cleaned up the
>   test token row after.
> - **Legal/compliance depth pass (Next-pass item 6).** Read Privacy Policy, ToS, and the actual
>   signup/auth code (not just the policy text). ToS content rules, refund wording, and the
>   signup Terms/Privacy checkbox + `tos_accepted_at` capture were all already solid — no new
>   issue there. Two real, previously unflagged problems found and fixed:
>   - **Cookie policy was factually wrong.** Privacy Policy claimed "strictly necessary session
>     cookies for authentication." Grepped the entire codebase (`src/`, all edge functions) for
>     `document.cookie` / `Set-Cookie` / `js-cookie` — zero matches. The Supabase client uses its
>     default `localStorage` session storage; AdGrid sets **no cookies at all**. Rewrote the
>     section to state this accurately (`src/views/legal/PrivacyPolicy.jsx`). This also means no
>     cookie-consent banner is legally required (nothing to consent to) — closing that item outright
>     rather than needing to build one.
>   - **Promised data-retention windows were entirely unenforced.** Policy states screen
>     telemetry/heartbeats are kept 12 months and QR scans 24 months, "after which
>     automatically deleted" (implied) — but no cron, function, or migration anywhere in the repo
>     ever deleted a row from `display_heartbeats`, `impression_events`, or `scans`. Making a
>     written retention promise with no enforcement is itself a compliance gap, independent of
>     whether the data had actually overstayed yet (project is 2.5 months old, so nothing had —
>     confirmed via a dry-run count query before touching anything). Built and deployed
>     `data-retention-cron` (new edge function): daily job deletes `display_heartbeats` /
>     `impression_events` older than 365 days and `scans` older than 730 days. Scheduled via
>     `pg_cron` in a new tracked migration (`20260707000000_data_retention_cron_schedule.sql`) —
>     the existing `notification-cron`/`screen-health-cron` schedules were only ever set up ad hoc
>     in the Supabase dashboard SQL editor and were never in a migration; this one now is. Also
>     updated the Privacy Policy's retention paragraph to explicitly cover
>     `impression_events` (aggregate audience stats), which previously had no stated retention
>     window at all. **Did not** live-invoke the new cron endpoint directly (auto-mode classifier
>     correctly blocked it as an unbounded production DELETE) — instead verified via a read-only
>     SQL count using the identical cutoff predicates (all three returned 0, matching expectation
>     for a young project), then confirmed the `pg_cron` job is registered and active.
>
>   **Account-deletion self-service** was considered and intentionally *not* built this pass — the
>   existing "email privacy@adgrid.io, we respond within 30 days" manual process is a common,
>   acceptable pattern for a young platform and doesn't block launch. Flagging as a future
>   nice-to-have only if support volume on deletion requests becomes real.

> **Update — session 5 (2026-07-07, later same day):** User logged into the real production app
> via their own Google-authenticated browser session and asked for a live click-through using
> claude-in-chrome. Found and fixed **two more real blockers** — both invisible to static review,
> both only surfaced by actually using the app as a real logged-in user:
>
> - **B7 (blocker, found live, fixed) — operator dashboard completely broken: infinite RLS
>   recursion on `bookings`.** Loading `/app/overview` as an operator threw "Failed to load data.
>   Please refresh." Console: `Failed to load campaigns: infinite recursion detected in policy for
>   relation "bookings"`. Root cause: `20260701000000_scope_operator_bookings_rls.sql` (session 3,
>   a real security fix) replaced an overbroad bookings policy with
>   `operators_see_own_screen_bookings`, an `EXISTS` subquery reading `campaign_screens` — but
>   `campaign_screens`'s own SELECT policy (`advertiser_read_own_campaign_screens`, from
>   `20260607000000`) is itself an `EXISTS` subquery reading `bookings`. Every operator SELECT on
>   `bookings` since that migration shipped triggered an unbounded policy-evaluation cycle:
>   bookings → campaign_screens → bookings → ... Postgres detects the cycle and errors out
>   entirely — the operator dashboard, approval queue, and revenue page have been broken for
>   every operator since **2026-07-01**. Fixed (`20260707000001_fix_bookings_rls_recursion.sql`):
>   moved the ownership check into a new `SECURITY DEFINER` helper,
>   `operator_owns_booking_screen(campaign_id)`, using the same bypass-RLS pattern already
>   established by `is_operator()`/`current_advertiser_id()` — the helper's internal query runs as
>   the function owner and never re-triggers `campaign_screens`' policies, breaking the cycle.
>   **Verified live**: reloaded the real dashboard post-fix — real data appeared (Network Revenue
>   $15,650, 2 active campaigns, 183 QR scans), Approval Queue showed a real campaign that had
>   been stuck pending review for **34 days** because the operator could never see it. Approved it
>   live at the user's instruction; confirmed via SQL that `campaign_screens.status` flipped to
>   `approved`. (The booking itself stayed `pending_review` because it was unpaid `payment_status:
>   null` seed/demo data predating the Stripe pipeline — confirmed by design, not a bug: `bookings.status`
>   only promotes to `scheduled` inside `charge-campaign` once payment actually captures.)
> - **B8 (blocker, found live, fixed) — advertiser campaign wizard crashed on every attempt.**
>   Step 4 of 5 ("Budget & Schedule") threw `ReferenceError: profile is not defined`, caught by the
>   `ErrorBoundary` ("Something went wrong") — **nobody could create a campaign at all.**
>   `StepBudget` (`src/views/advertiser/CreateCampaign.jsx:618`) referenced `profile` in its JSX
>   (currency label, suggested-budget hint) but was never passed `profile` as a prop, and the
>   parent only passed `form`/`setForm`/`matchedScreens`. Fixed by threading `profile` through as a
>   prop. **Verified live**: rebuilt, pushed, redeployed, reloaded the exact same wizard flow as
>   the same real advertiser account — Budget & Schedule now renders correctly ("Total budget
>   (CAD)"), no crash. Did not complete an actual submission: this advertiser account has **no
>   payment method on file** ("Add a payment method before submitting" banner), and adding one
>   would require entering real card details, which is off-limits regardless of user request.
>   Cancelled the test draft afterward; confirmed via SQL no test booking was persisted.
>
> Both fixes committed (`ad57193` bookings RLS migration, `5c048f8` StepBudget), pushed, and
> redeployed to Vercel same as every other fix this session. **These are the two most
> significant findings across all five sessions** — the operator dashboard and the entire
> advertiser campaign-creation flow were both completely non-functional in production, and neither
> was caught by any prior code-reading pass, Jest suite, or advisor pull. Only surfaced by a real
> user actually clicking through their own live account.
>
> Areas re-verified as working live this session: operator Approval Queue (approve action works
> end-to-end), Revenue/Billing page (accurate real numbers, correct math), advertiser campaign
> wizard steps 1–4 (Area → Screens → Creative → Budget, including live creative preview
> rendering). Minor non-blocking observations, not worth separate fixes: sidebar Approval Queue
> badge doesn't refresh its count after an approve action until reload; SPA routing resets to
> `/app/overview` on a hard browser navigation/reload rather than preserving the current tab
> (client-side-only routing, not URL-driven) — both cosmetic, not correctness bugs.

> **Update — session 5 continued (2026-07-07, same day):** User flagged "email+password signup
> doesn't work right" (no confirmation email). Investigation surfaced a bigger problem than the
> one asked about.
>
> - **Root cause of the signup complaint:** Supabase Auth's confirmation emails use Supabase's own
>   default mailer (`noreply@mail.app.supabase.io`), not Resend — despite Resend already being
>   wired up for the app's own transactional emails. The default mailer is explicitly test-only and
>   rate-limited; live evidence backs this up: of 5 users ever created, 1 (`demo@adgrid.io`) never
>   confirmed. Recommended fix (wiring Resend as Supabase's custom SMTP relay) requires a verified
>   sending domain — user doesn't own `adgrid.io` yet, so **decision: leave Auth on the default
>   mailer for now.** Confirmation email delivery stays unreliable until a domain is bought and
>   verified in Resend; revisit then.
> - **B9 (blocker, found live, fixed) — `send-notification` had no CORS/OPTIONS handling at all.**
>   While investigating the email question, live-tested the notification pipeline and found this:
>   every browser-originated call to `send-notification` (campaign approved, campaign submitted,
>   etc.) sends a custom `Authorization` header, which forces the browser to CORS-preflight with an
>   OPTIONS request first. The function had no OPTIONS branch, so the preflight fell into the auth
>   check, which requires a header no preflight ever carries → 401. The browser then aborts the
>   real POST entirely, and the frontend's `.catch(() => {})` swallows the resulting network error
>   silently. **Every in-app-triggered notification has been failing to even reach the function in
>   production since it was written** — confirmed via edge-function logs showing the exact OPTIONS
>   401 at the same instant this session's earlier Approval Queue click fired
>   `notifyCampaignApproved`. Fixed by adding the same `CORS`-const + OPTIONS-short-circuit pattern
>   already used by the other 13 browser-facing edge functions in this project. Deployed v15.
>   **Verified live**: OPTIONS preflight now returns 200 (was 401); a full authenticated POST from
>   the real browser session round-trips successfully — confirmed a real `notifications` row was
>   inserted (then deleted as test cleanup).
> - **Separate, more severe finding surfaced by the same test: Resend delivery is completely dead
>   for every transactional email, not just Auth's.** The test POST took 934ms (vs ~100–600ms for
>   validation-error paths) and returned `emailSent: false` — meaning it actually called Resend and
>   Resend rejected the send, not that it was skipped. Root cause is the same unowned-domain issue:
>   `send-notification`'s `FROM_EMAIL` is hardcoded to `noreply@adgrid.io`
>   (`supabase/functions/send-notification/index.ts:9`), which isn't a verified Resend sending
>   domain. **In-app bell notifications still work** (the `notifications` table insert happens
>   unconditionally, before the email attempt) but the email copy of every notification — campaign
>   approved, payment failed, payout sent, screen offline, etc. — has been silently failing since
>   this function was deployed. **User's decision: leave `FROM_EMAIL` as-is for now** (no domain to
>   point it at yet); revisit once a domain is bought and verified in Resend. Until then, treat
>   AdGrid's notification system as **in-app only, no email delivery**, for planning purposes.

---

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

- **S1 — Email one-click approve is a GET** (`handle-approval-token`). ✅ **Fixed session 4**:
  GET now renders an inert confirmation landing page (campaign/advertiser/screen name, single-use
  warning); the actual approve/reject only executes on an explicit POST from the confirm button.
  Deployed v3. Still dormant — nothing issues `approval_tokens` rows or emails a link yet — but
  the design flaw is closed *before* it's ever wired up (all approvals today go through the
  in-app queue + `campaign_approved` notification).
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
- **N5 — Operator identity KYC has no UI.** ✅ **Built** (`6555f56`): new Verification tab in
  `OperatorSettingsView` — status card driven by `profiles.verification_status`
  (unverified/pending_stripe/pending_manual/verified/rejected, with rejection reason + retry),
  "Verify Identity" calls `create-identity-session` and redirects to Stripe's hosted flow, handles
  the `?identity=complete` return param. Verified all 4 render states via a disposable test
  operator account (cleaned up after). Did not trigger the actual Stripe Identity call itself —
  that creates a real, live verification session, out of scope for UI-only testing. Still
  optional/non-blocking: Connect already runs payout KYC.

---

## Go / No-Go by area (this pass)

| Area | Status | Note |
|------|--------|------|
| 1. Onboarding (advertiser + operator) | 🟢 GO | Wizards solid; creative upload (B1) shipped; mobile screen-registration dead end fixed (B5); `/login` no-redirect bug (B6) fixed; **advertiser wizard crash (B8, `profile is not defined`) fixed session 5 — was blocking every campaign creation** |
| 2. Payments (Stripe) | 🟢 GO | Charge lock, 3DS handling, refund/dispute webhooks, operator transfers all present & recently fixed. See S7 (two payment code paths, drift) |
| 3. Approval / moderation queue | 🟢 GO | End-to-end, bulk approve, per-screen reject reasons, auto-approve w/ liability notice; shows real uploaded creative on web and now on mobile too (B4) |
| 4. Screen agent / display player | 🟢 GO | Kiosk service + Docker CV agent solid; fabricated impressions (B2) fixed; re-confirmed 2026-07-06 (graceful network-error fallback, clear invalid-token state) |
| 5. Security (RLS / auth / secrets) | 🟡 | Token leak + RLS/function hardening done, S1 fixed session 4, S2 still open (manual toggle, low-risk) — **Google OAuth still broken in production (bad client secret), manual fix needed** — **B7 RLS infinite-recursion on `bookings` fixed session 5 (was breaking the entire operator dashboard since 2026-07-01)** |
| 6. Notifications | 🟡 | Cron scheduled & active (daily/health/pending push); in-app + Expo push work. **Email delivery is fully broken** (session 5): CORS/OPTIONS bug fixed (B9), but every email still fails Resend delivery — `FROM_EMAIL` (`noreply@adgrid.io`) isn't a verified sending domain. In-app + push notifications are reliable; email is not, until a domain is bought and verified in Resend |
| 7. Mobile / responsive | 🟢 GO | Marketing site verified at 375px; native operator app's broken data hooks fixed (B4), dead-end onboarding fixed (B5); shared `Table.jsx` mobile overflow fixed (S8). Native app still never run on a real device/simulator |
| 8. Error / empty states | 🟢 GO | Login, wizards, queue, display all handle empty/error paths; re-verified 2026-07-06 (ErrorBoundary wraps every route, load failures surface as a visible banner) |
| 9. Legal / compliance | 🟢 GO | ToS + Privacy present; camera/CV data collection now accurately disclosed (B3); GET-approve design flaw fixed (S1, session 4); cookie policy corrected + data-retention now enforced (session 4) |

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

All 9 areas have now been covered at least once (07-03 baseline, 07-06/07-07 deep re-checks).
What's actually left, in priority order:

1. **Google OAuth client secret** — manual-only, Supabase Auth → Providers → Google. Blocking
   for anyone who doesn't use password login.
2. **S2 — leaked-password protection toggle** — manual-only, Supabase Auth → Providers → Password.
3. **Real click-through, logged in as a real user** — the `/login` redirect bug (B6) was invisible
   to code review and only surfaced by actually trying to log in. Now that login works, do a full
   advertiser + operator run-through (create campaign → approve → check billing on a phone) to
   catch anything else that only shows up live.
4. **Operator mobile app on a real device/simulator** — the schema fixes (B4) and onboarding fix
   (B5) are verified by Jest against a mocked Supabase client, never against Expo Go or a real
   build.
5. ~~**S1** — GET-based `handle-approval-token`~~ — ✅ **Fixed session 4**: GET now only renders
   a confirmation page; approve/reject requires an explicit POST. Deployed v3, verified live.
6. ~~**Legal/compliance depth (area 9)**~~ — ✅ **Done session 4**: cookie policy corrected
   (AdGrid sets no cookies — no consent banner needed), data-retention now enforced via a new
   `data-retention-cron` (365d telemetry / 730d scans, tracked migration). DOOH venue-signage
   requirement already covered by B3 (session 3). Account-deletion self-service intentionally
   deferred — manual email process is acceptable for now.

Areas that are genuinely solid and not worth re-flagging without a code change: payments,
moderation queue (web), screen agent/display player, notifications/cron, error/empty states,
legal/compliance.

**What's actually left:** the two manual dashboard toggles (Google OAuth secret, Supabase
leaked-password protection), the operator mobile app on a real device/simulator (needs a device),
and **buying + verifying a domain in Resend** (fixes both the signup-confirmation email
reliability issue and all transactional email delivery — currently in-app-only, no email, by
explicit user decision until a domain exists). All are blocked on something this session can't
provide — not on further code review.
