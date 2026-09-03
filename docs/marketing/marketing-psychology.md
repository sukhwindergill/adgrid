# Marketing Psychology — Applied to AdGrid

## Principles in use / to apply

**Loss aversion (operator side)**: framing idle screen time as money already being lost ("your screen is earning $0 right now") is stronger than framing it as a new opportunity. Consider testing this frame in `ad-creative.md` headlines.

**Social proof**: live screen count in `Hero.jsx` is a proof signal but only renders when count ≥ 1 (see `cro-audit.md` finding #3) — social proof only works when visible; the conditional hide is correct defensively but leaves a gap pre-liquidity.

**Effort justification / IKEA effect**: letting operators set their own price (already true per copy — "you set the price") increases commitment vs. a fixed platform rate. Reinforce this agency explicitly in onboarding copy (`onboarding.md`).

**Reciprocity**: free-to-list with no upfront cost primes operators to reciprocate with lower price resistance later and higher tolerance for AdGrid's take rate — consistent with "free to list" messaging already used.

**Anchoring**: "no minimums" and transparent per-slot pricing (`faqData.js`) anchor advertisers against opaque traditional-OOH negotiated pricing — already AdGrid's core wedge, keep reinforcing the anchor early in every funnel step, not just FAQ.

**Commitment/consistency**: the referral loop (`referrals.md`) works best right after a positive moment (first payout) — asking at the point of proven value, not at signup, respects this principle.

## Caution
Avoid manufactured urgency/scarcity ("only 2 spots left") on a real marketplace — false scarcity is detectable and would damage trust for a product whose core pitch is transparency.
