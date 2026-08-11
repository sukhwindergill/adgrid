# Screen Referral Invite ("Bring Your Own Advertiser") — Design Spec
_Date: 2026-08-11_

## Problem Statement

AdGrid is pre-launch and fully cold on both sides of the marketplace — zero screens, zero advertisers, no committed relationships on either side. The product's core loop only pays off once both sides already exist: an operator gets a reason to stay only after an advertiser books their screen, and an advertiser gets a reason to book only once there's inventory worth targeting. Today the operator's entire pitch is "list your screen and wait" — a pure leap of faith with no individual payoff and no way for the operator to influence the outcome. With no budget for guaranteed-income offers and no founder time to hand-broker the first matches, the platform needs a way to generate its own demand without relying on either scarce resource.

Most operators already know at least one local business that would plausibly advertise with them — a landlord who knows their retail tenants, a café owner who knows the gym next door. Today there is no way for an operator to act on that relationship inside the product: no shareable link, no pre-scoped landing experience, no visibility into whether someone they invited ever showed up.

## Goals

1. **Give every operator a concrete first action beyond "wait."** Immediately after registering a screen (or at any time after), an operator can generate a shareable invite tied to that specific screen.
2. **Remove signup friction for the invited advertiser.** Someone who clicks an operator's invite link lands already scoped to that screen — no area search, no "which screen do I even want" decision — and can go from link click to a submitted campaign in one sitting.
3. **Close the feedback loop for the inviting operator.** An operator can see, without leaving the product, whether their invite was opened, whether the person signed up, and whether they've actually booked — so "list and wait" becomes "list, invite, and see something happen."
4. **Zero ongoing cost to run.** No founder time and no monetary incentive required to operate this loop once built — it is a self-serve growth feature, not a manual outreach program.

## Non-Goals

- **Monetary or fee-discount incentives for successful referrals.** No budget for this in v1; the mechanism is scoped to reduce friction and increase visibility, not to pay for growth. Revisit as a P2 once there's usage data to justify the cost.
- **Multi-screen or bulk invite campaigns** (e.g., "invite 20 businesses at once from a CSV"). v1 is one operator sharing one link for one screen, by hand, to people they already know. Automating outreach at volume is a different, riskier feature (spam/abuse surface) for a later phase.
- **Inviting by email send.** Confirmed dead this session (Resend domain unverified, every transactional email fails silently) — building an email-send step into a brand-new growth feature on top of infrastructure known to be broken is a guaranteed early failure. v1 is a copyable link the operator shares themselves (text, WhatsApp, in person), with in-app/push notifications for status updates to the operator's own account, not the invitee's.
- **Advertiser-side reciprocal invites** ("invite another advertiser you know"). The cold-start problem this session identified is specifically supply-side reluctance; advertiser-side referral is a plausible v2 once there's inventory worth referring someone to.
- **Fraud/abuse prevention beyond basic reuse limits.** No rate-limiting, no bot detection, no invite-farming defenses in v1 — pre-launch volume is low enough that this is premature; document as a P2 to revisit once real usage exists.

## User Stories

**Operator**
- As an operator with a newly registered screen, I want a shareable link for that screen so that I can send it to a specific local business I already know.
- As an operator, I want to see the status of everyone I've invited (sent → viewed → signed up → booked) so that I know whether my outreach is working.
- As an operator, I want to be notified in-app when someone I invited signs up or books, so that I don't have to keep checking manually.
- As an operator, I want to generate a new invite link at any time, not just during onboarding, so that I can invite more businesses as I think of them.

**Invited advertiser**
- As someone who clicks an operator's invite link, I want to land on a page that already shows me the specific screen I'm being invited to advertise on, so that I don't have to search for it myself.
- As an invited advertiser, I want to sign up and start a campaign already scoped to that screen, so that accepting the invite feels like one continuous action, not a generic signup followed by a separate search.
- As someone who clicks an expired or already-converted invite link, I want a clear message and a normal path into the product, so that a stale link doesn't dead-end me.

## Requirements

### Must-Have (P0)

**Schema — `screen_invites` table**
- Columns: `id`, `screen_id` (FK → `screens.id`), `operator_id` (FK → `profiles.id`, denormalized off `screens.operator_id` for query convenience), `token` (unique, same `gen_random_bytes`-based generation as `operator_invites`), `status` (`pending` | `viewed` | `signed_up` | `booked`), `view_count` (int, default 0 — increments on every load where `status != 'booked'`, independent of the `status` pipeline stage), `created_at`, `viewed_at`, `signed_up_at`, `booked_at`, `converted_advertiser_id` (FK → `profiles.id`, nullable), `converted_campaign_id` (FK → `bookings.id`, nullable).
- RLS: operator can `select`/`insert` their own screens' invites (`screen_id in (select id from screens where operator_id = auth.uid())`); public `select` by `token` only (same pattern as `operator_invites`' "anyone can read invite by token" policy — needed for the unauthenticated landing page to look up screen/status before signup).
- Acceptance criteria:
  - [ ] Migration creates the table, indexes on `token` and `screen_id`, and RLS policies mirroring `operator_invites`' shape.
  - [ ] An operator can only create/view invites for screens where `operator_id = auth.uid()`.

**Operator-side: generate & manage invites**
- Entry point on `ScreenDetail.jsx` (a new "Invite an advertiser" section, alongside the existing Payout Setup card) — not a separate page for v1, since it's screen-scoped and that's already the natural home.
- "Get invite link" button calls a new `create-screen-invite` edge function (`POST { screen_id }`, bearer-authed, verifies caller owns the screen), returns `{ token, url }`. Multiple invites per screen are allowed (an operator inviting several different businesses); each gets its own token.
- List of this screen's invites: status badge, view count, created date, and (once known) which advertiser/campaign it converted to.
- Acceptance criteria:
  - [ ] Given an operator on their own screen's detail page, when they click "Get invite link," then a new `screen_invites` row is created and a copyable URL is shown.
  - [ ] Given an operator with 3 existing invites on a screen, when they view the screen detail page, then all 3 show their current status.
  - [ ] Given an operator viewing another operator's screen (should be unreachable via normal nav, but defensively), the edge function rejects with 403.

**Invitee-side: landing + pre-scoped signup**
- New public route `/invite/screen/:token` (distinct path from the existing `/invite/:token`, which is operator-role invites — different domain object, different flow, must not collide).
- On load (unauthenticated-safe, mirrors `/invite/:token`'s pattern): look up `screen_invites` by token via the public-read policy. Show:
  - **Valid, unconverted**: screen name, city, venue category, a photo if the screen has one, and a "Get Started" CTA. Increment `view_count` on every load; flip `status` to `viewed` only the first time (if currently `pending`) so the pipeline stage reflects "has this ever been seen," while `view_count` reflects total visits.
  - **Already converted** (`status = 'booked'`): friendly "this invite's already been used" message with a normal link into `/login` or `/` — not an error state, just informational.
- "Get Started" routes into the existing signup flow (`LoginPage.jsx`'s signup mode, pre-set to "Run ad campaigns"), carrying the invite token through (query param or session storage — implementation detail, not a product decision) so it survives the signup round-trip.
- Immediately after signup completes, land the new advertiser directly in `CreateCampaign` with the invited screen pre-selected — skipping the area-search step entirely, not just pre-filling it. Requires a new optional prop on `CreateCampaign` (e.g. `presetScreenIds`) that seeds `form.selected_screen_ids` directly and starts the wizard on the Creative step rather than Targeting.
- On this landing → signup transition, update `screen_invites.status = 'signed_up'`, `signed_up_at`, `converted_advertiser_id`.
- On that advertiser's *first* submitted campaign/booking (not just draft creation — the point where `charge-campaign` would eventually be reached), update `status = 'booked'`, `booked_at`, `converted_campaign_id`.
- Acceptance criteria:
  - [ ] Given a valid, never-visited invite link, when someone loads it, then the screen's real name/city/category render and `status` flips to `viewed`.
  - [ ] Given someone completes signup via an invite link, when they land in the app, then `CreateCampaign` opens with that exact screen pre-selected and no area-search step shown.
  - [ ] Given an invalid token (malformed, never existed), the page shows a clear "this invite link isn't valid" state, not a raw error or blank screen.
  - [ ] Given an already-`booked` invite, a second visitor sees the "already used" state, not the live invite flow.

**Operator notifications**
- New notification types, following the existing `notifications` table's free-text `type` column (no enum, no migration needed beyond the values themselves): `screen_invite_signed_up`, `screen_invite_booked`. Fire via the existing `send-notification` function's in-app path — **not** email (confirmed broken; see Non-Goals).
- Acceptance criteria:
  - [ ] Given an operator whose invite converts to a signup, they see an in-app notification within the existing `NotificationBell` without a page refresh (same realtime subscription already in place).

### Nice-to-Have (P1)

- Suggested share copy/template text next to the invite link ("Hey — I just listed my screen on AdGrid, want first look at advertising on it?") so operators don't stare at a blank link with no idea what to send.
- QR code rendering of the invite URL (the codebase already has a QR component built for campaign creatives — reusable), for operators who'd rather show it in person than send a link.
- Surface aggregate invite performance (sent / viewed / signed-up / booked counts) on the operator's main Dashboard, not just per-screen on Screen Detail, once an operator has multiple screens each with their own invites.

### Future Considerations (P2)

- Incentive mechanics (fee discount, bonus credit) once there's real conversion data to justify the cost.
- Bulk/CSV invite sending.
- Reciprocal advertiser-side referrals.
- Rate-limiting / abuse prevention on invite creation and link visits.

## Success Metrics

**Leading indicators** (days to weeks post-launch):
- **Invite creation rate**: % of operators who generate at least one invite link within 48 hours of registering a screen. Target: 40%+ — if this is low, the entry point itself is the problem (visibility/placement on Screen Detail), not the concept.
- **Link-to-signup conversion**: % of `viewed` invites that reach `signed_up`. Target: 15%+ (cold outreach to someone you personally know should convert far better than a generic ad).
- **Signup-to-booked conversion**: % of `signed_up` invitees who submit a real campaign. This is really a measurement of the pre-scoped `CreateCampaign` flow's effectiveness, not the invite mechanism itself.

**Lagging indicators** (weeks to months):
- **% of total advertiser signups attributable to a screen invite** vs. organic/waitlist signup — the real test of whether this meaningfully unblocks cold-start liquidity or is a rounding error next to whatever else drives growth.
- **Operator retention delta**: do operators who send at least one invite stay active (return to the dashboard, keep their screen live) longer than operators who never do? If invite-senders churn at the same rate as everyone else, the feature isn't delivering the "something happened" payoff it's meant to.

## Open Questions — resolved

- **(Product) View tracking** — resolved: show a raw view count per invite (e.g. "3 views, 0 signups"), not just pipeline-stage status. Requires a `view_count` column (or a lightweight `screen_invite_views` log if per-view detail is ever needed later — v1 is a plain counter, incremented on every load where `status` is not yet `booked`, not just the first).
- **(Product) URL shape** — resolved: `/invite/screen/:token`, as drafted.
- **(Design) Starter budget** — resolved: normal wizard defaults. `presetScreenIds` only pre-selects the screen and skips the area-search step; budget/schedule stay the standard wizard flow.
- **(Engineering, non-blocking)** Confirm whether carrying the invite token through the signup round-trip is cleanest via a query param preserved through `LoginPage.jsx`'s redirect, or `sessionStorage` (mirrors the existing `stripe_connect_state` pattern already used elsewhere in the codebase) — implementation detail, doesn't change the spec.

## Timeline Considerations

No hard deadline — this is a pre-launch unblocker, not a scheduled release. Sequencing matters more than a date: this is the highest-leverage available lever given the "no time, no budget" constraint established this session, and should land before any broader marketing push, since it's meant to be the thing operators are handed the moment they finish registering a screen.
