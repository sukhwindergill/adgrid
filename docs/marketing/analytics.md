# Analytics & Measurement Plan — AdGrid

## Funnels to instrument
1. **Operator**: landing → signup → screen listed → screen approved/live → first booking received → first payout.
2. **Advertiser**: landing → signup → screen browsed/map interaction → campaign created → creative uploaded → checkout → campaign live.

## Core events (suggested naming — snake_case, product-analytics style)
`operator_signup_started`, `operator_signup_completed`, `screen_listing_created`, `screen_listing_published`, `advertiser_signup_completed`, `screen_viewed`, `campaign_created`, `creative_uploaded`, `checkout_started`, `checkout_completed`, `payout_issued`.

## Dashboards
- **Marketplace liquidity**: screens live per city vs. active advertisers per city (ties to `ads.md` budget guardrail).
- **Funnel conversion**: per-step drop-off for both sides, split by acquisition channel (UTM from `docs/marketing/attribution.md`).
- **Fill rate**: % of screen airtime sold vs. filled by house ads vs. dark (see `src/` house-ads logic, commit 5761cce1).

## Guardrail metrics
Refund rate, support ticket volume, operator churn (see `docs/marketing/churn-prevention.md`) — track alongside any growth experiment so wins aren't false positives.
