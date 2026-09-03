# Free Tools — AdGrid

## Tool idea 1: Screen Earnings Calculator
Input: venue type, foot traffic estimate, city → output: estimated monthly earnings range from listing a screen on AdGrid. Directly supports `docs/marketing/ab-testing.md` backlog item #1 (live earnings estimate on the listing form) and doubles as a standalone lead-gen tool/landing page.

## Tool idea 2: DOOH Ad Cost Estimator (advertiser side)
Input: city, number of screens, campaign length → output: estimated cost and reach, positioned against the "just boost a Facebook post" comparison in `docs/marketing/competitors.md`.

## Tool idea 3: Fill-Rate Benchmark
Public, anonymized "average fill rate by venue type" page — attracts operator-side search traffic ("how much can I earn from a screen in my [gym/cafe]") and builds trust via transparency.

## Implementation note
None of these exist in the codebase yet (`src/views` has no calculator/tool route). Recommend building tool idea 1 first — it reuses the same estimate logic that would power the ab-testing backlog item, so the engineering cost is shared between the marketing tool and the product improvement.
