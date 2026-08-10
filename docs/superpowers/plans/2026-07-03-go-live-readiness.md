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
