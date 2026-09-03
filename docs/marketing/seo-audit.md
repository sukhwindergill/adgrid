# SEO Audit — AdGrid

## Good already in place
- `index.html` has title, meta description, OG/Twitter tags, and (added this pass) Organization/Service JSON-LD.
- `public/robots.txt` correctly disallows app/display/report routes (private/dynamic) while allowing marketing pages, and points to `sitemap.xml`.
- FAQ content now has `FAQPage` structured data (`schema.md`).
- Added `public/llms.txt` for AI-answer-engine discoverability (`ai-seo` pass).

## Gaps found
1. **`public/sitemap.xml` only lists 3 URLs** (`/`, `/privacy`, `/terms`) — no city or content pages exist yet to add, but once `programmatic-seo.md` city pages ship, they must be added here with weekly changefreq and higher priority than legal pages.
2. **No canonical tag** in `index.html` — recommend adding `<link rel="canonical" href="https://adgrid.io/">` to prevent duplicate-content ambiguity as more routes are added.
3. **Single H1** — confirmed `Hero.jsx` has exactly one `<h1>`; other sections use `<h2>` (`sec-h` class pattern) — correct hierarchy, no action needed.
4. **No blog/content directory** — biggest structural SEO gap; without indexable content beyond the homepage, AdGrid can't capture long-tail "how to advertise on screens in [city]" or "monetize my [venue] screen" search intent (see `content-strategy.md`, `programmatic-seo.md`).

## Fix applied this pass
Added canonical link tag to `index.html` (see below) — cheap, correct, no risk.
