# Social Media — AdGrid

## Meta tags (already in place)
`index.html` has complete OG (`og:type`, `og:title`, `og:description`, `og:image`) and Twitter card tags pointing at `/marketing/hero-gym.jpg`. No gap here beyond the OG-image sizing note in `docs/marketing/image.md`.

## Channel priorities
- **LinkedIn** — B2B-leaning operator/property-manager audience, launch/press amplification (`public-relations.md`).
- **Instagram/TikTok** — real screen photos and short "screen goes live" clips; pairs with `content-strategy.md` case studies and `influencer-marketing.md` micro-creator partnerships.
- **Local Facebook groups** — treated as community, not broadcast (`community-marketing.md`), not a push channel.

## Content types
- Operator earnings milestones ("$X earned this month by [Business]") — organic, shareable, doubles as social proof for `cro-audit.md` finding #4 (no visible trust section yet).
- Screen map growth ("Now live in X neighborhoods across Toronto") — visual, ties to the existing `react-leaflet` map already in the product.
- FAQ-derived posts (e.g. "Is there a minimum ad spend? No.") — cheap content reusing `faqData.js` copy verbatim, keeps messaging consistent with the site.

## Rule
Every social post driving to the site carries a UTM tag per `attribution.md` (`utm_source={platform}&utm_medium=social`).
