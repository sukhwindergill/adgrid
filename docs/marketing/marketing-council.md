# Marketing Council Review — AdGrid Marketing Skills Pass

Cross-functional review of the marketing artifacts produced in this pass (`docs/marketing/*.md`), simulating a marketing-council sanity check.

## Coherence check
- **Positioning is consistent** across ad-creative, ads, copywriting, and competitors docs: self-serve, no minimums, two-sided, Canadian, real-time pricing. No conflicting claims found.
- **Attribution taxonomy** (`docs/marketing/attribution.md`) is referenced consistently by ads, cold-email, directory-submissions, emails, events, influencer-marketing docs — good, avoids fragmented tracking.
- **Sequencing risk flagged**: launch-plan correctly gates advertiser-side paid acquisition behind operator-side liquidity per city; ads.md's budget guardrail reinforces the same constraint. Consistent.

## Gaps this pass surfaces
- No blog/content route exists yet (`content-strategy.md`) — several other docs (lead-magnets, free-tools) assume future pages that don't exist in `src/views` yet. Flag as a dependency for engineering, not something to fabricate now.
- Pricing/paywall model needs clarifying (see `docs/marketing/pricing.md`, `docs/marketing/paywalls.md`) before offers/lead-magnet copy can commit to specific numbers.

## Recommendation
Treat `docs/marketing/` as a living plan directory — the individual docs are intentionally cross-referenced rather than siloed so a future review can walk the graph from `marketing-plan.md` outward.
