# Image Audit — AdGrid Marketing Assets

## Alt text audit (`src/views/marketing`)
Reviewed all marketing-facing `<img>` tags. Descriptive, keyword-relevant alt text already in place:
- `Hero.jsx`: "Digital ad screen mounted in a gym"
- `AdvertisersSection.jsx`: "Café window screen showing an ad with a QR code"
- `OperatorsSection.jsx`: "Digital ad screen on a barbershop counter"
- `Carousel.jsx`: alt sourced per-slide from data — verify each slide's `alt` is descriptive (not generic "image") when new slides are added.

Decorative-only images (account logos, in-app previews) correctly use `alt=""` since adjacent text already names them — left as-is per accessibility best practice (avoid duplicate screen-reader announcements).

## Filenames
`public/marketing/*.jpg` filenames are already descriptive (`hero-gym.jpg`, `venue-cafe.jpg`, `venue-barbershop.jpg`) — good for image search/SEO. Keep this convention (`venue-{type}.jpg`) for any new venue photos.

## Social/OG image
`index.html` og:image and twitter:image both point to `/marketing/hero-gym.jpg` (1600x1073, referenced with explicit width/height in `Hero.jsx` to avoid CLS). Recommend a dedicated 1200x630 OG-optimized crop once more real venue photography exists, rather than reusing the hero image at the wrong aspect ratio.

## Gap
No image sitemap entry in `public/sitemap.xml` — low priority, but worth adding `<image:image>` tags once the content-strategy blog/city pages ship with unique imagery per page.
