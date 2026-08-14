# Screen-Level Holdout / Lift Testing — Design

**Status:** Approved, ready for implementation planning.
**Gap addressed:** G10 in `docs/research/2026-07-24-ad-platform-gap-analysis.md` ("No incrementality / holdout — P1"), ranked shortlist item 12.

## Goal

Let an advertiser answer "did the billboard do anything?" with a number and a confidence interval, not a guess. An advertiser running a campaign of 10+ matched screens can opt into a holdout test: ~20% of screens are randomly withheld from serving the creative (control group), and the campaign's scan rate on exposed screens is compared against the control group's scan rate, with a statistical significance check.

This is the single feature a $200 self-serve advertiser can get here that they cannot get from a traditional OOH buy — the CV/geo data AdGrid already collects makes it possible.

## Non-goals (v1)

- CV foot-traffic/dwell-based lift (comparing venue visitation, not just scans). Deferred — noisier, needs a baseline traffic window this data model doesn't cleanly support yet. Scan rate is the only outcome metric directly attributable per-campaign today.
- Advertiser hand-picking which screens are control. Random assignment only — advertiser choice reintroduces selection bias and defeats the point of a control group.
- Converting an already-running (non-holdout) campaign into a holdout test after the fact. Only available at creation time, avoids messy mid-flight statistics.
- Any UI for adjusting the holdout percentage. Fixed at ~20%, matching the gap-analysis doc's own recommendation.

## Outcome metric

**Scan rate** (billable_scans / impressions), the same metric `campaign_delivery_daily` and `benchmark_stats` already use. No new data collection required.

## Screen floor

Holdout toggle is only offered when a campaign has **≥10 matched screens** at the targeting step. Below that, a holdout group of 1-2 screens is too small to produce a meaningful confidence interval — the toggle is hidden with a tooltip explaining why, rather than offered and producing an uninformative result. This mirrors the same reasoning `benchmark_stats`' k-anonymity floor uses (see `docs/superpowers/plans/2026-07-25-phase3a-network-benchmarks.md`).

## Setup UX

A checkbox/toggle at the `CreateCampaign` wizard's targeting step: *"Run a holdout test (recommended for 10+ screens) — we'll randomly hold back ~20% of screens as a control group to measure whether this campaign actually drives scans."* Visible only once matched screens clear the floor.

If enabled, on submit:
- `bookings.holdout_enabled = true` is set on the campaign.
- Of the inserted `campaign_screens` rows, ~20% are randomly flagged `is_control = true`. Selection is server-side (not advertiser-influenced) to avoid bias.

If the advertiser later adds screens to an existing holdout campaign via "+ Add targeting group," the newly added screens are also randomly split at the same ~20% ratio, keeping the overall control proportion roughly stable over the campaign's life.

## Billing impact

**Control screens are not billed.** They receive a `campaign_screens` row (so they appear in the campaign's screen list, approval queue, etc. like any other targeted screen) but are excluded from `charge-campaign`'s billed screen count and budget calculation. The advertiser's budget effectively buys the exposed 80% of matched screens. This is the correct incentive to run the test — paying full price for 20% non-delivery would be a hard sell — and matches how real ad-lift studies are typically priced (the control group is a cost of measurement, not something the client pays media rate for).

## Serving

`display-feed` excludes any screen whose `campaign_screens` row for a campaign has `is_control = true` — that screen simply never receives this campaign's creative in its feed. It continues to serve other campaigns/idle content normally. Nothing about the screen's operation changes; only this one campaign's eligibility to play there.

## Measurement

A `lift_stats` computation (view or query, TBD in planning) aggregates `campaign_delivery_daily`'s billable_scans/impressions per campaign, split by `is_control`, giving:
- exposed scan rate, control scan rate
- lift % (exposed vs. control)
- 95% confidence interval via a two-proportion z-test (standard method, no new dependency, same "fail to unavailable rather than to a misleading number" discipline as `src/lib/benchmark.js`)

A minimum play-day threshold on both groups (exact value TBD in planning — likely mirroring `benchmark.js`'s `MIN_CAMPAIGNS`-style constant, but for observation count rather than campaign count) gates when a result is shown vs. "still collecting data."

## UI

**`LiftTestPanel`** (new shared component, same honest-empty-state discipline as `BenchmarkRow`):
- Not enough data yet → "Still collecting data for this lift test."
- Enough data, no significant difference → "No significant difference detected between exposed and control screens yet."
- Enough data, significant lift → "Statistically significant lift: scan rate X% higher on exposed screens (95% CI: [a, b])."
- Renders nothing at all if the campaign never opted into a holdout test.

Surfaced in two places:
- **`CampaignDetail.jsx`** — new "Lift Test" tab, advertiser-only, alongside Overview/Creative/etc.
- **`CampaignReport.jsx`** (public, shareable report) — same panel, so an advertiser can show a client/boss the result directly without needing an AdGrid login. Must handle the "not enough data" and "no holdout test run" states publicly too, same as the private version.

## Edge cases

- <10 matched screens at creation time → toggle hidden.
- Zero scans in either group → z-test denominator protected against divide-by-zero; falls back to "still collecting data," never NaN/Infinity.
- Campaign cancelled or paused early → panel still computes on whatever data exists, but labels the result "partial flight — interpret with caution" once the campaign has less than its full scheduled duration of delivery.
- Screens added mid-flight via "+ Add targeting group" → split at the same ratio as initial assignment (see Setup UX above).

## Testing

- **`src/lib/liftTest.js`** — pure function unit tests: known-value assertions for the z-test/CI math (mirroring `benchmark.test.js`'s style), edge cases (zero counts, tiny samples, both groups identical, one group empty).
- **`LiftTestPanel.test.jsx`** — component tests for each render state (no test run, insufficient data, no significant difference, significant lift), following `BenchmarkRow.test.jsx`'s pattern.
- **Migration-level verification** (manual, against production, same discipline as the benchmarks migration): control screens are never billed (spot-check `charge-campaign`'s computed amount excludes them), never served (spot-check `display-feed`'s response for a control screen), and the split ratio lands close to 80/20 on a reasonably sized screen set (not exactly 20% on small N, but not wildly off either).

## Open questions for the implementation plan

These are left to `writing-plans` to resolve with the same "verify against production first" discipline the benchmarks plan used:
- Exact minimum play-day/observation threshold before showing a result (not yet chosen — needs a statistical-power sanity check against realistic AdGrid traffic volumes, not benchmarks' campaign-count floor, since this is per-campaign not per-network).
- Whether `lift_stats` is a materialized view (like `benchmark_stats`) or a plain view/query computed at request time — depends on whether per-campaign query volume justifies precomputation. Given expected low request volume for this feature at launch, a plain view is likely sufficient; revisit if it becomes a hot path.
- Exact randomization mechanism for the 80/20 split (e.g. `random() < 0.2` at insert time vs. a seeded/deterministic assignment) — needs to be reproducible enough to reason about and audit, but does not need to be cryptographically secure.
