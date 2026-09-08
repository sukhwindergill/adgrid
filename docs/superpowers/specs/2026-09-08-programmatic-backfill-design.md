# Programmatic Backfill — Design

Competitive Parity Program, Phase 6 (`docs/superpowers/specs/2026-07-24-competitive-parity-program.md`), G20:

> Programmatic backfill: expose unsold loop time via an OpenRTB endpoint or an SSP integration (Vistar / Broadsign Reach / Hivestack), AdGrid demand taking first look. This is the operator-retention argument: unsold loop time stops being worth zero.

## Problem

An operator's unsold loop time plays the idle slide (or, since G9/house-ads shipped, an operator's own house ad up to `house_ad_max_pct`). Either way, unsold time earns the operator nothing. Every DOOH SSP (Vistar, Broadsign Reach, Hivestack) exists to fill exactly this gap — connect unsold inventory to programmatic demand, take a cut, pay the venue for airtime that would otherwise be worth zero. Not offering this is a real churn risk for any operator whose screen doesn't sell out on AdGrid's own two-sided marketplace alone.

## Why not literal OpenRTB (scope decision, made now rather than discovered mid-build)

OpenRTB is a per-impression, sub-second bid-request/response protocol: an ad server asks "I have an impression right now, who wants it," a bidder answers in ~100ms, the winner's creative plays that impression. AdGrid's display model is fundamentally not that shape: `display-feed` (`supabase/functions/display-feed/index.ts`) is polled by each screen roughly every 30 seconds and returns a **fixed loop** of campaigns to play until the next poll — there is no single "impression moment" to hold a live auction against, and a screen has no ad-server-side render pipeline waiting on a bid response before deciding what to show next.

Building genuine per-impression OpenRTB would mean either (a) rearchitecting the display player to hold open a bid window before each impression — a latency and reliability regression for something that today never blocks on the network to decide what plays next — or (b) faking synchronicity by pre-fetching bids ahead of the poll, which is not OpenRTB, it's a supply-API integration wearing an OpenRTB-shaped label.

**v1 scope decision: build the SSP supply-API integration pattern (option b's honest version), not a bid-request/response OpenRTB endpoint.** Each supported SSP has its own "give me a creative for this inventory description, I'll tell you what it's worth" supply API (this varies per partner — Vistar/Broadsign Reach/Hivestack each have their own; the exact shape is a per-partner adapter, detailed at implementation time once a partner agreement exists) that fits AdGrid's poll-and-serve-a-loop model far better than a literal RTB auction would. A true OpenRTB *endpoint* (AdGrid as the bidder-facing side, accepting inbound bid requests from someone else's exchange) is a plausible v2 once there's a specific partner requiring it — deferred, not attempted here.

## Goals

- An operator's genuinely unsold loop time (after paid AdGrid campaigns and their own house ads) can be filled by external programmatic demand instead of the idle slide.
- Programmatic demand never bumps or shrinks a paid AdGrid campaign's or a house ad's share of the loop — same "never bump paid" principle already established for house ads (`houseAdCap.ts`).
- The operator sees programmatic fill revenue in their existing Revenue view, same as any other paid content on their screen.
- Reuses the OpenOOH venue taxonomy mapping (G19, already shipped — `src/lib/openOohTaxonomy.js`) as the vocabulary AdGrid sends to a partner SSP describing a screen's venue category, since that mapping's own stated purpose was exactly this: "prerequisite for benchmarks-by-venue and any programmatic connection."

## Non-goals

- **No real-time bid-request/response OpenRTB endpoint in v1** (see scope decision above).
- **No specific SSP partner integration shipped in this spec.** This spec builds the generic adapter shape (a `programmatic_partners` config + a pluggable per-partner fetch function) and the AdGrid-side fill/priority/payout plumbing; wiring up a real Vistar/Broadsign Reach/Hivestack account requires an actual partner agreement (API credentials, commercial terms) that doesn't exist yet — out of scope for this spec, which stops at "the pipe is built and provably works against a mock/test partner."
- **No creative moderation pipeline for programmatic content.** Paid AdGrid campaigns and house ads both go through this platform's own approval/creative-spec validation before they can play; programmatic content arrives pre-approved by the SSP under that SSP's own brand-safety contract. AdGrid does not re-review it frame-by-frame. (A basic sanity check — the creative URL resolves, matches the screen's accepted format/resolution — is in scope; content moderation is the SSP's contractual responsibility, same as how any DOOH network handles programmatic demand today.)
- **No operator opt-out granularity beyond on/off.** v1 is a single per-screen toggle ("allow programmatic backfill on this screen: yes/no"), not per-category exclusions, floor-price negotiation UI, or per-partner selection. Those are plausible v2 refinements once there's real usage data.

## Data model changes

### New table: `programmatic_partners`

```sql
create table programmatic_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,                    -- e.g. "Vistar", "Broadsign Reach", "Hivestack"
  adapter_key text not null unique,       -- maps to a specific fetch-function implementation, e.g. 'vistar_v1'
  api_base_url text,
  enabled boolean not null default false, -- platform-level kill switch, not operator-facing
  created_at timestamptz not null default now()
);
```

Platform-admin-managed only (no advertiser/operator RLS needed beyond service-role); seeded manually per real partner agreement, not self-serve.

### New column: `screens.programmatic_backfill_enabled boolean not null default false`

The per-screen operator opt-in. Defaults off — unsold time keeps showing the idle slide/house ad until the operator explicitly turns this on, consistent with house ads' own opt-in shape (`house_ad_max_pct` only matters once an operator has created a house ad).

### New table: `programmatic_fills`

```sql
create table programmatic_fills (
  id uuid primary key default gen_random_uuid(),
  screen_id uuid not null references screens(id) on delete cascade,
  partner_id uuid not null references programmatic_partners(id),
  external_creative_id text,             -- the SSP's own id for this creative, for their reporting/reconciliation
  media_url text not null,
  media_type text not null check (media_type in ('image', 'video')),
  duration integer not null,
  cpm numeric not null,                  -- what the partner is paying, in AdGrid's platform currency
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,       -- a fetched fill is only valid for a bounded window (see Architecture)
  played boolean not null default false  -- set true on first display-feed serve, so a fill isn't reused past its intent
);

create index programmatic_fills_screen_idx on programmatic_fills (screen_id, expires_at) where played = false;
```

RLS: no client access at all (`FOR ALL TO service_role USING (true)`) — this table is populated by a scheduled edge function and read by `display-feed`, both service-role contexts; no advertiser or operator ever queries it directly (they see the resulting revenue via the existing Revenue view, not this table).

Both additive; no existing table's semantics change beyond the new `screens` column.

## Architecture

### 1. Scheduled fetch, not per-poll fetch

A new cron-triggered edge function `fetch-programmatic-fill` (following the existing `notification-cron`/`cronGuard.ts` pattern already in this codebase) runs on a fixed interval (e.g. every 5 minutes — frequent enough that fills stay fresh, far below `display-feed`'s per-poll cost budget). For each screen with `programmatic_backfill_enabled = true` that currently has no unexpired, unplayed `programmatic_fills` row:

1. Determine if the screen plausibly has unsold time (a cheap heuristic check against currently active `campaign_screens`/house-ad share is enough here — the *authoritative* "is there actually room" decision still happens in `display-feed` at serve time, per §2; this is just to avoid fetching fills for a screen that's fully booked).
2. For each enabled `programmatic_partners` row, call that partner's adapter function with the screen's inventory description: `{ venue_category: toOpenOohParent(screen.venue_category), city, country, resolution_w, resolution_h, accepted_formats, cpm_floor }`.
3. On a successful response (a creative + a CPM meeting or exceeding `screens.cpm_floor`), insert a `programmatic_fills` row with a short `expires_at` (e.g. 15 minutes — long enough to survive a few `display-feed` polls, short enough that a stale/no-longer-committed fill doesn't linger).
4. No response, or a CPM below floor: nothing inserted, that screen just doesn't get a programmatic fill this cycle — same "leaving the screen dark for the sake of an unused cap would defeat the feature's purpose" spirit as house ads' zero-paid-demand behavior, except here the fallback is "keep showing whatever already fills the loop" rather than going dark.

### 2. `display-feed` fill priority (extends the existing house-ad cap logic)

`display-feed/index.ts` already partitions a poll's loop into `paidEntries` and `cappedHouseEntries` (`capAdvertiserLoopShare` → `capHouseAds`). This adds a third, lowest-priority tier:

```
paid campaigns → house ads (up to house_ad_max_pct of remaining) → programmatic fill (fills whatever's still empty)
```

After `feedCampaigns` is assembled (paid + capped house), if `screen.programmatic_backfill_enabled` and there is still measurable unfilled loop time (the same duration-budget accounting `houseAdCap.ts` already does, extended one tier further), look up the screen's current unexpired, unplayed `programmatic_fills` row and append it as one more loop entry — shaped like any other feed entry (`media_url`, `media_type`, `duration`) so the display player needs no special-case code path to render it. Mark that `programmatic_fills` row `played = true` so the same fill isn't re-served indefinitely past its fetch cycle (the next `fetch-programmatic-fill` run replaces it).

Programmatic fill **never** reduces a paid or house-ad entry's share — same invariant `houseAdCap.ts` already enforces one tier up, just extended: this tier only ever claims time nothing else claimed.

### 3. Revenue / reporting

A played programmatic fill's proof-of-play flows through the existing `ingest-plays` → proof-of-play pipeline unchanged (it's a normal play event referencing a `programmatic_fills.id` instead of a `bookings.id` — the exact join shape depends on how deeply `ingest-plays` currently assumes a `bookings` row exists, to be confirmed at implementation time; if it assumes that, the simpler path is inserting a synthetic `bookings` row with a new `is_programmatic boolean` flag mirroring `is_house_ad`'s existing shape, rather than reworking the ingest pipeline). `Revenue.jsx` gains a "Programmatic" line item next to the existing house-ad opportunity-cost line, showing actual revenue earned (not foregone) from programmatic fill, using `programmatic_fills.cpm × play count` the same way paid revenue is already derived from a booking's rate.

### 4. Operator-facing control

A single toggle on `OperatorSettingsView.jsx` or per-screen on `ScreenDetail.jsx` (leaning `ScreenDetail.jsx`, since `house_ad_max_pct` already lives at the per-screen level there) — "Allow programmatic backfill on this screen" — writing `screens.programmatic_backfill_enabled`. Off by default.

## Data flow / state

- `fetch-programmatic-fill`: service-role scheduled function, writes only to `programmatic_fills`.
- `display-feed`: reads `programmatic_fills` (service-role, as it already reads everything else it serves) alongside its existing `bookings`/`campaign_screens` reads.
- Operator toggle: client-side update to `screens.programmatic_backfill_enabled` under existing operator-owns-their-screen RLS (`operator_id = auth.uid()`), no new policy needed.

## Error handling

- A partner adapter call that fails or times out: logged, no fill inserted, next cycle tries again. Never blocks or delays anything else in `fetch-programmatic-fill`'s per-screen loop (`Promise.allSettled` across screens/partners, same pattern `fire-integration` already uses across platforms).
- An expired `programmatic_fills` row still present at `display-feed` serve time: treated as absent (filter on `expires_at > now()`), not served stale.
- A fill whose `media_url` fails to resolve/load on the display player: outside this spec's edge-function boundary — same failure mode any other creative's broken media URL already has on the player today, not a new problem class introduced by this feature.

## Testing

- `fetch-programmatic-fill`: unit tests on the pure "does this screen plausibly have unsold time" heuristic and the "CPM meets floor" gate, using a mock adapter response — mirrors the existing `houseAdCap.test.js` style of testing the decision logic in isolation from the Deno/network parts.
- `display-feed`'s extended fill-priority logic: unit tests covering paid-only (no programmatic fill needed), paid+house+still-room (programmatic fills the remainder), paid+house+no-room (programmatic gets nothing, same as the existing house-ad-over-cap case), and `programmatic_backfill_enabled = false` (never fills regardless of room).
- `Revenue.jsx`: test asserting the programmatic revenue line item is computed from `programmatic_fills` play data using the stated CPM × plays formula.

Follows this repo's existing per-file `*.test.jsx`/`*.test.ts` convention alongside the files each test covers.

## Open questions for follow-up (not blocking this spec)

- Which SSP to integrate with first, and the commercial terms (revenue share AdGrid takes vs. passes to the operator) — a partnership/business decision, not an engineering one; this spec is buildable and testable against a mock adapter without that decision being made yet.
- Whether `fetch-programmatic-fill`'s 5-minute cycle is the right cadence once there's real partner latency/rate-limit data — a tuning question for after a real integration exists.
- True OpenRTB endpoint (AdGrid as bid-request acceptor) — explicitly deferred per the scope decision above; revisit only if a specific partner requires it over the supply-API shape.
