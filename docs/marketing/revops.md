# RevOps — AdGrid

## Revenue model
Take-rate marketplace: AdGrid takes a cut of advertiser spend on each booking; operators list free. Revenue = sum(campaign bookings) × take rate, gated by marketplace liquidity (screens × fill rate).

## Metrics to unify across marketing/sales/product
- **GMV (gross booking value)** per city, per week.
- **Take-rate revenue** derived from GMV.
- **Fill rate** per screen/city (ties to `analytics.md`, `churn-prevention.md`) — the single biggest lever on GMV since it's supply-constrained, not demand-constrained, early on.
- **CAC by side** (operator CAC vs. advertiser CAC) — should be tracked and reported separately, never blended, since the two acquisition motions and payback periods differ completely (`attribution.md`).

## Process recommendation
Weekly revenue/liquidity review combining: new operators live, new advertiser campaigns, fill rate trend, GMV, CAC by side — single source of truth doc/dashboard so marketing spend decisions (`ads.md` budget guardrail) are made against the same numbers sales/product see.

## Ownership
Recommend a single shared metrics definition doc (this file) that `analytics.md` event names map into directly, to avoid marketing and product tracking "conversion" or "signup" differently.
