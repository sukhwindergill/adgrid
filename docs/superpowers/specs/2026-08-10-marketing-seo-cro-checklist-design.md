# Marketing site SEO/CRO checklist

**Date:** 2026-08-10
**Status:** Approved

## Purpose

User supplied a generic SEO/CRO checklist (20 items) to apply to the AdGrid marketing site "where applicable." AdGrid is a pre-launch, Canada-wide two-sided marketplace (waitlist-only, live in no city yet, no paying customers) — several checklist items assume a single-location local business with existing customers and don't fit as-is. This spec covers what's being built, what's already satisfied, and what's explicitly skipped and why.

## Audit results

**Already satisfied — no work:**
- FAQ: [Faq.jsx](../../../src/views/marketing/sections/Faq.jsx) has 8 Q&As (checklist asked for 5).
- Privacy policy page: [PrivacyPolicy.jsx](../../../src/views/legal/PrivacyPolicy.jsx), route `/privacy`.
- Alt text on images: every `<img>` in `src/views/marketing/sections/` already has descriptive `alt`.
- Above-fold CTA: [Hero.jsx](../../../src/views/marketing/sections/Hero.jsx) has two primary CTAs in the first viewport.
- Internal links: [Footer.jsx](../../../src/views/marketing/sections/Footer.jsx) links to `/privacy`, `/terms`, and in-page anchors.

**Explicitly skipped (user decision, 2026-08-10 brainstorm):**
- Real customer reviews — no customers yet; fabricating testimonials is not acceptable.
- Case study section — no real customer/campaign data exists yet.
- Real team photo — no photo asset available; won't use a generated stand-in presented as real.
- Maps + directions — no single storefront; marketplace has no one address to show.
- Local business schema — `LocalBusiness` JSON-LD doesn't model a marketplace; user chose to skip schema markup entirely rather than substitute `Organization` schema.
- Google Analytics — no GA4 Measurement ID available; user chose to skip rather than scaffold a placeholder env var.

**Built (this spec):**
1. Unique page titles
2. Meta descriptions
3. Social share images (per-page)
4. Custom 404 page
5. Thank-you page after inquiry
6. Breadcrumbs
7. Sticky mobile call to action
8. Robots.txt
9. Response time promise
10. Internal links (legal-page cross-links, additive to what already exists)

## Architecture

### `usePageMeta` hook

New file `src/lib/usePageMeta.js`:

```js
usePageMeta({ title, description, image })
```

On mount (and when args change), sets `document.title` and upserts (create-if-missing, else update) these tags by selector:
- `meta[name="description"]`
- `meta[property="og:title"]`, `meta[property="og:description"]`, `meta[property="og:image"]`
- `meta[name="twitter:title"]`, `meta[name="twitter:description"]`, `meta[name="twitter:image"]`

`image` is optional; when omitted, existing `og:image`/`twitter:image` values (from `index.html`) are left untouched. `index.html`'s static tags remain the pre-JS fallback (crawlers/link-unfurlers that don't execute JS still get a sane title/description/image for `/`).

Called once, near the top of the component body, in: `MarketingHome`, `PrivacyPolicy`, `TermsOfService`, `ThankYou`, `NotFound`.

### Routing changes ([App.jsx](../../../src/App.jsx))

- Add `<Route path="/thank-you" element={<ThankYou />} />`.
- Replace the final catch-all `<Route path="*" element={<Navigate to="/" replace />} />` with `<Route path="*" element={<NotFound />} />`. `NotFound` itself links back to `/`, so users aren't stuck — but the URL bar, status semantics, and page title now correctly reflect a 404 instead of silently rewriting history to `/`.

### New components

- `src/views/legal/ThankYou.jsx` — confirmation copy, response-time promise, breadcrumb (`Home / Thank you`), link back to home and to the FAQ anchor.
- `src/views/marketing/NotFound.jsx` — on-brand "page not found" copy, link to `/` and to FAQ anchor. No breadcrumb (no meaningful parent for an error state).
- `src/components/shared/Breadcrumbs.jsx` — `<Breadcrumbs items={[{label, to?}]} />`, reusable. Last item has no `to` (current page, non-link). Used on Privacy, Terms, Thank-you only.
- `src/views/marketing/sections/StickyMobileCta.jsx` — fixed-bottom bar, `display: none` above the existing mobile breakpoint in `marketing.css`, two buttons wired to the same `onOperatorSignup` / `onScrollTo('advertisers')` handlers `Hero` already uses. Rendered from `Home.jsx` alongside the other sections.

### Modified components

- [`CtaBand.jsx`](../../../src/views/marketing/sections/CtaBand.jsx): on successful insert, `navigate('/thank-you')` instead of setting local `submitted` state / rendering the inline success card. Add response-time promise line ("We'll respond within 2 business days") near the submit button.
- [`PrivacyPolicy.jsx`](../../../src/views/legal/PrivacyPolicy.jsx) / [`TermsOfService.jsx`](../../../src/views/legal/TermsOfService.jsx): add `<Breadcrumbs>` at top; add a cross-link to the other legal page + home at the bottom (currently link to neither each other nor `/`).
- `Home.jsx`: call `usePageMeta`, render `<StickyMobileCta />`.

### Static files

- `public/robots.txt`:
  ```
  User-agent: *
  Allow: /
  Disallow: /app/
  Disallow: /display/
  Disallow: /report/

  Sitemap: https://adgrid.io/sitemap.xml
  ```
  (`/app/*` is the authenticated dashboard, `/display/:token` and `/report/:token` are unlisted tokenized URLs — none should be crawled/indexed.)
- `public/sitemap.xml`: static XML listing the public, indexable routes only — `/`, `/privacy`, `/terms`, `/thank-you`. Not itself a checklist item, but a `robots.txt` `Sitemap:` line pointing at nothing is broken, so it's included as a minimal, mechanical addition (no real content required).

## Out of scope

Everything in "Explicitly skipped" above. Also out of scope: SSR/prerendering (titles/meta are client-set via `usePageMeta`, which is a real gap for crawlers that don't execute JS — acceptable tradeoff for a Vite SPA with no SSR infra today; the static `index.html` tags remain the fallback for `/`).

## Testing

Match existing repo density (per-component `.test.jsx`, vitest + RTL):
- `usePageMeta.test.js` — verifies it sets `document.title` and creates/updates the expected meta tags.
- `NotFound` — smoke test that the `*` route renders it (not a redirect) for an unknown path.
- `CtaBand` — extend/verify existing coverage (if any) that a successful submit navigates to `/thank-you`.
