# Campaign Hierarchy — Campaign / Targeting / Creative — Design

**Date:** 2026-07-31
**Status:** Approved for planning
**Relates to:** [2026-07-24-competitive-parity-program.md](2026-07-24-competitive-parity-program.md) Phase 4.4 ("Variant testing," G15) — this design supersedes that item's scope (see §9). Builds on the shipped [2026-06-05-campaign-targeting-funnel-design.md](2026-06-05-campaign-targeting-funnel-design.md) and [2026-07-26-creative-spec-validation-design.md](2026-07-26-creative-spec-validation-design.md) without changing either's underlying mechanics.

## Problem

Today's "campaign" (the `bookings` table — see naming note in §1) is completely flat: one row is simultaneously the targeting rule, the budget, the schedule, *and* the single creative. There is no way to group multiple targeting definitions under one objective, no way to run more than one creative against a targeting group's screens, and screen-picking (`StepScreens`) is a separate step from creative authoring (`StepCreative`) even though advertisers naturally think of them together ("which ads go on which screens"). No Ad-Set-like or Ad-like layer exists anywhere in the schema, the code, or any prior design doc. The nearest prior plan — `campaign_creatives` under roadmap item G15 ("variant testing") — was scoped narrowly for weighted rotation/reporting and was never built.

Separately, AdGrid's investor positioning explicitly sells self-serve simplicity ("pick an area, pick screens, set a budget, pay by card — live in a day") against sales-assisted enterprise DOOH platforms. Any restructure has to add power without adding friction to that default path.

## Goal

Introduce a real three-tier structure:

**Campaign** (new parent/umbrella) → **Targeting** (today's `bookings` row, in place, unchanged shape) → **Creative** (one or more named, screen-assignable creative assets)

modeled on Meta Ads Manager's Campaign/Ad Set/Ad pattern, adapted to what AdGrid actually is: targeting selects physical screen *inventory* (not a social audience), so the middle tier is plain "Targeting," not "Ad Set" — it's just AdGrid's existing area/radius/venue filtering, unchanged.

Two experiences must both hold:
- **Simple case (default):** one targeting group, one creative, wizard behaves exactly as it does today. Zero new concepts surfaced.
- **Power case (opt-in):** a campaign can hold multiple Targeting groups (e.g. "Downtown Malls" + "Westside Gyms," each its own budget/schedule/screens), and any Targeting group can hold multiple Creatives, manually assigned — and optionally overlapping with a manual weight — across specific screens from its pool. Fully advertiser-controlled; nothing is auto-optimized.

## Non-goals (explicit)

- **Pooled/shared budget across Targeting groups under one Campaign.** Considered and dropped — real-time pacing across siblings (Meta's CBO) is genuinely complex and nothing today needs it.
- **Automatic A/B winner-selection, adaptive/bandit rotation, or auto-promoting a "winning" creative.** Weights are advertiser-set and static forever unless the advertiser changes them. AdGrid surfaces per-creative results; the advertiser decides what to do with them.
- **Migrating the legacy per-screen override columns** on `campaign_screens` (`headline`/`cta_text`/`accent_color`/`destination_url`/`media_*`). They stay for backward compatibility with already-submitted campaigns; the new wizard simply stops writing to them.
- **Renaming the `bookings` table.** Real naming debt (see §1), but a separate, isolated, mechanical rename PR — bundling it here adds file-touch risk across the whole codebase for zero user-facing benefit.
- **Strict real-time enforcement of a budget split** (whether Targeting-vs-Targeting or Creative-vs-Creative). v1 tracks and reports actual spend per unit; it doesn't throttle serving mid-flight to hit an exact allocation.
- **Phase 5 roadmap items** (forecast, dayparting, saved targets, audience-index targeting, guardrails) — unaffected, unrelated to this work.

## Design

### 1. Data model

Naming note: a legacy `campaigns` table existed pre-pivot, had zero rows and zero code references, and was dropped in `20260703000003_drop_legacy_schema.sql`. The `campaigns` table introduced below is unrelated and differently-shaped — flagging this so a future reader of the migration history isn't confused by the reused name. The live "campaign" entity today is actually the `bookings` table (a naming artifact from the same earlier pivot that was never cleaned up); this design does not rename it (see Non-goals) — `bookings` continues to be the Targeting tier's storage.

```sql
-- New parent tier
CREATE TABLE campaigns (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  advertiser_id uuid NOT NULL REFERENCES profiles(id),
  name          text NOT NULL,
  created_at    timestamptz DEFAULT now()
);

-- Targeting tier: bookings gains a parent FK, nothing else changes
ALTER TABLE bookings ADD COLUMN campaign_id uuid REFERENCES campaigns(id);
ALTER TABLE bookings ADD COLUMN budget_level text
  CHECK (budget_level IN ('unified', 'per_creative')) DEFAULT 'unified';
  -- 'unified' (default): today's exact behavior, one budget number for the whole targeting group.
  -- 'per_creative': this targeting group's budget is tracked per campaign_creatives.budget instead.

-- Creative tier
CREATE TABLE campaign_creatives (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  targeting_id  uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  label         text NOT NULL DEFAULT 'Creative 1',
  media_url     text,
  media_type    text,
  headline      text,
  cta_text      text,
  destination_url text,
  accent_color  text,
  budget        numeric,   -- only read when the parent bookings.budget_level = 'per_creative'
  status        text NOT NULL DEFAULT 'active',
  created_at    timestamptz DEFAULT now()
);

-- Which screens (from the targeting group's pool) each creative plays on, and at what relative share
CREATE TABLE campaign_creative_screens (
  creative_id   uuid NOT NULL REFERENCES campaign_creatives(id) ON DELETE CASCADE,
  screen_id     uuid NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
  weight        int NOT NULL DEFAULT 100,  -- advertiser-set share of plays; never auto-adjusted
  PRIMARY KEY (creative_id, screen_id)
);

-- Attribution, for reporting only
ALTER TABLE ad_plays ADD COLUMN creative_id uuid REFERENCES campaign_creatives(id);
ALTER TABLE scans ADD COLUMN creative_id uuid REFERENCES campaign_creatives(id);
```

**Migration/backfill:** every existing `bookings` row gets one auto-created `campaigns` row (name copied from `bookings.campaign_name`), `campaign_id` set. Zero rows are created in `campaign_creatives`/`campaign_creative_screens` for existing campaigns — their single creative continues to live directly on `bookings` exactly as today, read as the fallback whenever a screen has no matching row in the new tables (see §5). Nothing about existing billing, approval, or reporting queries changes as a result of this migration alone.

### 2. Wizard — three steps, down from five

Full rewrite of `src/views/advertiser/CreateCampaign.jsx` (already precedented — the original 2026-06-05 design was also a full rewrite of this file). While rewriting, delete the two already-dead components confirmed by exploration (`StepFilters` at lines 298-333, `StepLaunch` at 813-841) — both were already orphaned by earlier iteration and never wired into the render switch.

1. **Targeting.** Campaign name (first time only — hidden on subsequent "+ Add targeting group" runs, see §7), area/radius/city picker (unchanged: `StepArea`'s Mapbox geocoding + Leaflet radius map), venue/environment filters (unchanged). Produces a candidate screen pool. No individual screen checkboxes here.
2. **Creative.** Shows the candidate pool. One creative by default, auto-assigned to every pool screen — identical to today's behavior, no new UI visible. A "+ Add another creative" action reveals: a per-creative card (upload/headline/CTA/destination URL/accent color — same fields as today, reusing `MediaUpload`), and a screen-assignment control for splitting the pool across creatives. A "split by screen type" convenience auto-proposes a landscape/portrait split (reusing the orientation derivation already in `creativeFit.js`) as a starting point the advertiser can hand-adjust. Existing `CreativeFitPanel` and `ReadabilityPanel` run per creative, scoped to whichever screens it's currently assigned to.
3. **Budget & Schedule.** Today's budget/schedule fields, plus a folded-in summary of the Targeting and Creative choices above, ending in the Submit button — no separate Review page. (Post-submit Stripe pay screen is unchanged.)

### 3. Screen assignment and weighting mechanics

- Default (1 creative): no `campaign_creative_screens` rows are written at all; every screen falls through to the fallback (§5). This keeps the simple path's data footprint identical to today.
- Adding a 2nd+ creative writes explicit `campaign_creative_screens` rows for whichever screens the advertiser assigns to it.
- Two creatives can be assigned to the *same* screen (the "50/50" case) — `weight` controls the relative share of plays; `display-feed` picks weighted-random per play (§5). Weights are never adjusted by anything other than the advertiser.
- If a screen drops out of the Targeting pool (advertiser deselects it, or a filter change removes it), any `campaign_creative_screens` rows for that screen are deleted at the same time — orphaned assignments are not left behind.
- A pool screen that isn't explicitly assigned to *any* creative (e.g. 5 of 20 screens left untouched after splitting the other 15 across two creatives) has zero `campaign_creative_screens` rows for itself specifically, so it falls through to the same per-screen fallback described in §5 — it plays the targeting group's own default creative, never a blank slot.

### 4. Approval queue

Approval stays per-screen, exactly as today (one `campaign_screens.status` decision per screen) — it does **not** become a per-creative-per-screen matrix. What changes: **assigning a new or different creative to an already-approved screen resets that screen's `campaign_screens.status` back to `pending`.** The operator's next review shows whatever creative mix is currently assigned to their screen as of that moment — they're always approving the live state, never a stale one. This mirrors the existing SLA/auto-drop precedent (`review_due_at`) rather than inventing a new approval primitive.

Cross-cutting: the mobile app has its own approvals surface (`mobile/components/approvals`) — it needs the same reset-on-reassignment awareness; called out here so it isn't missed during planning, not a new decision.

### 5. Serving (`display-feed`)

At play time, for a given `(campaign, screen)`: look up `campaign_creative_screens` rows for that screen. If one or more exist, pick weighted-random among them (pure function, unit-testable in isolation from the edge function itself). If none exist — every campaign today, and the common case going forward — fall back to `bookings`'s own creative fields exactly as today. This is the one part of the design that touches the live production serving path; it should ship and be tested as its own isolated unit before the wizard changes that produce multi-creative data land on top of it.

### 6. Reporting

`CampaignDetail` gains a per-creative breakdown (scan rate, cost-per-scan, attention) wherever a targeting group has more than one creative, reusing existing `Table`/`KPI` primitives — no new visualization system. Purely descriptive, matching the Non-goals: AdGrid shows the numbers, the advertiser decides whether to stop using a creative.

### 7. Dashboard and "+ Add targeting group"

Campaign list becomes accordion-style: each Campaign row expands inline to show its Targeting group(s) (budget, screens, status per group). A campaign with exactly one Targeting group renders as a single collapsed row — identical information density to today's list. "+ Add targeting group" lives on the Campaign detail page (post-creation only) and re-runs the same Targeting → Creative → Budget wizard scoped under the existing campaign; it is not offered during initial creation, keeping the first-time flow exactly as simple as it is today.

### 8. RLS

Every existing campaign-adjacent table got its own dedicated RLS migration (`campaign_screens`, service-role-only `approval_tokens`). The three new tables need the same explicit treatment as named deliverables in the implementation plan, not folded silently into the schema migration: `campaigns` (advertiser reads/writes own), `campaign_creatives` and `campaign_creative_screens` (advertiser via their targeting group's ownership chain; operator read access via their screens, matching how they already read `campaign_screens`).

### 9. Relationship to roadmap G15 ("variant testing")

This design effectively delivers G15's foundational table early, with a different scope boundary than originally sketched. It ships: the table, explicit manual assignment, manual weighting, and basic per-creative reporting. It deliberately does **not** ship: weighted-random rotation as a true statistical A/B test, or auto-promoting a winner — those remain a distinct, harder future problem if ever wanted. The roadmap doc's G15 entry should be marked superseded by this spec once this ships.

### 10. New pure modules (testing convention)

Matching this codebase's established pattern (`creativeFit.js`, `reach.js`, `periodDelta.js` are all pure, unit-tested, and separate from the components that call them):

- `src/lib/creativeSelection.js` — weighted-random pick among a screen's assigned creatives; pure, seedable for tests.
- Extend `src/lib/creativeFit.js`'s existing orientation derivation for the "split by screen type" wizard helper, rather than duplicating it.
- `src/lib/campaignRollup.js` — aggregates a campaign's Targeting groups into the dashboard's summary numbers (total budget, total screens, status).

## Testing approach

- Unit tests for all three new pure modules above (mirrors `creativeFit.test.js` / `reach.test.js` conventions).
- Component tests for the new Creative-step screen-assignment UI and the accordion dashboard rows.
- Manual verification: full wizard run for both the simple (1 creative) and power (2+ creatives, overlapping weights) cases; approval-queue reset-to-pending on reassignment; `display-feed` fallback behavior when no `campaign_creative_screens` rows exist, confirmed against a live-looking screen.

## Open questions

None — resolved during brainstorming. Key decisions, for reference: campaign-level pooled budget considered and dropped in favor of `bookings.budget_level` scoped to a single targeting group; screen-to-creative assignment is fully manual with static advertiser-set weights, no auto-optimization; reassigning a creative on an already-approved screen resets that screen to pending; `bookings` table rename deferred as separate, isolated work; wizard step count drops from five to three.
