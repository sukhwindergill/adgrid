# Product Marketing Context — AdGrid

_Reference context for marketing skills/agents working on this repo. Read this before asking basic product questions._

## What AdGrid is
A self-serve, two-sided marketplace connecting Canadian digital screen operators (gyms, cafes, retail, condos) with local advertisers, for out-of-home (OOH/DOOH) advertising.

## Sides of the marketplace
- **Operators**: list an existing (or plannable) digital screen, set/influence pricing, earn from unsold airtime being booked by local advertisers; unsold time can auto-fill with free house ads (see commit 5761cce1) rather than going dark.
- **Advertisers**: local businesses who book ad time on nearby screens, self-serve, no agency required.

## Positioning
- Self-serve, no minimums, no long-term contracts, real-time transparent pricing.
- Wedge vs. traditional OOH: no agency/rep, no high minimum spend, instant launch.
- Wedge vs. social ads (Meta/Google local): physical, always-on, local presence — plus the operator side earns revenue, which social ads don't offer anyone.

## Current stage
Two launch cities: Toronto and Vancouver. 8 venue categories. Pre-scale — supply-side (operator) liquidity is the binding constraint; demand-side growth should be paced to match it per city (see `docs/marketing/launch-plan.md`).

## Key surfaces in the codebase
- Marketing site: `src/views/marketing/` (Home, Hero, HowItWorks, OperatorsSection, AdvertisersSection, faqData).
- Operator onboarding: `src/views/operator/ScreenOnboard.jsx`.
- Advertiser campaign creation: `src/views/advertiser/createCampaign/`.
- Screen map: `react-leaflet` powered, referenced from Home/marketing sections.

## Where the rest of the marketing plan lives
`docs/marketing/marketing-plan.md` is the master index into positioning, acquisition, conversion, retention, content, pricing, measurement, launch, sales, and research docs.
