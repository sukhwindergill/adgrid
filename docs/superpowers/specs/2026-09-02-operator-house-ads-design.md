# Operator House Ads

## Problem

An operator's screen has unsold airtime. Today the only content that can play is a paid advertiser campaign — unsold time just shows the idle slide. Operators want to fill that unsold time with their own promotional material (self-ads for their own business, or filler content) without paying themselves, and without that content ever displacing a paying advertiser's booking.

## Goals

- Operator can create ad content for their own screen(s) through the existing campaign-creation flow, at no cost.
- House ads only ever play in airtime not claimed by paid, approved campaigns.
- Operator can cap the maximum share of the loop house ads are allowed to occupy, even when paid demand is low.
- The revenue the operator is giving up by running house ads instead of selling that space is visible in Revenue/Analytics.
- No new payment bypass surface is introduced — the existing service-role-only lock on `bookings.payment_status` is preserved.

## Non-goals

- No new ad-serving pipeline. House ads reuse `bookings` / `campaign_screens` / `campaign_creatives` / `display-feed` / proof-of-play exactly as they exist today.
- No cross-operator marketplace implications — house ads are scoped to the operator's own screens only.
- No guarantee of a minimum house-ad floor when the screen is fully booked by paid campaigns (explicitly rejected in brainstorming — see Decisions).

## Data model changes

- `bookings.is_house_ad boolean NOT NULL DEFAULT false` — marks a booking as operator-owned, non-revenue content.
- `screens.house_ad_max_pct numeric NOT NULL DEFAULT 20` — operator-configurable ceiling (0–100) on the share of loop time house ads may occupy on that screen. Enforced only when paid campaigns are also live on that poll (see Decisions).

Both columns are plain additive migrations; no existing column semantics change.

## Creation flow

1. Operator gets a "Create House Ad" entry point from [Screens.jsx](../../../src/views/operator/Screens.jsx) and [ScreenDetail.jsx](../../../src/views/operator/ScreenDetail.jsx).
2. It opens the existing advertiser [CreateCampaign](../../../src/views/advertiser/CreateCampaign.jsx) wizard (creative upload, scheduling, dayparting — all unchanged), pre-scoped so screen targeting is locked to the operator's own screen(s) and the budget/payment step (`StepBudgetReview.jsx`) is skipped entirely.
3. On submit, a new edge function `create-house-ad` (service role, mirrors the existing `charge-campaign` function's write pattern) inserts the `bookings` row with `is_house_ad = true` and `payment_status = 'paid'` directly — this is the only code path permitted to set a house-ad booking to `paid`, since `bookings.payment_status` is locked to service-role writes only (`20260611000002_lock_bookings_update.sql`). A client can never mark its own booking free.
4. The corresponding `campaign_screens` row is inserted as `status = 'auto_approved'` — it's the operator's own screen, no advertiser-review step applies.

Everything downstream (creative assignment, dayparting, per-screen overrides) works unmodified because a house-ad booking is a normal `bookings` row to every other reader.

## Fill priority and cap enforcement

Enforced in `supabase/functions/display-feed/index.ts`, after `activeCampaigns` is assembled for the current poll:

1. Partition `activeCampaigns` into `paid` and `house` (via `is_house_ad` joined from `bookings`).
2. If `paid` is empty, `house` is returned unfiltered — no paid revenue exists to protect this poll, and leaving the screen dark for the sake of an unused cap would defeat the feature's purpose.
3. If `paid` is non-empty, compute `paidDuration = Σ paid[].duration` and the allowed house budget `allowedHouseDuration = floor(cap / (100 - cap) × paidDuration)` where `cap = screen.house_ad_max_pct`. Include house entries (stable order, e.g. by `booking id`) until their cumulative duration would exceed `allowedHouseDuration`, dropping the remainder for this poll cycle.
4. House ads are never allowed to reduce or bump any paid entry — trimming only ever removes house entries, never paid ones.

This means house ads never affect a paying advertiser's delivery, and the cap is a ceiling on the *leftover* share, not a reserved floor — consistent with "never bump paid" from brainstorming.

## Revenue / opportunity-cost visibility

[Revenue.jsx](../../../src/views/operator/Revenue.jsx) gains a line item estimating revenue foregone to house ads: for house-ad play time recorded via the existing `ingest-plays` → proof-of-play pipeline (unchanged — house ads flow through it like any booking), apply the same rate formula Revenue.jsx already uses to turn a paid campaign's play time + `screens.cpm_floor` into a dollar figure, and label the result as an estimate (e.g. "$X in potential revenue given up to house ads this period"). The exact existing formula will be confirmed by reading Revenue.jsx during planning rather than re-derived here, to keep the two calculations consistent.

## Decisions made during brainstorming

- **Fill priority:** configurable max-% cap, not unconditional filler-only and not a guaranteed floor.
- **Never bumps paid:** the cap only ever limits how much of *unbooked* time house ads may claim; it can never shrink a paid campaign's share.
- **Creation flow:** reuse the existing advertiser booking/campaign wizard rather than building a separate lightweight form, to keep house ads on the exact same scheduling/targeting/creative machinery advertisers use.
- **Zero-paid-demand behavior:** the cap is not applied when no paid campaigns are live on a given poll (explicit call-out, confirmed by user) — house ads may fill the whole loop rather than leave the screen idle under a cap with nothing to protect.

## Testing

- `display-feed` cap-trim logic: unit tests covering zero-paid (uncapped), paid+house under cap (unfiltered), paid+house over cap (trimmed correctly), paid-only, house-only-with-cap-irrelevant.
- `create-house-ad` function: asserts it is the only path that can set `is_house_ad`/`payment_status='paid'` together, and that a spoofed client request without service-role credentials is rejected (consistent with the existing `bookings` update lock).
- Revenue.jsx: test asserting the opportunity-cost figure is computed from house-ad play time using the same rate formula as paid revenue.

Follows this repo's existing per-file `*.test.jsx`/`*.test.ts` convention alongside the files each test covers.
