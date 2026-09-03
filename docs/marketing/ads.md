# Paid Ads Plan — AdGrid

## Channels
| Channel | Audience | Goal |
|---|---|---|
| Google Search | "advertise on screens near me", "digital signage advertising [city]", "list my screen for ads" | High-intent signups, both sides |
| Meta/Instagram | Local business owners (advertiser side), independent retail/gym/cafe owners (operator side) | Awareness + signup |
| LinkedIn | Property managers, multi-location retail ops (operator side, B2B) | Operator lead gen |

## Search campaign structure
- **Campaign: Operator Acquisition** — ad groups per vertical (gyms, cafes, laundromats, condos, retail). Landing page: operator signup with earnings calculator.
- **Campaign: Advertiser Acquisition** — ad groups per city (matches `programmatic-seo` city pages). Landing page: `/screens/[city]` with live map.
- **Negative keywords**: "billboard printing", "digital signage software" (AdGrid is a marketplace, not a hardware/software vendor) — exclude to protect budget.

## Budget guardrail
Because AdGrid is two-sided, marketplace liquidity matters more than raw volume — cap advertiser-side spend per city to roughly match live operator screen count in that city, so new advertisers always land on a market with real inventory.

## Tracking
UTM convention: `utm_source={channel}&utm_medium=cpc&utm_campaign={operator|advertiser}-{city}&utm_content={creative_id}`. Feed into the attribution model in `docs/marketing/attribution.md`.
