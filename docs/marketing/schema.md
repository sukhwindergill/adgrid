# Structured Data (Schema.org) — AdGrid

## Added
- `index.html`: `Organization` JSON-LD (name, url, logo, description, areaServed: Canada) and `Service` JSON-LD (serviceType: OOH advertising marketplace, audience: operators + advertisers, offers: self-serve/no-minimum booking).
- `src/views/marketing/sections/Faq.jsx`: `FAQPage` JSON-LD, generated directly from the existing `FAQS` array in `faqData.js` so it can never drift out of sync with the visible FAQ content — qualifies the FAQ section for Google's FAQ rich result.

## Not added (would require real data, avoided fabricating)
- `AggregateRating`/`Review` — no real reviews exist yet; do not add fabricated ratings.
- `LocalBusiness` per city — better suited to the programmatic city pages proposed in `docs/marketing/programmatic-seo.md` once those exist, one `LocalBusiness`/`Place` per screen or city page rather than on the homepage.

## Validation
Recommend running both pages through Google's Rich Results Test after deploy to confirm the JSON-LD parses correctly in the built output (Vite/React renders it client-side; verify with SSR/prerender or a rendered snapshot if search engines need static HTML).
