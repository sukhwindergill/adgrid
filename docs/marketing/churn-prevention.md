# Churn Prevention — AdGrid Operators

Operator churn (screens delisted or going inactive) directly reduces marketplace inventory and advertiser experience, so it's the higher-leverage churn risk vs. advertiser churn.

## Leading indicators of operator churn
- Fill rate drops below a threshold for 2+ consecutive weeks (screen going dark or house-ads-only, see commit 5761cce1 house ads feature).
- No payout issued in 30 days.
- Operator dashboard not opened in 14 days.
- Support ticket about "no bookings" / "screen not showing ads."

## Interventions
| Signal | Action |
|---|---|
| Low fill rate | Auto-suggest a price drop or house-ad category expansion; email with fill-rate benchmark vs. similar screens. |
| No payout in 30 days | Proactive check-in email + surface fill rate stat prominently on dashboard. |
| Dashboard inactivity | Weekly digest email: "Your screen earned $X this week" (works even at $0 — reinforces the product is working). |
| Cancellation flow | Add a reason-for-leaving step before removal is finalized, route "low earnings" reasons to pricing/fill-rate team. |

## Metric to own
Operator 90-day retention rate, segmented by city and vertical (gym/cafe/retail/condo) — churn drivers likely differ by vertical.
