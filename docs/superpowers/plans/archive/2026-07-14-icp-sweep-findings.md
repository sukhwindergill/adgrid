# AdGrid ICP Sweep — Session 8 Findings (2026-07-14)

**Type:** Report-only. No code changed this session (per request). Every finding below is
verified live against production Supabase (`hkqiuwnppxkkztacwicj`) using a throwaway advertiser
account that was fully deleted afterward.

**Method:** Ran the two ICPs that actually transact — advertiser and screen operator — plus the
QR end-consumer path, as real click-throughs against the live backend, then confirmed root causes
in code + SQL. Focus areas this pass: **onboarding funnels, QR/scan measurement, cross-tenant
data scoping, notifications, and investor-facing data quality** — deliberately going past the
"campaign creation works now" checkpoint from session 6.

---

## TL;DR for the morning

The app *looks* done and the happy path (signup → build campaign → review → pay-wall) now works
end-to-end. But the **measurement and money-out halves of the marketplace — the parts that make
this a business rather than a demo — are not actually functioning in production.** Three things
stand out, none flagged in sessions 1–7:

1. **QR scan tracking is dead.** The on-screen QR sends people straight to the advertiser's URL,
   bypassing AdGrid's own tracker. Every advertiser's "QR scans / leads" metric will sit at **0
   forever**, and the entire scan-milestone + pixel-forwarding pipeline is dead code in the real
   flow. This is the product's headline promise ("measure what happens").
2. **Operators' revenue is readable by any advertiser.** RLS hands every advertiser the full
   screen row — including each operator's `monthly_revenue`, `cpm_floor`, and `operator_id` — for
   all live screens. Competitors and advertisers can read each other's numbers.
3. **Nobody can get paid.** Zero operators have an active Stripe Connect account, and nothing in
   the funnel makes them set one up. Advertiser money is captured to the platform but the operator
   transfer is silently skipped — money-in→money-out has never completed once.

Go/No-Go: **NO-GO for public launch.** Fine for a hand-held pilot where you personally wire up
tracking and payouts, but not for self-serve users on either side.

---

## BLOCKERS (can't go public without these)

### B12 — QR scan tracking is completely bypassed in production ⭐ headline finding
**ICP hit:** advertisers (all sizes), and the investor story.
**What's wrong:** `DisplayPlayer.jsx` builds the on-screen QR with `buildQrUrl()`
([DisplayPlayer.jsx:11](src/views/display/DisplayPlayer.jsx:11)), which encodes the advertiser's
`destination_url` **directly** with UTM params. It never points at the `scan-redirect` edge
function. Confirmed: **zero references to `scan-redirect` anywhere in `src/`.**
**Consequences:**
- No `scans` row is ever created when a real person scans a real display. The advertiser
  dashboard's "QR Scans / leads captured", the "Scans & Data" view, and the operator scan counts
  are **permanently 0** in production.
- `scan-redirect`'s scan-milestone notifications (100/500/1k/5k) never fire.
- `fire-integration` (Meta / Google Conversions API pixel forwarding — a real, built feature)
  never fires. The "Integrations" surface is dead in the real flow.
**Proof:** `scan-redirect` itself works when hit directly — `curl` returned `302 → apple.com` with
UTM appended, `400` for missing id, `404` for bogus id. It's a good function that nothing calls.
The only `scans` rows in the DB (5 total) came from direct endpoint hits during testing, never
from a QR.
**Fix direction:** point `buildQrUrl` at `…/functions/v1/scan-redirect?c=<campaign>&s=<screen>`
so the consumer round-trips through the tracker before landing on the destination. Then gate
scan-redirect on campaign status (see S13) and dedup (see S14).

### B13 — Operator revenue & internals leak cross-tenant to every advertiser
**ICP hit:** operators (trust), investors (marketplace integrity).
**What's wrong:** the screens RLS policy `"Advertisers see live screens"` is
`USING (status = 'live' AND is_advertiser())` with **row-level** (not column-level) SELECT. Any
advertiser reads the whole row for all live screens, including `monthly_revenue`, `cpm_floor`, and
`operator_id`.
**Proof:** ran the exact query under a simulated advertiser JWT — returned all 8 live screens with
each operator's `monthly_revenue` ($950–$3,880) and `operator_id`. Also visible in-product: flip
the sidebar toggle to Operator mode as a brand-new advertiser and the dashboard shows
`$15,650 Network Revenue` and every screen's monthly revenue.
**Fix direction:** expose advertiser-facing screen data through a view or column-scoped grant that
omits `monthly_revenue`/`operator_id`/internal fields; keep the full row on the
`operator_own_screens` policy only.

### B14 — Operator payouts never complete; funnel never asks for Connect
**ICP hit:** operators (small + big), investors.
**What's wrong:** `charge-campaign.distributeOperatorCuts()` skips any operator whose
`connect_status !== 'active'` ([charge-campaign/index.ts:69](supabase/functions/charge-campaign/index.ts:69)).
**0 of 2 operators** have an active Connect account, and the screen-onboarding wizard
([ScreenOnboard.jsx](src/views/operator/ScreenOnboard.jsx)) never routes them to set one up. So an
advertiser's card is charged, the platform keeps 100%, and the operator's transfer is silently
skipped. The money-in → money-out loop has never run end-to-end.
**Fix direction:** make Connect onboarding a first-class step in operator onboarding (or block
"live" status until payouts are connected), and surface a "payouts not set up — you won't get
paid" banner on the operator dashboard.

---

## SHOULD-FIX (real support burden / trust damage)

### S13 — advertiser→other-user notifications 403 silently (operators never told a campaign is waiting)
`send-notification` only lets a caller notify *someone else* if their role is `operator`
([send-notification/index.ts:205](supabase/functions/send-notification/index.ts:205)). Two
advertiser-initiated calls therefore 403 every time (verified: `403` in the live network log),
and the frontend `.catch(()=>{})` swallows it:
- **`campaign_submitted` → operator** ([CreateCampaign.jsx:1054](src/views/advertiser/CreateCampaign.jsx:1054)):
  operators get **no notification** that a campaign is waiting for review. They must manually poll
  the approval queue. (A campaign sat 34 days unreviewed in session 5 for a related reason.)
- **`grant_invite` → invitee** ([GrantAccessModal.jsx:58](src/views/accounts/GrantAccessModal.jsx:58)):
  agency delegate invites never notify the invitee.
Combined with email delivery being fully dead (session 5, still open), there is **no signal at
all** reaching the counterparty on these events. Fix: allow a caller to send the specific
`campaign_submitted`/`grant_invite` types to the relevant recipient, or route these through an
internal-secret server call like the cron does.

### S14 — scan-redirect has no status gate and no bot/dedup protection
(Latent until B12 is fixed, but wire it up at the same time.)
- **No status gate:** verified it logged a scan and issued a `302` for a campaign that was
  `pending_review` and `unpaid`. A rejected/paused/expired campaign's QR keeps working and keeps
  counting. Should 404/410 unless the campaign is live+paid.
- **No dedup / bot filter:** every GET counts as a "lead", so link-preview crawlers, the
  advertiser testing their own QR, and refreshes all inflate the number the advertiser is billed
  against and judges ROI by.

### S15 — scan geodata is mislabeled (country code stored as "city")
`scan-redirect` writes the Cloudflare `cf-ipcountry` header (a 2-letter **country** code) into the
`scans.city` column ([scan-redirect/index.ts:48](supabase/functions/scan-redirect/index.ts:48)).
Any "scans by city" analytics shown to advertisers will be wrong (it's country, and only when
behind Cloudflare — it was `null` on a direct hit).

### S16 — advertiser reach estimate always reads "~0K impressions/mo"
All 12 screens have `monthly_traffic_estimate = NULL`, and the onboarding wizard
([ScreenOnboard.jsx StepRegister](src/views/operator/ScreenOnboard.jsx:117)) never collects it. So
the campaign wizard's reach summary and impressions math render `~0K impressions/mo` /
`~No data yet` / `NaNK` at every step (Area, Screens, Review). A self-serve advertiser sees a
campaign that looks worthless before they pay. Fix: collect a traffic estimate at screen
onboarding (or derive one from venue category), and backfill the seed screens.

---

## UX / POLISH (won't block, but erodes confidence)

- **N6 — "NaNK" impressions everywhere.** Operator Dashboard and Screens render null impressions
  as `NaNK` / `—` (e.g. "Impr. NaNK" on every Network Health card). Coerce null→0.
- **N7 — dual status badge.** Every screen shows **both** "Live" and "Offline" at once
  (`status='live'` vs `health_status`). Pick one source of truth per badge.
- **N8 — operator dashboard shows the whole network as "yours".** A user who owns zero screens,
  in Operator mode, sees `$15,650` network revenue and all 8 screens as their dashboard. The
  operator views aren't gated on actually owning screens; this both confuses and amplifies B13.
- **N9 — no role/intent at signup.** Signup ([LoginPage](src/components/login/LoginPage.jsx))
  collects name/email/password only; everyone becomes an `advertiser` and must discover the
  sidebar mode toggle to operate screens. Worse, the marketing "List your screens" CTA goes to a
  **waitlist form, not signup** — so there is no real self-serve operator signup path at all. The
  two ICP funnels are merged and advertiser-biased.
- **N10 — sidebar nav is icon-only** with `title` tooltips but no `aria-label` (repeat of a prior
  note; still open). Screen-reader users can't tell the nav items apart.

---

## What's genuinely working (verified live this session)

- Advertiser signup → email/password login → 5-step campaign wizard → Review → pay-wall runs
  end-to-end. The session-6 `slots`/`duration` fix (B10) holds; the Review summary and the
  `bookings` insert are correct (`slots=10, duration=15, status='pending_review'`).
- The pay-wall "Pay later" path persists the booking cleanly and lands on Campaigns.
- Screen onboarding code is sound: sets `operator_id = user.id`, `status='pending'`, fetches the
  token via the owner-scoped `get_screen_token` RPC, and relies on a DB trigger for
  advertiser→operator role promotion.
- `scan-redirect` edge cases are correct (302/400/404) — the function is fine, it's just unwired.
- Marketing site is clean at 375px mobile; hero, CTAs, and waitlist form all render/scroll well.

---

## Morning task list (ranked)

**Blockers — do first:**
1. [ ] **B12** — repoint `buildQrUrl` through `scan-redirect` so scans are actually recorded.
2. [ ] **B13** — column-scope the advertiser screens RLS policy; stop leaking `monthly_revenue`
       / `operator_id` to advertisers.
3. [ ] **B14** — make Stripe Connect onboarding part of the operator flow; block payout-less
       operators from going "live" and warn them on the dashboard.

**Should-fix:**
4. [ ] **S13** — fix the 403 on `campaign_submitted` / `grant_invite` notifications.
5. [ ] **S14** — gate scan-redirect on campaign status; add basic bot/dedup.
6. [ ] **S15** — store real city (or rename column to `country`); fix advertiser geo analytics.
7. [ ] **S16** — collect/derive `monthly_traffic_estimate`; backfill seed screens so reach ≠ 0K.

**Polish:** N6 (NaNK), N7 (dual badge), N8 (network-as-yours), N9 (role at signup / real operator
signup path), N10 (nav a11y).

**Still open from prior sessions (manual, not code — carry forward):**
- Google OAuth client secret invalid in prod (password login unaffected).
- Supabase leaked-password protection toggle (S2).
- Resend sending domain unowned → **all transactional email dead** (in-app only). This makes S13
  worse: even once the 403 is fixed, operators still won't get an email, only an in-app bell.
- Operator mobile app never run on a real device/simulator.

---

## Next pass — focus areas

Areas covered this pass: onboarding funnels (both ICPs), QR/scan measurement, cross-tenant
scoping, notifications, investor data quality. **Not yet gone deep on this session:**
- **Approval/moderation at scale** (area 3) — only ever tested with 1–2 submissions; behaviour
  with bulk/adversarial content unproven.
- **Display player resilience** (area 4) — network drop / stale-content / crash-recovery on real
  hardware, tied to the still-pending physical-device test.
- **Payments edge cases** (area 2) — refunds, disputes, 3DS re-auth, and the operator-transfer
  path **once B14 is fixed** (currently the transfer branch has never executed).
