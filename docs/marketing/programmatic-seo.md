# Programmatic SEO — AdGrid

## Opportunity
No city or venue-type landing pages exist yet (`src/App.jsx` routes: `/`, `/login`, `/privacy`, `/terms`, `/thank-you`, `/display/:token`, `/report/:token`, invite routes, `/app/*` — no `/screens/:city` or similar). This is the single highest-leverage SEO gap given AdGrid's inherently local, multi-city model.

## Recommended template
`/screens/[city]` — e.g. `/screens/toronto`, `/screens/vancouver` — each page:
- Live screen count and map for that city (reuses the existing `react-leaflet` map component already in the marketing home).
- "Advertise on screens in [City]" H1, city-specific FAQ variant of `faqData.js`.
- Venue-type breakdown (gym, cafe, retail, condo, etc. — 8 categories per `Hero.jsx` stats).
- Internal links to/from `/` and future `content-strategy.md` blog posts.

## Second template
`/screens/[city]/[venue-type]` (e.g. `/screens/toronto/gyms`) once city pages have enough unique data to avoid thin-content duplication — do not launch this tier until the top-level city pages have real, differentiated data per city.

## Data requirement
Needs a live query against the `screens` table (already used in `Hero.jsx` for the live count) filtered by city/venue type — feasible with existing Supabase schema, no new backend work required, only new routes/components.

## Status
Scoped but not implemented in this pass — implementing `/screens/[city]` routing and components is a product engineering task, not a content/copy change; flagging here as the top SEO priority for a follow-up engineering ticket.
