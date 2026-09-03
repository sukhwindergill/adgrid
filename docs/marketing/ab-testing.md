# A/B Testing Backlog — AdGrid

Experiment backlog for the two-sided marketplace funnel (screen operators listing screens, advertisers buying airtime). Score with ICE = (Impact + Confidence + Ease) / 3; run highest first.

## Active Backlog

| # | Hypothesis | Primary Metric | Guardrail | ICE |
|---|---|---|---|---|
| 1 | Because operators hesitate at "how much can I earn," showing a live earnings estimate on the screen-listing form will increase completed listings by 15%+. | Listing completion rate | Time-to-list, listing quality/completeness | 8 |
| 2 | Because advertiser signup drops at payment, adding "no minimum spend" copy next to the CTA will increase checkout starts. | Checkout start rate | Refund rate | 7 |
| 3 | Because house-ad fallback screens go dark on unsold inventory, operators may undervalue AdGrid — surfacing "fill rate" on the operator dashboard will increase retention. | 30-day operator retention | Support tickets | 6 |
| 4 | Real-time pricing display (vs. static rate card) on screen detail pages increases advertiser booking rate. | Booking conversion rate | Avg. booking value | 7 |

## Test Documentation Template

```
## [Experiment Name]
Date:
Hypothesis:
Sample size:
Result: winner/loser/inconclusive — [metric] changed by [X%] (95% CI, p=)
Guardrails:
Segment deltas (operator size, city, device):
Why it worked/failed:
Pattern:
Apply to:
Status:
```

## Notes

- AdGrid is a two-sided marketplace — every test should specify which side (operator or advertiser) it targets, since traffic volumes and baseline conversion differ significantly between the two flows.
- Sample sizes on the operator side will be small (fewer operators than advertisers); prefer qualitative + segment analysis over strict significance thresholds there, and reserve formal A/B tests for the higher-traffic advertiser funnel (signup, booking, checkout).
