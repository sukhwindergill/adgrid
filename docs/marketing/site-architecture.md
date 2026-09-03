# Site Architecture — AdGrid

## Current routes (`src/App.jsx`)
Public/marketing: `/`, `/login`, `/privacy`, `/terms`, `/thank-you`.
Dynamic/private: `/display/:token`, `/report/:token`, `/invite/screen/:token`, `/invite/:token`, `/app/*` (authenticated app), `/app/accounts`, `/app/admin/invites`, `/app/accept-grant`.

## Recommended additions (SEO/marketing-driven)
- `/screens/:city` — programmatic city landing pages (`programmatic-seo.md`).
- `/blog` or `/guides` — content hub (`content-strategy.md`).
- `/pricing` — dedicated page making the 12%/40% fee split (from `faqData.js`) explicit and scannable, rather than only living inside an FAQ accordion (`pricing.md` transparency recommendation).
- `/vs` or comparison pages — only after legal review of any named-competitor claims (`competitors.md`).

## IA principle
Keep the public marketing site (`/`) as a single scrollable page with anchored sections (current pattern: Hero → HowItWorks → OperatorsSection → AdvertisersSection → Faq) for the primary conversion path, and use dedicated routes only for content that needs its own URL for SEO (city pages, blog posts, pricing) — don't fragment the core conversion narrative across multiple page loads.

## robots.txt alignment
Current `Disallow: /app/ /display/ /report/` correctly protects private/dynamic routes from indexing; any new public route (city pages, blog, pricing) must be left crawlable and added to `sitemap.xml`.
