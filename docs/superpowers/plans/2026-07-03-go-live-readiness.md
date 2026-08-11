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

> **Update — session 6 (2026-07-14):** Ran Next-pass item 3 — a full logged-in click-through
> (advertiser signup → create campaign → operator approve → check billing) via a local dev server
> against the live Supabase project, using fresh sign-up test accounts rather than existing
> credentials.
>
> - **B10 (blocker, found + fixed) — campaign creation has been completely broken since the
>   feature was first built.** Submitting the campaign wizard failed 100% of the time with a raw
>   Postgres error surfaced to the user: `null value in column "slots" of relation "bookings"
>   violates not-null constraint`. Root cause: `bookings.slots` and `bookings.duration` are
>   `NOT NULL` with no default, but the 5-step wizard never collected either field and the insert
>   in `CreateCampaign.jsx` never set them — confirmed via `git log`/`git show` back to the
>   original submit-handler commit (`fad2f26`), i.e. **no advertiser has ever been able to create a
>   campaign through the app.** Fixed by adding real "Ad play duration" and "Slot share" inputs to
>   the Budget & Schedule step (not a hidden default) and wiring them through form state, the
>   Review summary, and the `bookings` insert (`225ac27`). Re-verified live: campaign created
>   successfully (`slots=10, duration=15, status='pending_review'`), approved by the real operator
>   account owning the matched Toronto screens (`campaign_screens.status` → `approved` on both),
>   and confirmed correct on the operator Revenue view ($500 gross → $60 platform/12%, $176
>   owner/40%, $264 network pool, status "Pending Review" pending payment — booking status only
>   flips server-side on payment, by design, not a bug).
> - **B6 (login redirect) re-verified live** — confirmed working exactly as fixed in session 3;
>   fresh sign-in landed straight on `/app/adv-overview`, no dead-end.
> - **Possible latent bug, not confirmed** — `App.jsx:202-207` has a `useEffect` keyed on
>   `[user, activeMode]` that unconditionally force-navigates to the mode's overview page. If the
>   `user` object's identity ever changes in the background (e.g. a Supabase token refresh
>   creating a new session object), this would silently kick anyone off whatever page they're on —
>   mid-wizard, mid-form, anywhere — with no warning and nothing saved. Saw this exact symptom
>   repeatedly mid-session but traced every occurrence back to Vite HMR reloading the file being
>   edited, not this effect; never caught a live, non-HMR trigger firing it. Worth a look given the
>   blast radius, but not elevated to a blocker without a confirmed repro.
> - Minor, non-blocking: Supabase's signup rejects `@example.com` addresses (default domain
>   deny-list) — a gotcha for future test scripts, not a user-facing issue. Sidebar nav buttons are
>   icon-only with `title` tooltips but no visible text/`aria-label`.
> - Test data (throwaway advertiser account, test campaign) deleted after verification; the real
>   operator account's password was rotated since it was shared over chat to complete the test.

> **Update — session 7 (2026-07-14):** Attempted Next-pass item 4 — the operator mobile app on a
> real device/simulator. Never reached a real device; this environment has no Android
> emulator/`adb`, no iOS simulator (Windows), and no LAN path from this sandbox to a physical
> phone, so even a working Expo dev server has nothing to hand a real Expo Go client. Fell back to
> `expo start --web` as the closest runtime proxy — Jest mocks the whole Supabase client, so
> *any* real runtime execution is worth more than another mocked test run.
>
> - **B11 (blocker, found + fixed) — the mobile app crashes instantly on Expo web.**
>   `expo-secure-store`'s web build (`ExpoSecureStore.web.js`) is a literal empty stub
>   (`export default {}`), but `mobile/lib/supabase.js` used it unconditionally as the Supabase
>   auth storage adapter with no platform branch — every method call threw, killing the app before
>   first paint (empty `#root`, no visible error, an `ErrorOverlay`-on-`ErrorOverlay` double-fault
>   in the console with the real error swallowed). Fixed by branching on `Platform.OS === 'web'`
>   to a `localStorage`-backed adapter, `SecureStore` unchanged on native (`08f17fe`). Confirmed
>   this specific crash is gone after the fix (no longer throws on `authStorage` calls); a second,
>   unrelated crash remained on web (pre-React-mount, uncatchable by any error boundary — never
>   root-caused, not native-relevant) and further web debugging was abandoned as scope creep: this
>   app was never meant to ship on web, and chasing full web parity stopped being "verify the real
>   app" and started being "build a platform that was never a target."
> - **Verdict: still not verified on a real device.** The schema fixes (B4) and onboarding fix (B5)
>   from session 3 remain Jest-only. Doing this properly needs the user's own machine: `cd mobile
>   && npm start`, scan the QR with Expo Go on a phone on the same Wi-Fi. Not something this
>   environment can complete.
> - Installed then reverted `react-native-web`/`react-dom`/`@opentelemetry/api` — were only needed
>   to get the web-preview proxy running at all, not part of the real fix, not committed.

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

> **Update — session 9 (2026-08-07, go-live-review pass):** No live click-through this session
> (no credentials/device). Verified in code whether the three ICP-sweep blockers (B12–B14) and
> four should-fixes (S13–S16) from `2026-07-14-icp-sweep-findings.md` actually got fixed in the
> three weeks of feature work since (mobile plans 1-4, operator payout pipeline, campaign
> hierarchy phases 1-5, location targeting picker) — none of that work mentioned them, and this
> file was never updated to close them out.
>
> **All seven are fixed in current code:**
> - **B12** (QR bypassed scan-redirect) — `DisplayPlayer.jsx:13-19` `buildQrUrl` now builds a
>   `scan-redirect?c=&s=&cr=` URL; `destinationUrl.js` validation comment explicitly documents why.
> - **B13** (advertiser reads operator `monthly_revenue`) — migration `20260714000000` dropped the
>   row-level advertiser policy on `screens` and added an `advertiser_screens` view with
>   `monthly_revenue` excluded; `App.jsx:164` confirms the advertiser-facing query now reads the
>   view, `owner_own_screens`/`screens_grant_select` are the only remaining base-table policies.
> - **B14** (no Connect onboarding, silent payout skip) — `ScreenOnboard.jsx` `StepConnect` and
>   `OperatorSettingsView.jsx` both wire `startConnect()`; a "Set up payouts" banner exists.
>   `charge-campaign` still skips non-active Connect accounts by design, but operators now have a
>   real path to get out of that state instead of no path at all.
> - **S13** (advertiser→operator notify 403) — `send-notification/index.ts:306-309` now allows
>   `campaign_submitted` to an operator and `grant_invite` explicitly.
> - **S14** (no status gate/dedup on scan-redirect) — `scan-redirect/index.ts:32` 410s unless
>   `status in (scheduled,active) AND payment_status='paid'`; bot/dedup via `_shared/scanQuality.ts`.
> - **S15** (city column actually holds country) — column renamed to `country`, comment at
>   `scan-redirect/index.ts:57` documents it explicitly.
> - **S16** (`monthly_traffic_estimate` never collected) — `ScreenOnboard.jsx:147/166/204/337` now
>   collects and requires it.
>
> **New, previously-unflagged item checked and cleared, not a bug:** the campaign-hierarchy
> per-creative budget split (`StepBudgetReview.jsx:73-93`) looked at first read like it might let
> per-creative amounts diverge from the top-level `bookings.budget` actually charged by
> `charge-campaign`. It's by design — the UI copy at line 75 states per-creative amounts are a
> reporting split of the total, not additive — and `charge-campaign` only ever reads
> `booking.budget`, never sums creative-level numbers. No fix needed.
>
> **Approval queue at scale (partial look):** `ApprovalQueue.jsx:500-503` fans out one
> `campaign_creative_screens` + `campaign_creatives` lookup per pending campaign via nested
> `Promise.all` — parallel, not serial, so not a correctness bug, but worth a real load test if the
> queue ever holds hundreds of pending items concurrently. Not elevated to should-fix without an
> observed slowdown.
>
> **Go/No-Go this session:** areas 2 (payments), 5 (security/RLS), 6 (notifications) all move from
> the 07-14 NO-GO back to 🟢 GO — every blocker and should-fix from that sweep is closed in code.
> Unable to re-verify live (no credentials this session) — recommend one real click-through as
> confirmation before treating this as fully closed.
>
> **Still open, unchanged, all manual/external (not code):** Google OAuth client secret invalid in
> prod; Supabase leaked-password-protection toggle (S2); Resend sending domain unowned (all
> transactional email still in-app-only); operator mobile app never run on a real device/simulator.
>
> **Next pass should go deeper on:** payment edge cases (refunds/disputes/3DS re-auth, and — now
> that B14 gives operators a real Connect path — whether `distributeOperatorCuts` has actually
> fired successfully for a real transfer yet); display-player resilience on real hardware; approval
> queue under real bulk/adversarial volume; and a live click-through of the new campaign-hierarchy
> wizard + location-targeting picker (shipped Aug 1-6, never exercised by any go-live pass).

> **Update — session 10 (2026-08-07, same day, live verification):** Confirmed session 9's
> code-read findings against live production — Supabase project `hkqiuwnppxkkztacwicj`, Vercel
> deployment `dpl_8Ty411yFAaaNcMzKaz4TfbLanvdq` (matches HEAD `88eb1c3`, so prod is current — no
> stale-deploy risk this time). No user login credentials available, so verification used direct
> DB access (Supabase MCP) + the public `/display/<token>` route (no auth) rather than a full
> authenticated click-through.
>
> - **B12 — confirmed live, with one caveat.** `curl`'d `scan-redirect` directly against a real
>   `completed`/`paid` booking (`bkg-002`): correctly returned `410 Gone` (S14's status gate
>   working against real data, not just in source); missing-id → `400`, bogus-id → `404`. The
>   public display route for a real live screen (`/display/4e3e95b8-…`) renders correctly and shows
>   "No active campaigns scheduled" + "QR code scans are recorded anonymously." **Caveat: could not
>   see an actual QR → 302 round-trip live**, because production currently has **zero** bookings in
>   `scheduled`/`active` + `paid` state — every real campaign is either `completed` or still
>   `pending_review`/unpaid. Nothing is actually airing right now, so there's no live QR to point a
>   phone at. Did not fabricate a live paid campaign to force this (one attempted disposable-row
>   insert was rolled back cleanly by a failing check constraint mid-transaction — verified no
>   duplicate/orphan row remains). Recommend confirming the actual 302 the next time a real
>   advertiser campaign goes live+paid.
> - **B13 — fully confirmed live.** Ran a real Postgres session under the exact RLS the app uses
>   (`set local role authenticated; set local request.jwt.claims` to a real advertiser's `sub`):
>   base `screens` table returned **0 rows** (no policy grants advertisers direct access anymore),
>   `advertiser_screens` view returned **8 rows** (matches the live-screen count), and
>   `information_schema.columns` confirms the view has no `monthly_revenue` column at all. The leak
>   is closed in the live database, not just in the migration file.
> - **B14 — code path is live but the real-world problem is unchanged.** `ScreenOnboard`'s
>   `StepConnect` and the Settings Stripe Connect card both exist and are deployed. But live data:
>   **0 of 2 real operators have `connect_status = 'active'`, 0 rows ever in `payouts`**, and **8
>   screens are currently `status = 'live'`** (bookable today) under the operator with
>   `connect_status: null`. Confirmed "live" is still not gated on Connect being set up — an
>   advertiser could book one of those 8 screens right now and `distributeOperatorCuts` would
>   silently skip the transfer, same risk flagged 07-14. The fix gives operators a path to fix this
>   themselves; nobody has taken it yet.
>
> **Net: B13 is done, for real. B12 is done in code/function but unexercised live (nothing's
> airing to test against). B14 is the one still actually open in practice — onboarding UI shipped,
> but zero operators are payout-ready and going-live isn't blocked on it.**

> **Update — session 11 (2026-08-07, payments edge cases):** Went deep on area 2 (payments) per
> session 10's "next pass" list, now that B14's Connect gate is live (PR #31). Read
> `charge-campaign`, `stripe-webhook`, `stripe-refund`, `trigger-payout` in full. 3DS handling is
> solid (`requires_action`/`requires_payment_method` fails cleanly with a clear advertiser-facing
> message, no silent hang); idempotency keys present on both the PaymentIntent and the operator
> Transfer. Found two real, previously-unflagged should-fix items — both **landmines, not live
> incidents**, because `operator_transfers` has 0 rows in production (confirmed) — nobody has ever
> completed a real transfer yet, so neither has fired for real. Both matter *because* B14 just made
> real transfers possible for the first time.
>
> - **S17 — `trigger-payout` (admin backfill path) double-pays.** Per
>   `2026-06-30-operator-payout-pipeline.md`, this function is explicitly "no longer the primary
>   path but kept for admin backfills of failed transfers." But its implementation
>   ([trigger-payout/index.ts:67-75](supabase/functions/trigger-payout/index.ts:67)) sums **every**
>   `payment_status='paid'` booking's budget across the operator's screens in the given date range —
>   it never excludes bookings that already have a successful row in `operator_transfers` (the table
>   `distributeOperatorCuts` writes to). Its only dedup check is "have I already transferred this
>   exact currency for this exact period" against its own `payouts` table
>   ([trigger-payout/index.ts:101-115](supabase/functions/trigger-payout/index.ts:101)) — it has no
>   awareness of `operator_transfers` at all. Run it today "to backfill one failed campaign" and it
>   pays out that campaign *plus every other campaign in the period that already transferred
>   successfully*, a second time. **Currently zero live risk** — not called from any `src/` code,
>   unreachable without a raw authenticated `curl`/future admin UI — but it's a real bug sitting in
>   a function whose entire documented purpose is "the safety net for when something went wrong,"
>   and building an admin backfill button on top of it as-is would be a launch-blocker the day it
>   shipped. Fix direction: before summing, exclude `booking_id`s that already have an
>   `operator_transfers` row with `status='transferred'` for that operator.
> - **S18 — refund/dispute never reverses an already-sent operator transfer.**
>   `distributeOperatorCuts` fires immediately on successful charge — before the campaign has even
>   started airing. `stripe-webhook`'s `charge.refunded` and `charge.dispute.created` handlers
>   ([stripe-webhook/index.ts:96-118](supabase/functions/stripe-webhook/index.ts:96)) only update the
>   `bookings` row (`payment_status`/`status`); neither calls `stripe.transfers.createReversal` or
>   flags the `operator_transfers` row for reversal — confirmed zero references to `reversal`
>   anywhere in `supabase/functions/`. A chargeback filed weeks after a campaign both started and
>   was paid out leaves the operator holding funds the platform already lost, with no automated or
>   even admin-UI clawback path. Same "landmine, not incident" status as S17 — 0 real transfers
>   exist yet. Fix direction: on `charge.refunded`/`charge.dispute.created`, look up the booking's
>   `operator_transfers` rows and attempt `stripe.transfers.createReversal` for each, logging
>   success/failure the same way `distributeOperatorCuts` already does.
>
> **Go/No-Go:** payments stays 🟢 GO for launch — both findings are pre-existing-condition bugs in
> code paths that haven't fired yet (0 rows in `operator_transfers`), not something broken for a
> real user today. Worth fixing before the first real operator payout happens, not before launch.
>
> **Not yet gone deep on:** display-player resilience on real hardware, approval queue under real
> bulk volume, and a live click-through of the campaign-hierarchy wizard + location-targeting
> picker (shipped Aug 1-6, still never exercised by any go-live pass) — carry forward.

> **Update — session 12 (2026-08-07, same day, S17/S18 fixed):** Fixed both same-day.
> - **S17** — `trigger-payout` now excludes any booking with a non-`failed` `operator_transfers`
>   row for that operator before summing, so a backfill only pays what genuinely never transferred.
> - **S18** — new `supabase/functions/_shared/transferReversal.ts` (`computeReversalDelta`, 8 unit
>   tests) tracks cumulative `reversed_amount` per transfer so partial refunds, later topped up to
>   full, and redelivered webhooks all land on the correct delta instead of over-reversing.
>   `stripe-webhook`'s `charge.refunded`/`charge.dispute.created` now call
>   `stripe.transfers.createReversal` for every affected `operator_transfers` row, with an
>   idempotency key tied to the cumulative target so redeliveries are safe. New column
>   `operator_transfers.reversed_amount` (migration `20260807000001`).
> - 459/459 tests pass on this branch pre-merge (PR #31/B14 merged to `main` separately, PR #32/
>   S17-S18 merged right after — combined `main` has 468 passing once both land). Not yet
>   re-verified live against prod (still 0 real transfers exist to reverse) — worth a synthetic
>   disposable-row test the day the first real Connect transfer fires.

> **Update — session 13 (2026-08-10, screen-agent/display resilience deep pass):** Went deep on
> area 4 per session 12's carried-forward "next pass" item — display-player resilience on real
> hardware. Nothing since session 12 had touched this (`device bootstrap script` #37, capture-rate
> perf tuning #38, camera-read-failure exit fix in `910bed2` were all shipped but never audited by
> a go-live pass). Read the full `screen-agent/` stack (`bootstrap.sh`, systemd unit,
> `docker-compose.yml`, `capture.py`, `event_pusher.py`) plus `display-feed`, `screen-health-cron`,
> and `screenHealth.js` end to end. Two real, previously-unflagged gaps, both specific to
> unattended physical hardware — neither is "nothing works," both are silent-failure/recovery gaps:
>
> - **S19 (should-fix) — the "screen is online" signal can't tell "ads are showing" apart from
>   "the CV box is alive."** `screens.last_seen` (the single column every health badge and
>   `screen-health-cron`'s offline alert read — [screenHealth.js](src/lib/screenHealth.js:15),
>   [screen-health-cron/index.ts:41](supabase/functions/screen-health-cron/index.ts:41)) is written
>   from **two independent, uncoupled processes**: the Chromium kiosk page's own 30s poll
>   ([display-feed/index.ts:191](supabase/functions/display-feed/index.ts:191)) and the Docker CV
>   agent's separate 30s heartbeat ([event_pusher.py:61](screen-agent/pusher/event_pusher.py:61),
>   posted via `ingest-impressions`' `heartbeat_only` branch). If Chromium dies or crash-loops out
>   (see S20) but the camera/inference/pusher containers keep running — a very plausible split
>   failure, e.g. a GPU/display-driver fault that has nothing to do with the USB webcam or network —
>   the pusher keeps refreshing `last_seen` every 30s. The operator dashboard keeps showing "Live,"
>   `screen-health-cron` never fires a `screen_offline` alert, and the screen keeps matching paid
>   campaigns in `display-feed`'s targeting — a fully dark screen that advertisers are still being
>   billed against, with no signal to anyone that it's dark. (The reverse case — display running,
>   CV agent down — is fine: CV is documented as optional and `display-feed`'s own heartbeat alone
>   keeps `last_seen` fresh.) Fix direction: track the kiosk-page and CV-agent heartbeats in separate
>   columns (or a `source` field on `display_heartbeats`, which already exists and is unused for
>   this) and have `screen-health-cron` require the kiosk-page signal specifically before calling a
>   screen "online" — the CV heartbeat alone should never be sufficient.
> - **S20 (should-fix) — a crash-looping kiosk browser goes dark permanently with no auto-recovery,
>   and the runbook has no documented fix.** `adgrid-display.service` sets `Restart=always` but also
>   `StartLimitBurst=5`/`StartLimitIntervalSec=60` — after 5 crashes in 60s, systemd marks the unit
>   **failed** and stops restarting it, permanently, even after whatever caused the crash-loop (bad
>   GPU driver init, corrupt Chromium profile, an OOM on a memory-constrained Pi) clears up. Recovery
>   requires `systemctl reset-failed adgrid-display && systemctl start adgrid-display` — SSH access,
>   not something a non-technical operator in a mall/cafe can do, and nothing in
>   `screen-agent/bootstrap.sh`, the README, or a cron polls `systemctl is-failed` to auto-recover.
>   Combined with S19, a screen that hits this on hardware with the recommended CV-agent tier
>   installed would show "Live" in the dashboard indefinitely while actually dark, with no path back
>   except someone physically or remotely (SSH) intervening. Fix direction: add a small watchdog —
>   a systemd timer or cron entry every few minutes running
>   `systemctl is-failed --quiet adgrid-display && systemctl reset-failed adgrid-display && systemctl start adgrid-display`
>   — and document it in the bootstrap script / README as a required step, not optional.
> - Minor, not elevated: `event_pusher.py`'s `PUSHED_LOG` (`.pushed`) is append-only and never
>   trimmed — grows unbounded over the device's lifetime. At one line per 30s push it's ~1 MB/year
>   of plain text, harmless on any SD card capacity in the buy list, not worth a fix before launch.
>
> **Go/No-Go this session:** area 4 stays 🟢 GO for a **pilot you're personally monitoring** — both
> findings are monitoring/recovery blind spots on top of a stack that otherwise works (capture,
> inference, push, kiosk render, and normal offline detection when only one signal is missing, are
> all sound). Should-fix, not blocker, before handing hardware to **unattended** operators at scale —
> S19+S20 together mean a real "screen is dark and nobody finds out" failure mode exists today with
> the recommended (camera-equipped) hardware tier.
>
> **Not yet gone deep on:** approval queue under real bulk/adversarial volume (carried forward
> again — still only ever tested with 1-2 submissions); a live click-through of the campaign-
> hierarchy wizard, location-targeting picker, and ad-render-preview (all shipped Aug 1-8, still
> never exercised by any go-live pass, code-read only); mobile app on a real device (still blocked
> on hardware access).

> **Update — session 13 continued (2026-08-10, S19/S20 fixed same day):**
> - **S19 — fixed.** New `screens.cv_last_seen` column (migration `20260810000000`); CV agent's
>   `heartbeat_only` branch in `ingest-impressions` now writes there instead of `last_seen`
>   (`event_pusher.py` needed no change — same payload, server-side routing changed). `last_seen`
>   is now written only by `display-feed`'s kiosk poll, so `screen-health-cron` and `healthSignal()`
>   needed **no code changes** — they automatically became kiosk-only signals once the CV agent
>   stopped writing to the column they read. Added `cvAgentSignal()` to `screenHealth.js` and a
>   small "Camera agent: last check-in …" readout to `ScreenDetail`'s Audience Measurement Camera
>   card, deliberately separate from the main Live/Offline badge. **Verified live**: deployed
>   `ingest-impressions` v7, POSTed a real `heartbeat_only` request against a real live screen row
>   (`scr-brixton-001`) — `cv_last_seen` updated, `last_seen` stayed `null` (unchanged) — confirming
>   the exact failure mode is closed: this same request before the fix would have made the screen
>   read "online." Test mutation reverted after.
> - **S20 — fixed.** New `adgrid-display-watchdog.service` + `.timer` (systemd, runs every 5 min):
>   clears `adgrid-display.service`'s failed state and restarts it if down — both are no-ops on a
>   healthy unit. Wired into `bootstrap.sh` (installed + enabled automatically) and the manual
>   README path. **Not verified live** — no physical device/systemd host in this environment; the
>   unit files are syntactically standard systemd oneshot+timer and follow the same pattern as
>   `adgrid-display.service` itself, but the actual crash-loop-then-recover behavior needs a real
>   Pi/mini-PC to confirm.
> - 550/550 tests pass (`4cd6679`). Build clean.
>
> **Go/No-Go:** area 4 moves to 🟢 GO, including for unattended operators — both blind spots closed
> in code and one verified live. S20's systemd units remain unverified on real hardware; worth a
> real crash-loop test (`sudo pkill -9 -f chromium` five times fast) the first time hardware exists.

> **Update — session 14 (2026-08-10, approval queue at bulk volume):** Went deep on area 3 per
> the carried-forward item, still only ever tested with 1-2 submissions since it first shipped. Read
> `ApprovalQueue.jsx` in full (all three approve paths: single-screen, per-card "approve all my
> screens," and the top-level bulk button) plus `charge-campaign`'s locking/idempotency, and the
> existing `bulkApproveAll` test.
>
> - **S21 (should-fix) — none of the three approve/reject paths check `{ error }` on the
>   `campaign_screens` UPDATE, and `bulkApproveAll` fires every write for every pending
>   campaign-screen pair fully unthrottled.** `approveScreen`, `approveAll` (per-card), and
>   `bulkApproveAll` (top-level) all do `await supabase.from('campaign_screens').update(...)` and
>   discard the result entirely — no `{ error }` destructured, none checked
>   ([ApprovalQueue.jsx:139](src/views/operator/ApprovalQueue.jsx:139),
>   [:163-168](src/views/operator/ApprovalQueue.jsx:163),
>   [:503-508](src/views/operator/ApprovalQueue.jsx:503)). Every path then calls
>   `applyApproved`/`onApproved` **unconditionally**, regardless of whether the write actually
>   succeeded — the UI removes the row from the pending list and reports success even if the DB
>   update silently failed. `bulkApproveAll` compounds this: for C pending campaigns × R screens
>   each, it fires a nested nothing-capped `Promise.all` — every `campaign_screens` UPDATE for
>   every campaign, all at once, no batching (one query per row instead of one `.in()` per
>   campaign), no concurrency limit — followed by up to C concurrent `charge-campaign` edge-function
>   invocations, each doing a synchronous round trip to Stripe. This is exactly the "handful of
>   submissions" vs "real bulk volume" gap the prior sessions flagged as unproven: with only a
>   couple of pending items every write succeeds and nobody notices there's no error handling; with
>   a real backlog (dozens of campaigns during a growth spurt, or an operator returning from a few
>   days off), a connection-pool blip or a transient PostgREST/Stripe 5xx under that concurrency
>   spike becomes statistically real, and when it hits, the affected campaign silently stays
>   `pending` server-side forever while the operator's screen shows it as handled — no error banner,
>   no retry path, nothing tells anyone until the advertiser asks why their campaign never went
>   live. Confirmed the existing test (`ApprovalQueue.bulkApproveAll.test.jsx`) only mocks
>   always-succeeding writes — a partial-failure scenario has never been exercised.
>   Secondary, same root cause: the top-level "Approve all pending" button has no
>   loading/disabled guard tied to the operation in flight, so a second click mid-batch doubles the
>   concurrent write volume right when concurrency is already the risk — not a double-charge risk
>   though: confirmed `charge-campaign` has both an atomic `payment_status` UPDATE-lock
>   ([charge-campaign/index.ts:250](supabase/functions/charge-campaign/index.ts:250)) and a
>   booking-id-keyed Stripe idempotency key, so a redundant charge call safely 409s or dedupes
>   rather than double-billing an advertiser.
>   **Fix direction:** check `{ error }` on every `campaign_screens` write; on failure, don't call
>   `applyApproved`/`onApproved` for that row and surface which ones failed (a banner listing
>   failed campaigns with a retry action) instead of silently reporting success. Batch each
>   campaign's per-screen updates into one `.update(...).in('screen_id', [...])` call instead of one
>   query per row, and cap `bulkApproveAll`'s campaign-level concurrency (process in chunks of ~5-10
>   rather than all at once) so a real backlog doesn't fire dozens of simultaneous Stripe calls.
>   Add a `bulkApproving` state to disable the button while in flight.
> - Minor, not elevated: `App.jsx`'s `bookings` fetch that feeds `campaigns` (and therefore
>   `ApprovalQueue`) has no `.limit()` — RLS already scopes it to the caller's own bookings /
>   bookings touching their screens (not the whole platform table), but it also has no status
>   filter, so every dashboard load pulls a tenant's **entire** booking history, not just pending
>   ones. Fine at current volume; worth a status/date filter or pagination once any single
>   advertiser or operator accumulates a few hundred historical bookings.
>
> **Go/No-Go:** area 3 stays 🟡, downgraded from the prior 🟢-by-default (never actually tested at
> volume) — the queue works correctly today because nobody has hit it with real bulk volume yet,
> not because it's been verified to handle it. Not a hard blocker (mitigated by the charge-side
> idempotency, and today's actual pending-campaign counts are small), but should-fix before
> depending on bulk-approve for a large backlog, and worth fixing before it causes a real "why did
> my campaign never air" support ticket.
>
> **Not yet gone deep on:** a live click-through of the campaign-hierarchy wizard, location-
> targeting picker, and ad-render-preview (shipped Aug 1-8, still code-read only); mobile app on a
> real device (still blocked on hardware access); S20's systemd watchdog on real hardware.

> **Update — session 14 continued (2026-08-10, S21 fixed same day):** Fixed all three approve
> paths plus reject. `approveScreen`/`approveAll`/`rejectScreen` now check `{ error }` and bail
> with a visible message (`actionErr`, renamed from `chargeErr` since it's no longer
> charge-specific) instead of reporting success on a failed write. `approveAll` and
> `bulkApproveAll` batch each campaign's screen rows into one `.update().in('screen_id', […])`
> instead of one query per row. `bulkApproveAll` now processes campaigns in chunks of 5
> (`runInChunks`) instead of one unbounded `Promise.all` across the whole pending list, gained a
> `bulkApproving` loading state that disables the button while in flight, and collects failures
> into a visible banner (advertiser name + reason) — failed campaigns stay in the pending list so a
> re-click naturally retries just those. New test
> (`ApprovalQueue.bulkApproveErrors.test.jsx`) forces one campaign in a two-campaign batch to fail
> and asserts it lands in the banner and is never optimistically marked approved — the gap the
> existing `bulkApproveAll` test (all-writes-succeed mock) never covered. 567/567 tests pass,
> build clean, lint delta zero. Not verified live against a real bulk backlog (production currently
> has none) — the fix is proven by the new unit test and by re-reading the batched query shape, not
> by an actual load test; worth confirming against a real backlog of dozens of pending campaigns if
> one ever accumulates.
>
> **Go/No-Go:** area 3 back to 🟢 GO — error handling and concurrency are now correct by
> construction rather than by nobody having hit the edge case yet.

> **Update — session 15 (2026-08-10, mobile app on a real device — attempted again):** Checked
> for device access first: no `adb`, no emulator, no iOS simulator (Windows), no LAN path to a
> physical phone — identical to session 7, this environment still cannot run the app on hardware.
> Rather than stop there again, audited the actual **build pipeline** (`app.json`, `eas.json`,
> `.gitignore`, every `process.env.EXPO_PUBLIC_*` read site) for what a real build would hit that
> Jest/`expo start --web` never would — this is new ground; every prior pass tested app *code*
> against a mocked Supabase client, never the config that turns that code into an installable app.
> Two real, previously-unflagged findings, both invisible without a device precisely because
> nothing has ever tried to actually build or install this app outside Metro:
>
> - **B15 (blocker for any real build) — preview/production EAS builds will ship with no backend
>   connection at all.** `lib/supabase.js` and `hooks/useBilling.js` read
>   `process.env.EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY` directly — the standard
>   Expo pattern, auto-inlined by Metro at bundle time from a local `.env`. That `.env` exists
>   locally but is git-ignored ([mobile/.gitignore:5](mobile/.gitignore:5)) and there's no
>   `.easignore` to override the default (EAS Build respects `.gitignore` for what it uploads), so
>   it never reaches an EAS build. Confirmed `eas.json` has **no `env` block in any profile**
>   ([eas.json](mobile/eas.json)) and no EAS project has ever been initialized (per the scaffolding
>   commit's own note: "No EAS project linked yet... needs `eas login` + `eas init` run by hand"),
>   so no EAS-side environment variables exist either. Net: `supabase.createClient(undefined,
>   undefined, ...)` on any `preview`/`production` build — every screen, every query, everything
>   fails from first launch, completely silently (no error boundary catches a malformed client at
>   construction). The `development` profile is unaffected *as long as* it's always run via
>   `expo start --dev-client` from a machine with the local `.env` — it's specifically the
>   standalone builds (the ones meant for pilot testers and app stores) that are broken. Red
>   herring ruled out: `app.json`'s `extra.supabaseUrl`/`extra.supabaseAnonKey` fields hold the
>   literal strings `"EXPO_PUBLIC_SUPABASE_URL"`/`"EXPO_PUBLIC_SUPABASE_ANON_KEY"` (not real
>   values) but nothing in the code reads `Constants.expoConfig.extra.supabaseUrl` — confirmed via
>   a full-repo grep — so that dead config isn't itself the bug, just confusing leftover noise.
>   **Fix direction:** once an EAS account/project exists, run
>   `eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value <url> --environment preview,production`
>   (and the anon key) rather than committing them into `eas.json`. Needs real EAS login — can't be
>   done from this environment.
> - **N11 (real gap, not a crash) — push notification registration is guaranteed to fail on any
>   real device, silently.** `usePushNotifications.js` calls
>   `Notifications.getExpoPushTokenAsync()` with no `projectId`
>   ([usePushNotifications.js:28](mobile/hooks/usePushNotifications.js:28)) — required since no
>   `extra.eas.projectId` exists in `app.json` (confirmed: no EAS project was ever created, same
>   root cause as B15) and nothing passes one explicitly. This throws in current Expo SDK on a real
>   device/build; it's caught by the surrounding `try/catch`
>   ([usePushNotifications.js:35](mobile/hooks/usePushNotifications.js:35)) so the app doesn't
>   crash — it just never registers a push token, `console.error`s once, and no operator ever
>   receives a push notification. An entire built feature (`2026-06-21-mobile-plan-3-approvals-push`)
>   is inert on real hardware, and nothing surfaces that to anyone. Not elevated to blocker since it
>   fails safe and in-app notifications still work — but worth fixing at the same time as B15 since
>   both need the same `eas init`.
> - Confirmed (again) that no GitHub Actions workflow builds the mobile app, so this has never been
>   caught by CI either — the only path to catching it has always been "build it for real," which
>   has never happened.
>
> **Go/No-Go:** the operator mobile app itself (screens, hooks, schema) is 🟢 GO per sessions 3/6/7
> — but the **build pipeline that turns it into something installable is 🔴 NO-GO**, and always has
> been; this was just never checked before because no prior pass looked past `npm test`/`expo start
> --web` at what an actual `eas build` would produce. Fixing B15/N11 both need one thing this
> environment cannot provide: a logged-in `eas` session. Everything else about "checking the mobile
> app on a real device" remains blocked exactly as in sessions 6/7 for the same reason.
>
> **What the user needs to do (nothing else can substitute for this):** `cd mobile && npx eas login
> && npx eas init` (links the project, writes `extra.eas.projectId` into app config), then
> `npx eas env:create` the two Supabase vars for `preview`+`production`, then `npx eas build
> --profile preview --platform android` for a real installable APK. That's the actual "next pass" —
> not something a further code-reading session can shortcut.

> **Update — session 15 continued (2026-08-10, fixed what didn't need EAS login):** Fixed the two
> pieces that don't require a real EAS account:
> - `usePushNotifications.js` now recognizes the specific "no projectId" failure (both in
>   `register()` and `deregister()`) and logs one clear line — `Push notifications disabled: no
>   EAS project is linked to this app…` — instead of a raw error dump. Still fails safe either way
>   (the try/catch already prevented a crash); this only makes the cause diagnosable instead of
>   looking like a random failure. New test forces the known error and asserts the clean message
>   fires, plus a second case confirming genuinely unrelated failures still log their raw error.
> - New `mobile/README.md` documents the exact `eas login` / `eas init` / `eas env:create` /
>   `eas build` sequence needed before this app has ever produced a real installable build —
>   previously undocumented anywhere in the repo. New `mobile/.env.example` (the README referenced
>   one that didn't actually exist until now).
> - 63/63 mobile tests pass, lint delta zero.
>
> **B15 itself remains open** — it needs a real, logged-in `eas` session, which cannot happen in
> this environment. The README now means the next person who does have one won't have to
> rediscover any of this.

> **Update — session 16 (2026-08-10, campaign-hierarchy wizard — live click-through):** Per the
> carried-forward item, shipped Aug 1-8 and never exercised by any go-live pass (code-read only).
> Created a real disposable advertiser account against production
> (`golivereview.test.20260810@mailinator.com` — signup rejected `@example.com`/similar fake
> domains, confirmed a real deliverable one is required; confirmed the account via direct SQL since
> email confirmation delivery is the known-broken Resend path, not something this account needed to
> wait on) and ran the **power case** (2 creatives, manually split across 2 real screens, per-creative
> budget) through the real production wizard at `adgrid-mu.vercel.app`, then verified the writes
> against the live database and cleaned everything up after. This is deeper than every prior
> live-verification pass in this doc got for this feature — first time the multi-creative path has
> been exercised end-to-end rather than only read as code.
>
> **Everything matched the design doc exactly, live:**
> - Step 1 (Targeting): city search ("Toronto") correctly matched 2 real screens via the
>   location-targeting picker (also carried-forward, unverified-live until now).
> - Step 2 (Creative): uploaded a real image to Creative 1, clicked "+ Add another creative",
>   uploaded a second image — the "2 of 2 screens aren't assigned to a creative yet — they'll show
>   the first creative above by default" banner appeared exactly as designed, then correctly
>   disappeared once both screens were manually assigned (King & Bay → Creative 1, Queen West →
>   Creative 2). Per-creative accent-colour extraction from the uploaded image worked ("From
>   creative").
> - Step 3 (Budget): "Split per creative" toggle revealed per-creative budget fields with the exact
>   design-doc copy ("budget above is still your overall spend cap — per-creative amounts track how
>   that total is split, they don't add to it"); Review summary correctly showed both creative
>   labels, total budget, and computed date range.
> - Submitted successfully, reached the real Stripe pay screen ("Charge $500.00 CAD..."), used "Pay
>   later" (no card on this disposable account, and entering one wasn't going to happen regardless).
> - **Verified in the live database, not just the UI:** `campaigns` parent row created,
>   `bookings.campaign_id`/`budget_level='per_creative'` set correctly; `campaign_creatives` has
>   exactly 2 rows with the right budgets (300/200) and uploaded media; `campaign_creative_screens`
>   correctly maps King & Bay → Creative 1 and Queen West → Creative 2, weight 100 each;
>   `campaign_screens` created both rows as `pending`.
> - **Verified the approval-reset trigger (design §4) live, not just by reading the migration:**
>   approved one screen directly (simulating an operator), then reassigned that screen's creative
>   (deleted + reinserted its `campaign_creative_screens` row, exactly what an advertiser edit would
>   do) — `campaign_screens.status` flipped from `approved` back to `pending` automatically,
>   confirming `campaign_creative_screens_reset_approval` fires correctly against real data.
> - All test data (booking, campaign, creatives, screen assignments, advertiser profile, auth user)
>   deleted after; confirmed zero rows remain.
>
> **No new findings — this is a clean bill of health, not a gap.** The three-tier hierarchy
> (Campaign → Targeting → Creative) works correctly end-to-end in production, matching its design
> doc precisely, for the power case that had never been tried before. The only pre-existing,
> already-known item visible during this run was the `~0K impressions/mo` estimate (S16's backfill
> gap on the seed screens, not a new bug — not re-flagging).
>
> **Not covered this pass, narrow and non-blocking:** the "Split by screen type" auto-split
> convenience button (used manual assignment instead — both are the same underlying write path,
> just a different UI entry point) and the ad-render-preview "see your creative warped onto the
> screen" button specifically (needs a screen with operator-marked corner photos; the 2 real
> Toronto screens used here don't have any, so the button likely didn't even render — separate,
> narrower thing to check than what this pass covered).
>
> **Go/No-Go:** campaign-hierarchy wizard is 🟢 GO, now backed by a real live run instead of only a
> design-doc read. Remaining carry-forwards: approval queue under genuine bulk volume (code-fixed
> session 14, still never load-tested for real), mobile app on real hardware (blocked on `eas
> login`), S20's watchdog on real hardware.

> **Update — session 17 (2026-08-10, operator payout pipeline — deeper than S17/S18):** Session
> 11/12 covered `trigger-payout` dedup and refund reversal; this pass went one layer earlier —
> **how `connect_status` becomes `'active'` in the first place**, since everything downstream
> (charge-campaign's transfer gate, screen-live gating, the operator billing balance) trusts that
> single column. Live DB check first: still **0 of 2 operators have `connect_status` set at all**
> (both `null`) and **0 rows ever in `operator_transfers`/`payouts`** — unchanged since session 10,
> nobody has attempted Connect onboarding yet, so this is a landmine, not an incident, same framing
> as S17/S18 originally were.
>
> - **B16 (blocker-in-waiting) — `connect_status = 'active'` is set client-side purely because the
>   browser landed back on the return URL, never verified against Stripe's actual account state.**
>   [App.jsx:290-297](src/App.jsx:290): on `?connect=success`, after a real CSRF state-token check
>   (that part's solid), the client directly does
>   `supabase.from('profiles').update({ connect_status: 'active' })` — no call to
>   `stripe.accounts.retrieve()` checking `charges_enabled`/`payouts_enabled`/`details_submitted`,
>   and grepping every function in `supabase/functions/` confirms `stripe-webhook` has **no
>   `account.updated` case at all** (its switch only handles `payment_intent.*`, `charge.refunded`,
>   `charge.dispute.created`, `checkout.session.completed`). Stripe's Account Links `return_url` is
>   documented to redirect regardless of whether onboarding was actually completed — an operator who
>   closes the KYC form early, or whose account is later restricted for any reason (rejected
>   document, compliance hold), leaves `connect_status` reading `'active'` forever with nothing to
>   ever correct it.
> - **Consequence, confirmed by re-reading the downstream code, not assumed:** a false `'active'`
>   passes `charge-campaign`'s transfer gate
>   ([charge-campaign/index.ts:69](supabase/functions/charge-campaign/index.ts:69)) and the
>   screen-live gate (`checkAndGoLive`, same column). The resulting `stripe.transfers.create` call
>   does fail safely — caught, logged to `operator_transfers` with `status: 'failed'`
>   ([charge-campaign/index.ts:116-134](supabase/functions/charge-campaign/index.ts:116)), doesn't
>   touch the advertiser's already-successful charge — but **nothing ever surfaces that failure to
>   anyone.** Grepped every operator-facing view and `operator-billing`
>   ([operator-billing/index.ts](supabase/functions/operator-billing/index.ts)): zero references to
>   `operator_transfers` or a `'failed'` status anywhere outside `charge-campaign`'s write and
>   `trigger-payout`'s dedup read (admin-only, unreachable from any UI, per session 11's finding).
>   `operator-billing`'s own Stripe balance/payout fetch has the identical blind spot
>   ([operator-billing/index.ts:105-107](supabase/functions/operator-billing/index.ts:105)): a
>   genuinely-restricted account throws on `stripe.balance.retrieve`, caught silently, Billing just
>   renders an empty balance — indistinguishable from "genuinely $0 so far." An operator would see
>   "Connected" in Settings, a real screen showing as bookable, and then nothing — no alert, no
>   banner, no email — the only way to ever discover a failed transfer today is a raw SQL query
>   against `operator_transfers`, which is exactly how this session found it.
> - **Fix direction:** replace the client-side `UPDATE` with a server-side check — either a new/
>   extended edge function called from the redirect handler that calls
>   `stripe.accounts.retrieve(accountId)` and only sets `active` when
>   `charges_enabled && payouts_enabled`, or (more robust, catches later revocation too) add an
>   `account.updated` case to `stripe-webhook` that syncs `connect_status` from Stripe's own event
>   stream instead of a one-time client assertion. Either way, pair it with actually surfacing
>   `operator_transfers.status = 'failed'` somewhere an operator can see it (a banner on Billing, a
>   `payout_failed` notification type) — the safety net existing in the DB but nowhere in the UI is
>   the same shape of gap as B14 originally was (a real mechanism, zero visibility).
>
> **Go/No-Go:** payments/payout pipeline stays 🟡, not elevated to a hard blocker for the same
> reason S17/S18 weren't — zero real operators have gone through Connect yet, so nothing has
> actually failed silently in production. But this is now the most consequential open item in the
> payment story: the day the first real operator clicks through Connect and it doesn't fully
> complete, they get told they're "connected" and never learn otherwise. Worth fixing before
> actively onboarding real operators, not before a controlled pilot.
>
> **Not fixed this session** — flagged for the user to decide whether to prioritize now (it's a
> real code change, not a quick patch: needs either a new server-side verification call or a new
> webhook case, plus a UI surface for failed transfers).

> **Update — session 17 continued (2026-08-10, B16 fixed, and a much bigger thing found: B17,
> B18):** Fixing B16 uncovered two deeper problems, each hiding the one below it.
>
> - **B17 (the real root cause, found + fixed) — `create-connect-account` had no CORS/OPTIONS
>   handling at all.** Every browser call carries an `Authorization` header, forcing a preflight
>   OPTIONS request; the function had no branch for it, so the preflight fell into the auth check
>   (which needs a real bearer token no preflight ever sends) and 401'd with no CORS headers — the
>   browser aborted the real POST entirely. Identical bug class to B9 (`send-notification`, session
>   5). Confirmed live via `curl` **before** the fix: `OPTIONS` → `401`, no `Access-Control-*`
>   headers. **This is the actual reason `connect_status` has stayed `null` for every operator
>   across every prior go-live session** — "Connect with Stripe" has never once reached this
>   function in production; B14's entire onboarding path has been dead on arrival since it shipped.
>   Fixed with the same `CORS` const + OPTIONS short-circuit pattern used everywhere else. Also
>   wrapped the Stripe calls in `try/catch` — an uncaught Stripe error previously fell through to
>   Deno's bare 500 with no CORS headers either, which would have shown the browser an opaque "CORS
>   error" instead of Stripe's actual message. **Verified live**: `curl OPTIONS` now returns `200`
>   with `Access-Control-Allow-Origin`, on both `create-connect-account` and the new
>   `confirm-connect-account`.
> - **B16 — fixed as designed.** New `confirm-connect-account` function calls
>   `stripe.accounts.retrieve()` and only marks `active` when `charges_enabled && payouts_enabled`
>   (else `restricted`/`pending`); `App.jsx`'s redirect handler calls it instead of blindly writing
>   `active`. `stripe-webhook` gained an `account.updated` case to keep status synced from Stripe's
>   own event stream afterward (catches a later KYC rejection, not just the initial guess). Added
>   `payout_transfer_failed`/`connect_account_restricted` notification templates, wired them at the
>   point of failure, and added a failed-transfers banner to the operator Billing page (new
>   `useFailedTransfers` hook + test) — `operator_transfers.status='failed'` rows existed in the DB
>   the whole time but nothing anywhere ever surfaced them.
> - **B18 (found live, blocked on a manual step — cannot be fixed from here) — Stripe Connect
>   itself has never been enabled on this platform's Stripe account.** With B17's CORS fix deployed
>   and error handling in place, ran a real end-to-end test: created a disposable operator account
>   (`golivereview.payout.test.20260810@mailinator.com`, via direct SQL insert with a real
>   bcrypt-hashed password — signup's email endpoint was rate-limited from earlier test accounts
>   this session), signed in for a real access token, and called `create-connect-account` for real.
>   Stripe returned: **"You can only create new accounts if you've signed up for Connect, which you
>   can do at https://dashboard.stripe.com/connect."** This is a platform-level Stripe Dashboard
>   setting — not something any API call or service-role key can toggle, and not something this
>   environment can do on the user's behalf (same category as the Google OAuth secret, the
>   leaked-password toggle, and `eas login`). **This is the true root of the entire operator-payout
>   story**: B14 (Connect gate), B16 (status verification), and B17 (the broken button) were all
>   fixed or working correctly, but none of it can complete until Connect is turned on for the
>   platform account. Test account and all rows cleaned up after; no Stripe object was ever created
>   (the very first API call is what failed, before any account existed).
>
> **Go/No-Go:** payments/payout pipeline B16 and B17 are 🟢 fixed and verified live down to the
> point where an external Stripe setting blocks further progress. **B18 is now the single most
> consequential open item in this entire go-live review** — until Stripe Connect is enabled on the
> platform account, zero operators can ever complete onboarding, no matter how correct the code is.
>
> **What the user needs to do:** visit https://dashboard.stripe.com/connect and complete Stripe's
> Connect platform setup (this is typically a short questionnaire about the platform/marketplace
> use case). Once done, re-run the same test (or just have a real operator click "Connect with
> Stripe") — `create-connect-account` should return a real onboarding URL instead of the error
> above.

> **Update — session 18 (2026-08-10, campaign-hierarchy dashboard rollup — live click-through):**
> Per the carried-forward item, Phase 5's accordion/"+ Add targeting group" had never been
> exercised by any prior go-live pass (design-doc read only). Found and fixed two more real,
> previously-unflagged bugs, both confirmed live end-to-end.
>
> - **B19 (found + fixed) — "+ Add targeting group" silently created a brand-new standalone
>   campaign instead of extending the existing one, every time, for every advertiser, since the
>   feature shipped.** [App.jsx](src/App.jsx)'s safety-net effect clearing `addingToCampaign`
>   whenever `active !== 'adv-create'` raced the very navigation it was meant to allow through —
>   `active` derives from `useLocation()`, which updates on a render pass after the route
>   transition commits, not necessarily the same synchronous batch as the `setAddingToCampaign()`
>   call in the click handler. The effect would see stale `active` alongside the freshly-set value,
>   conclude it was leftover from a previous session, and null it out before `CreateCampaign` ever
>   mounted to read it. **Reproduced live, twice, with SQL proof**: created a real campaign,
>   clicked "+ Add targeting group," completed the wizard, and confirmed via direct query that the
>   resulting booking got a brand-new `campaigns.id` instead of the original's — silently, with no
>   error, no visual hint anything was wrong (named it `SHOULD-NOT-EXIST-second-group` specifically
>   to prove the point). Fixed by making the decision synchronous instead of reactive: `navTo()`
>   now clears `addingToCampaign` itself by default, and the one caller that needs to carry it
>   forward opts out via a new `keepAddingToCampaign` option, decided in the same click handler
>   that sets the value — removes the race entirely rather than tuning its timing.
> - **B20 (found + fixed, while re-verifying B19) — the location-search suggestion list could
>   lose a real click to its own close timer.** `LocationSearch.jsx`'s input closes the dropdown via
>   `onBlur={() => setTimeout(() => setOpen(false), 150)}`, but each suggestion row only listened
>   for `onClick` — a real click is mousedown→blur→mouseup→click, and mousedown alone already starts
>   the 150ms teardown. On anything slower than an instant click (assistive tech, touch, a laggy
>   trackpad, or — how this was actually found — an automated interaction), the timer can win and
>   unmount the row before the click event ever dispatches, so the selection silently does nothing.
>   Not specific to "+ Add targeting group" — same component, same bug, everywhere in the wizard.
>   Fixed by moving the handler to `onMouseDown` + `preventDefault()`, which stops the input from
>   blurring in the first place instead of depending on winning the race.
> - **Both fixes verified live, together, in one full run**: re-opened the real "Rollup Test
>   Campaign," clicked "+ Add targeting group" (purple banner correct, confirming B19), selected a
>   city via the fixed mousedown handler (confirming B20), uploaded a creative, submitted with a
>   $75 budget — **the resulting booking's `campaign_id` matched the original campaign's `id`
>   exactly**, and the Campaigns list rendered it as a real accordion: "▸ Rollup Test Campaign — 2
>   targeting groups · 4 screens · $0 of $375" (300+75, correctly summed), collapsed by default
>   exactly per the design doc's §7. All test data (3 bookings, 2 campaign parents, the test
>   advertiser account) deleted after.
> - 570/570 tests pass (two pre-existing tests updated to fire `mousedown` instead of `click`,
>   matching the fixed interaction — a legitimate behavior change, not a workaround).
>
> **Go/No-Go:** campaign-hierarchy dashboard/rollup moves to 🟢 GO — both real, would-have-shipped
> bugs are fixed and proven correct against production, not just read as code.
>
> **Not yet gone deep on:** the "Split by screen type" auto-split convenience button and the
> ad-render-preview corner-warp feature specifically (both still carried forward, unchanged from
> session 16); anything downstream of B18 (Stripe Connect never enabled) remains blocked on that
> one external step.

> **Update — session 19 (2026-08-10, approval SLA / auto-drop pipeline — first pass, never
> checked before):** Read the full Phase 2C design and the live `sweep-approvals`/`approvalSla.ts`
> code, then checked the one seam no prior pass had: how the SLA-deadline system interacts with
> the campaign-hierarchy creative-reassignment reset trigger (`20260731000004`/`...009`) — two
> features built in different phases, each individually solid, never cross-checked against each
> other.
>
> - **B21 (blocker, found + fixed) — reassigning a creative on an already-approved, mid-flight
>   screen could get it silently dropped and refunded within 15 minutes, through no fault of the
>   operator.** `reset_screen_approval_on_creative_change()` flips an approved/auto_approved
>   `campaign_screens` row back to `pending` on any creative reassignment, but only ever touched
>   `status` — never `review_due_at`, which is stamped once at initial INSERT by a separate
>   BEFORE INSERT trigger that never re-fires on this UPDATE. **Reproduced live with disposable
>   data**: approved a screen, backdated its deadline 2 hours into the past (the normal state for
>   any screen approved earlier in a multi-week flight, since the SLA default is only 24h — nearly
>   every real campaign outlives it), reassigned a creative through the real production trigger
>   path, and called the real `sweep-approvals` function. It returned `expired:1` in that exact
>   run, issued a real `screen_dropped_sla` notification, and credited the full $300 test budget
>   back — all within 30 seconds of what should have been a completely ordinary advertiser action.
>   This makes creative reassignment (including the "+ Add another creative" / per-screen
>   reassignment flows already verified as *working* in sessions 16/18 — those passes checked the
>   status transition but never this column) actively dangerous on any campaign simply old enough
>   to have outlived its SLA window, which is most of them by design (campaigns run for weeks,
>   SLA defaults to 24h).
>   **Fixed and verified live**: the reset trigger now recomputes a fresh deadline (same
>   calculation `set_review_due_at` uses) whenever it resets a row to pending, clears `expired_at`
>   defensively, and stamps `updated_at` — which also incidentally closes a second, related gap:
>   `notification-cron`'s pending-review push filters on `updated_at`, so a reset row was
>   previously invisible to it too (an unmerged branch, PR #47, had independently built this same
>   `updated_at` fix for that reason but was never merged to `main`; this migration supersedes it).
>   Re-ran the identical reproduction post-fix: `review_due_at` correctly became a real 24h-out
>   deadline, `sweep-approvals` returned `expired:0`, row stayed pending untouched. Both test
>   passes' data fully cleaned up. 570/570 tests pass (DB-only change).
>
> **Go/No-Go:** approval SLA / auto-drop pipeline is 🟢 GO — the core mechanism (deadlines,
> warnings, policy-based auto-approve, expiry, credit-back) is well-built and matches its design
> doc; the one real gap was specifically at its intersection with a different feature built later,
> now closed and proven live.
>
> **Not yet gone deep on:** the auto-approve policy path itself (`operator_approval_rules`) has
> never been exercised live — only read as code and unit-tested; the operator-facing SLA/policy
> settings UI in `OperatorSettingsView.jsx` has never been clicked through.

> **Update — session 20 (2026-08-10):** Went deep on the auto-approve policy path
> (`operator_approval_rules`), and found the platform's payment pipeline was more badly broken
> than any prior session's write-up implied.
>
> - **B22 (blocker, found + fixed) — policy-driven auto-approve never charges.** A screen that
>   clears via an operator's `operator_approval_rules` policy (category allowlist + advertiser
>   history) flips straight to `auto_approved` inside `sweep-approvals`, but nothing in that path
>   ever called `charge-campaign` — the same charge step a *human* clicking Approve already gets
>   via `ApprovalQueue.jsx`'s `attemptCharge`. Confirmed live with disposable data: every screen on
>   a Pay-later campaign reads `auto_approved` (looks fully done), `payment_status` sits at
>   `unpaid` forever, `display-feed` never serves it (requires `payment_status='paid'` too), and
>   the advertiser is never told anything happened. **Fixed**: after Pass 1's auto-approve loop,
>   `sweep-approvals` now checks whether every screen on each newly-auto-approved campaign has
>   cleared (or `start_when='partial'`), and if so sends the same `campaign_approved` notification
>   and calls `charge-campaign` that a manual approval would. `sweep-approvals` is a service-role
>   cron with no user session, so this needed a trusted-internal-caller bypass in `charge-campaign`
>   (`x-internal-secret`, the same pattern already used to reach `send-notification` from every
>   other cron) — deploying that bypass required flipping `charge-campaign` to `verify_jwt: false`,
>   since the Supabase gateway 401s any request carrying no bearer JWT at all *before* function
>   code runs, regardless of what other headers are present; all auth enforcement for non-internal
>   callers is still fully reimplemented in code, matching how `send-notification` already works.
> - **B23 (blocker, found + fixed) — charge-campaign's atomic payment lock has never actually
>   worked, for any caller.** Chasing B22's fix through a live 401→409 loop turned up something
>   much bigger: the lock step (`UPDATE bookings SET payment_status='charging' WHERE ... NOT IN
>   ('paid','charging')`) hit a check-constraint violation on *every single call* —
>   `bookings_payment_status_check` only ever allowed `unpaid`/`paid`/`failed`/`refunded`;
>   `'charging'` was never a legal value. The handler destructured only `{ data }` off the Supabase
>   response and never inspected `error`, so the constraint violation was silently swallowed and
>   every caller — cron or a real advertiser clicking pay — just saw a false 409 "already paid or a
>   payment is in progress" on the very first attempt. Corroborated against real (non-test)
>   production data: of the bookings currently marked `payment_status='paid'`, **zero** have a
>   `payment_intent_id` set, meaning none of them ever actually completed a Stripe charge through
>   this function — whatever marked them paid was a different path entirely (manual/test data), not
>   a real charge. **Fixed**: migration `20260810000002_bookings_payment_status_allow_charging.sql`
>   adds `'charging'` to the constraint; `charge-campaign` now checks `error` from the lock update
>   explicitly instead of only `data`, so a real failure there can never again be mistaken for
>   "someone else already has the lock." Re-verified live end-to-end: identical disposable
>   reproduction now reaches the real business-logic branch (`400` "no payment account", the
>   correct outcome for a test advertiser with no card) instead of being blocked before ever
>   getting there — did not push an actual Stripe charge as part of verification, since that moves
>   real money and needs its own explicit authorization separate from bug verification. Both
>   B22/B23 test rounds (operator, screen, policy, two campaigns/bookings, campaign_screens,
>   notifications, advertiser account) fully cleaned up after.
>
> **Go/No-Go:** auto-approve policy path is 🟢 GO now that both bugs are fixed — but B23 means the
> **entire charge-on-approval payment flow, for every caller, was silently non-functional until this
> session**, not just the new auto-approve path. Worth a deliberate real-card smoke test (approving
> a real Pay-later campaign end-to-end, an authorized live Stripe test-mode charge, not something
> this session should do unilaterally) before wide launch, given how long this sat broken unnoticed.

> **Update — session 21 (2026-08-10, UI/UX polish sweep — advertiser dashboard live click-through):**
> Per the user's request for a full UI/UX pass, went deep on area 1 (onboarding/dashboard) with a
> real logged-in click-through (advertiser demo account) rather than code-reading alone. First
> re-verified the `App.jsx` mode-switch effect flagged "unconfirmed" after session 6 — already
> fixed (deps use `user?.id`, not the `user` object; comment documents why) — no bug, no change
> needed.
>
> - **B24 (blocker, found + fixed) — `stripe-billing` has never once returned a response a
>   browser could read.** No `OPTIONS` handler, no `Access-Control-Allow-Origin` on any response.
>   Confirmed live: clicking into Billing (or the "Set up billing" prompt inside the campaign
>   wizard) hung forever on "Loading billing…" — the browser's CORS preflight fails before the
>   request even reaches the function, so `BillingView.jsx`'s `load()` throws `TypeError: Failed
>   to fetch` and the page never resolves out of its loading state. Every advertiser's Billing page
>   — the only place to view or add a payment method — was completely unreachable from the browser.
>   **Fixed**: added the same `CORS` constant + `OPTIONS` handler pattern already used in
>   `send-notification`, applied to every response path, wrapped the Stripe calls in `try/catch`
>   so a Stripe-side failure also returns a readable CORS'd error instead of an unhandled
>   exception. Deployed (v6, `verify_jwt` unchanged at `true`). Re-verified live: Billing now loads
>   correctly ("No payment methods on file" / "No invoices yet" for this test account, no console
>   errors).
> - **B25 (blocker, found + fixed) — `charge-campaign`'s real responses have the identical gap,
>   on the function B22/B23 (session 20) declared fixed.** Auditing why the billing CORS bug
>   existed prompted a sweep of every edge function for CORS-header coverage vs. `Response(...)`
>   call count (`grep -c` across `supabase/functions/*/index.ts`). Nearly every function only sets
>   `Access-Control-Allow-Origin` on its `OPTIONS` preflight, not on the actual response — but
>   `charge-campaign` is the one where that matters most: every one of its 18 response paths
>   (200 success and all 8 error branches) only set `Content-Type`, no CORS header. A browser
>   enforces CORS on the actual response, not just the preflight, so **every real advertiser/
>   operator click that reaches this function from the browser — `ApprovalQueue.jsx`'s
>   `attemptCharge`, the advertiser's own Pay flow — gets a CORS-blocked "Failed to fetch"**,
>   regardless of what the business logic underneath would have returned. This is why B22/B23's
>   live verification last session could reach "the real business-logic branch" at all: that
>   verification called the function directly (no browser, no CORS enforcement), not through the
>   actual UI. The underlying payment logic B22/B23 fixed is very likely correct now — but no
>   advertiser or operator using the real dashboard could ever have reached it. **Fixed**: same
>   `CORS` constant applied to all 18 response paths. Deployed (v16, `verify_jwt` preserved at
>   `false` — confirmed the current deployed value before redeploying, since flipping it back to
>   `true` would silently break the B22 internal-caller bypass from `sweep-approvals`). Not yet
>   live-verified through an actual browser Approve/Pay click (would require pushing a real or
>   test-mode Stripe charge, out of scope for a UI sweep) — the CORS mechanism itself is
>   unambiguous from the code and matches B24's exact symptom, but flagging that the full
>   browser-based charge flow still deserves the real-card smoke test session 20 already
>   recommended.
> - **Systemic finding, not yet fixed — CORS-header coverage is thin across most of
>   `supabase/functions/`.** The full survey: ~25 of 33 functions have exactly one CORS-header
>   occurrence (the preflight) regardless of how many response paths they have. Most of those are
>   legitimately server-only (crons, webhooks, `sweep-approvals`, `stripe-webhook`, `trigger-payout`,
>   etc.) and never see a browser request, so they're not bugs. But several are browser-called and
>   unaudited this session: `create-checkout-session`, `create-connect-account`,
>   `create-identity-session`, `get-stripe-charges`, `operator-billing`, `setup-billing`,
>   `stripe-capture-payment`, `stripe-create-intent`, `stripe-refund`, `invite-operator`,
>   `invite-team-member`, `manual-review-operator`, `accept-operator-invite`, `campaign-report`,
>   `confirm-connect-account`, `ingest-impressions`, `ingest-plays`. Any of these could be hiding
>   the same silent failure B24/B25 were. Worth a dedicated pass rather than blind-fixing all of
>   them here — each needs a quick check of whether it's actually browser-reachable before
>   touching it.
>
> Also fixed in passing during the same click-through, none launch-blocking on their own:
> pluralization ("1 screens" → "1 screen") across 4 advertiser/operator views + a shared
> `pluralize()` helper added at `src/lib/pluralize.js`; `NotificationBell` had no accessible name
> (`aria-label="🔔"` in effect) — now `aria-label="Notifications, N unread"` + `aria-hidden` on the
> decorative emoji; the advertiser dashboard and Campaigns KPI rows were missing icons on some
> cards where every other KPI row in the app has one on all cards — added, matching the existing
> per-page icon vocabulary; and the "Set up billing →" prompt inside the campaign wizard's
> no-payment-method banner called `onCancel()` — silently abandoning the in-progress campaign back
> to Overview instead of taking the advertiser to Billing. Now navigates to `/app/adv-billing`,
> the same pattern `StepPay` already used one step later in the same wizard.
>
> **Go/No-Go this session:** area 1 (advertiser dashboard/onboarding) stays 🟢 GO for what a
> logged-in click-through can reach; area 2 (payments) drops to 🟡 **pending a real browser-based
> Approve/Pay smoke test** — B25 means the B22/B23 fix was never actually reachable from the UI
> until this session, so it's unverified through the front door despite being "fixed" twice now.
> Next pass: continue the UI/UX sweep (operator dashboard, remaining advertiser nav — Analytics,
> Scans & Data, Alerts & Rules, Settings, Integrations), and/or the CORS audit of the 17 unaudited
> browser-facing functions listed above.

> **Update — session 21 continued (2026-08-10, operator dashboard sweep — screen onboarding live
> click-through):** Continued the same click-through session, switched to Operator mode (same
> account, no re-login needed — `activeMode` is independent of role) and ran the empty-state
> "Set up your first screen" flow end to end: 5-step wizard (Welcome → Register → Setup → Connect →
> Payouts) with a real disposable screen, cleaned up after.
>
> - **B26 (blocker, found + fixed) — every operator's Screen Detail page was completely broken,
>   platform-wide, for any screen, not just freshly-created ones.** Finishing the onboarding wizard
>   landed on "Screen not found." Re-tested via a completely fresh path — back to the Screens list,
>   click the card — same result, ruling out a one-off race. Root cause, confirmed by replicating
>   `ScreenDetail.jsx`'s exact `SCREEN_COLS` query against the live DB from the browser's own
>   session: `error.code 42501 "permission denied for table screens"` — not an RLS rejection (which
>   returns an empty result, not a permission error), a missing column-level GRANT.
>   `20260703000000_secure_screen_token_and_scans.sql` (session 3) replaced `screens`' table-wide
>   SELECT grant with a column-scoped one; every column added since needs its own companion GRANT
>   or it's invisible to `anon`/`authenticated` regardless of RLS. This exact gap already happened
>   once before — `20260727000003_screens_creative_spec_column_grant.sql` fixed it for 4
>   creative-spec columns — but recurred for **`cv_last_seen`** (added in session 13's
>   `20260810000000_cv_agent_last_seen_column.sql`, the S19/S20 health-signal fix) and
>   **`review_sla_hours`** (added in `20260725000020_approval_sla.sql`), neither of which got the
>   companion grant. `cv_last_seen` broke every Screen Detail page load (status, editing, uptime,
>   campaign history — and the Stripe Connect payout button, since `startStripeConnect` lives on
>   this exact page); `review_sla_hours` broke `OperatorSettingsView.jsx`'s Review tab (the
>   auto-approve SLA policy UI) the same way. A third column, `coordinates_missing`, had the same
>   gap but isn't selected by any current frontend query — granted proactively before something
>   starts reading it and hits this blind a third time. **Fixed**: migration
>   `20260811000000_screens_missed_column_grants.sql`, `GRANT SELECT (cv_last_seen,
>   review_sla_hours, coordinates_missing) ON public.screens TO anon, authenticated`. Re-verified
>   live: Screen Detail now loads fully (revenue, uptime, screen details, revenue split, payout
>   setup, campaign history) and the Settings → Review tab loads its SLA field (`24` default) with
>   no console errors. Disposable test screen and the operator-role promotion its insert trigger
>   caused were both cleaned up after (`advertiser@adgrid.io` restored to `role='advertiser')`.
> - Also confirmed clean in the same pass: the registration wizard's Next button correctly gates
>   on all 9 required fields (name, owner, state, city, location, category, environment, position,
>   display size, foot traffic > 0, coordinates) — but **gives zero visible feedback when
>   disabled**. No asterisks on required labels, no inline error, nothing — a real operator missing
>   one field would see an unresponsive button with no clue why. Not fixed this session (a labeling
>   pass touches ~9 field labels across a large form component; flagging rather than rushing it).
>   the map-pin step, connection test, and Stripe Connect entry point all degrade cleanly (clear
>   empty/error states, no crashes) when there's no real hardware or Stripe account to test against.
>
> **Go/No-Go:** area 1 (operator onboarding) was 🔴 **fully blocking** before this fix — no
> operator could ever view a screen they registered — now 🟢 GO. Next pass: the disabled-Next-button
> feedback gap (should-fix, not blocker), the rest of the operator dashboard (Approval Queue,
> Revenue, Audience & Scans, Advertisers, Live Signals, Display Manager), or the remaining
> advertiser nav / CORS audit carried forward from earlier this session.

> **Update — session 21 continued (2026-08-10, operator dashboard sweep — remaining nav, B27
> found, not fixed):** Continued through Revenue, Audience & Scans, Advertisers, Live Signals,
> Alerts & Rules, Integrations, Display Manager. Fixed one confirmed correctness/trust bug
> (Integrations page hardcoding two platforms as already "Connected" to every operator, with a
> real business's likely subdomain fabricated as the detail string — see commit
> `fix(integrations)`) and found one significant, **not yet fixed**, architectural issue:
>
> - **B27 (should-fix, not blocker, not fixed this session) — dual-role accounts get their own
>   advertiser spend misattributed as operator revenue.** `loadData()` in `App.jsx` fetches
>   `bookings.select('*')` with no application-level scoping, relying entirely on RLS. RLS
>   correctly OR's together "bookings where I'm the advertiser" and "bookings where I'm the
>   operator of the targeted screen" (two separate, both-correct read policies) — but the single
>   resulting `campaigns` array is then passed to every operator-only view (Dashboard, Campaigns,
>   Revenue, Display Manager) with no further filter down to "bookings actually targeting screens I
>   operate." Confirmed live and reproduced end-to-end: this session's test account
>   (`advertiser@adgrid.io`) has its own pre-existing advertiser campaign ("Test Brand Co," $500,
>   booked on `SCR-001` — a screen owned by a *different* operator entirely) show up throughout its
>   own operator dashboard as if it were real activity on its own screen network: Total Booked
>   $500, Revenue Split $60 platform / $176 owner / $264 pool, and a screen it doesn't own
>   ("Corner Brew — Oxford St") listed in Display Manager. Not an RLS/security leak — the account
>   genuinely can read that row — but a real revenue-reporting correctness bug. The platform has a
>   dedicated "unified account mode switcher" feature (`2026-06-05-unified-account-mode-switcher`),
>   so a single account holding both advertiser and operator activity is a supported pattern, not
>   an edge case — any such account's operator-side revenue/booking totals are currently wrong.
>   **Not fixed this session**: correctly splitting "bookings I created as advertiser" from
>   "bookings targeting screens I operate" touches `loadData()` plus every operator view consuming
>   `campaigns` (Dashboard.jsx, Campaigns.jsx, Revenue.jsx, DisplayView.jsx at minimum) without
>   breaking the legitimate case operators must keep seeing — bookings from *other* advertisers on
>   their own screens. That's a scoped fix, not a quick patch; flagging for a deliberate pass
>   rather than rushing a change to revenue-reporting code.
> - Also noted, not chased further: a React "missing key prop" console warning attributed to
>   `DisplayView` — every `.map()` in that file already has a `key`, so the actual source is
>   unclear without more digging; low priority (dev-only warning, no user-visible effect).
>
> **Go/No-Go:** operator dashboard nav (Approval Queue, Revenue, Audience & Scans, Advertisers,
> Live Signals, Alerts & Rules, Integrations, Display Manager) all render cleanly with sane empty
> states — 🟢 GO for UI/UX. B27 is a data-correctness issue layered underneath, not a rendering
> bug — worth fixing before onboarding any real dual-role operator/advertiser accounts at scale.

> **Update — session 21 continued (2026-08-10, B27 scoped and fixed):** Went back and fixed B27
> rather than carrying it forward. Root cause was worse than first described — not just the 4
> operator views spot-checked, but **every** operator-mode consumer of `campaigns` (Dashboard,
> Campaigns, Analytics, Audience, Revenue, Billing, SignalsView, DisplayView, ApprovalQueue — 9
> views total), plus a mirror-image version on the advertiser side (`Campaigns.jsx`/`Analytics.jsx`
> are shared between both modes and never filtered by `advertiser_id` internally, so
> `adv-campaigns`/`adv-analytics` could show bookings on screens a dual-role account operates,
> submitted by *other* advertisers), plus a third, fully independent instance in
> `AdvertisersView.jsx`, which runs its own separate `bookings.select('*')` query with the exact
> same missing scope, unrelated to `App.jsx`'s `loadData()`.
>
> Fixed with `useOperatorCampaignIds` (new hook, `src/hooks/useOperatorCampaignIds.js` — queries
> `campaign_screens` directly for the set of campaign ids actually targeting the caller's own
> screens, mirroring the existing `usePendingApprovalCount` pattern rather than trusting anything
> off the booking row itself) and two memoized derived arrays in `App.jsx`
> (`advertiserCampaigns`/`operatorCampaigns`), threaded to every mode-specific consumer in place of
> the raw RLS-visible union. `AdvertisersView.jsx` now fetches its own screen ids and applies the
> same hook independently. 3 new unit tests, 576/576 passing.
>
> Re-verified live end-to-end: switched this session's test account back and forth between modes.
> Operator Dashboard/Revenue/Advertisers all now correctly show $0 (zero real screens, so zero real
> operator revenue) instead of leaking the account's own $500 advertiser campaign; the advertiser
> side's "My Campaigns"/Dashboard still correctly show that same $500 campaign, unaffected —
> confirming the fix separates the two without breaking the legitimate case in either direction.
>
> **Go/No-Go:** B27 is now 🟢 GO, live-verified in both directions.

> **Update — session 21 continued (2026-08-10, CORS audit closed out):** Finished the systemic
> CORS audit flagged earlier this session. Of the 17 previously-unaudited browser-facing
> functions: `create-connect-account`, `confirm-connect-account`, `invite-team-member`,
> `accept-operator-invite`, `campaign-report`, and `ingest-plays` were already fully correct
> (properly using a shared `CORS` const on every response, not just the preflight). 4 stub
> functions (`create-checkout-session`, `stripe-capture-payment`, `stripe-create-intent`,
> `stripe-refund` — all retired 410 endpoints) were also already fine. 7 had the same gap as
> B24/B25/B26: `setup-billing`, `create-identity-session`, `operator-billing`, `invite-operator`,
> `manual-review-operator`, `get-stripe-charges`, `ingest-impressions`. Most consequential:
> **`setup-billing` is the literal "+ Add Payment Method" button** on the Billing page whose
> *load* B24 fixed earlier this session — advertisers could reach Billing but the one thing they'd
> go there to do, add a card, silently failed the same way. Live-verified: clicking Add Payment
> Method now reaches a real Stripe Checkout session instead of "Failed to fetch." All 7 deployed,
> `verify_jwt` confirmed and preserved per-function before redeploying (not assumed). 576/576 tests
> passing throughout.
>
> **Go/No-Go:** the CORS-header gap across `supabase/functions/` is now fully closed for every
> browser-reachable function. Remaining known gaps in the codebase after this session: the
> silent-disabled-Next-button UX issue in the screen registration wizard (should-fix, not
> blocker), and the two manual Supabase dashboard toggles (Google OAuth secret, leaked-password
> protection) carried forward from every prior session.

## Next pass — focus areas

All 9 areas have now been covered at least once (07-03 baseline, 07-06/07-07 deep re-checks).
What's actually left, in priority order:

1. **Google OAuth client secret** — manual-only, Supabase Auth → Providers → Google. Blocking
   for anyone who doesn't use password login.
2. **S2 — leaked-password protection toggle** — manual-only, Supabase Auth → Providers → Password.
3. ~~**Real click-through, logged in as a real user**~~ — ✅ **Done session 6**: full advertiser
   signup → campaign creation → operator approval → billing run-through. Found and fixed **B10**,
   a launch-blocking bug bigger than any prior finding — campaign creation had been completely
   broken since the feature was built (`225ac27`). B6 (login redirect) re-verified working live.
4. **Operator mobile app on a real device/simulator** — the schema fixes (B4) and onboarding fix
   (B5) are verified by Jest against a mocked Supabase client, never against Expo Go or a real
   build. **Attempted session 7**: no emulator/device/LAN path from this environment, so this
   still isn't done — found and fixed a real crash along the way (**B11** — `expo-secure-store`
   has no web implementation, crashed the app instantly under `expo start --web`), but full
   verification needs the user's own machine and phone.
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
provide — not on further code review. Worth a look but unconfirmed: the `App.jsx` mode-switch
effect described in session 6 that could silently discard in-progress form state app-wide.
