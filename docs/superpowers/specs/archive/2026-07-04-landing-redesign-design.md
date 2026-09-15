# AdGrid Landing Page Redesign — Design Spec

**Date:** 2026-07-04
**Status:** Approved by user (brainstorming session)
**Scope:** Marketing landing page (`src/views/marketing/Home.jsx`) + photoreal creatives. App-wide design pass is Phase 2, separate spec.

## Problem

The current landing page reads as AI-generated:

- Animation overload: pulsing CTA glow, drifting orbs, cursor glow, scroll parallax, 3D card tilt, word-by-word headline reveal, animated gradient borders/text — all simultaneously.
- Emoji used as icons (📈 🛡 📊 🚀, 🇨🇦 in hero badge).
- Cyan→purple gradient applied to buttons, text, borders, and progress bars indiscriminately.
- No real imagery anywhere; product shown as div-drawn fake panels.
- Trust failures: three fabricated testimonials ("Marcus T.", "Priya K.", "Julien L.") on a pre-launch product; hero claims "2,400+ screens · 14 cities" while the TrustBar renders the actual DB count (~3) on the same page; the opportunity section pull-quotes the company itself.
- Hyperbolic copy patterns ("OOH advertising is broken. On both sides.", "Finally.", "$1B+ opportunity sitting untouched").

## Direction (user-approved decisions)

| Decision | Choice |
|---|---|
| Scope | Landing page first, app pass later (Phase 2) |
| Brand | Evolve, keep recognizable — purple anchor, restrained gradient |
| Creatives | Photoreal venue shots via Nano Banana (banana skill) |
| Inspiration | AdQuick (photography, honest inventory) × Meta/Google Ads (clarity, restraint) |
| Structure | Dark hero + light body + dark CTA band/footer |
| Trust | Remove all fabricated content; honest pre-launch story; DB count is the only screen count |
| Motion | Minimal: one shared scroll fade-up + one hero entrance; everything else deleted |

## Visual Language

- **Color:** Purple `#7B2FFF` is the brand anchor. Cyan `#00C2FF` demoted to small accents (links, data highlights, map pins). The cyan→purple gradient may appear at most once on the page (one hero accent word) — never on buttons, borders, or body text. Buttons: solid purple, hover darkens (`#6B1FEF`), no glow/pulse.
- **Dark sections:** keep `#0A0A0F` family (`--bg`, `--surface`, `--border` as-is). Static subtle grid backdrop allowed in hero; no drift animation.
- **Light sections:** `#fafafa` background, `#ffffff` cards, `#e5e5e5` borders, text `#0a0a0a`/`#525252` — matches app tokens (`src/design/tokens.js`).
- **Type:** Inter, weights 400–800. Hero 56–64px (clamp), section headings 36–40px, sentence case, letter-spacing -0.02em to -0.03em. No gradient text except the single permitted accent.
- **Icons:** one consistent inline-SVG stroke set, 24px viewBox, ~1.5px stroke, `currentColor`. Zero emoji anywhere on the page.
- **Radius/elevation:** 12–16px radius; light sections use soft shadows (`0 1px 3px rgba(0,0,0,0.06)`), dark sections use 1px borders.
- **Motion:** one `.rv` scroll-reveal class: opacity 0→1 + translateY 8px→0, 0.4s ease-out, no spring/overshoot, stagger delays ≤ 0.12s. Hero gets a single entrance fade. Deleted: orbs, cursor glow, parallax, card tilt, ctaPulse, gradientShift, borderRotate, wordReveal, gridDrift, chevronBounce.

## Section Flow

1. **Nav (dark, sticky w/ blur):** logo, For Operators, For Advertisers, How it works, Sign in, one solid-purple "Join the waitlist" CTA.
2. **Hero (dark):** two-column on desktop (stacks on mobile). Left: tag ("Canada's OOH marketplace" — text, no emoji), headline keeping the "Canada's screens. Canada's brands. One marketplace." sentiment (static, single fade), tightened subhead, dual CTA (solid purple primary "List your screens", quiet secondary "I'm an advertiser"), honest stat row: live screen count from DB, launch cities (Toronto & Vancouver), venue category count. Right: photoreal creative #1 (gym wall screen) in a rounded frame.
3. **Proof strip (light begins):** venue-type coverage row (Gyms · Cafés · Salons · Clinics · Transit · Retail) with stroke icons + live screen counter from Supabase. Replaces fake testimonials entirely.
4. **Product (light):** existing div-drawn dashboard panels restyled to light theme with honest demo numbers, presented in a browser-chrome frame, Operator/Advertiser toggle (replaces auto-rotating reel).
5. **How it works (light):** two tracks (operator, advertiser), 3 numbered steps each, stroke icons.
6. **Operators (light):** creative #2 (barbershop counter screen) + 4 feature cards (dynamic pricing, approval control, analytics, fast onboarding) with stroke icons, copy de-hyped.
7. **Advertisers (light):** creative #3 (café window screen with QR code) + targeting/pricing/measurement features.
8. **Market stat band (light, slim):** single-line honest framing of the Canadian OOH market. The self-quote and "$1B+ sitting untouched" section is deleted.
9. **CTA band (dark):** waitlist form (existing form logic preserved), "Launching in Toronto & Vancouver" stated plainly, solid purple submit.
10. **Footer (dark):** cleaned, same links, no gradient.

## Copy Rules

- No "broken", "Finally.", "revolutionary", "game-changing", or self-quotes.
- No invented metrics. The live DB screen count is the only screen number on the page. Launch-city and venue-category counts are real.
- Fabricated testimonials deleted (not replaced with new fakes).
- Benefit-led, concrete verbs, sentence case headlines.
- Pre-launch honesty: "founding operator" positioning is allowed and encouraged.

## Nano Banana Creatives

Generated via banana skill; photoreal; consistent grade (natural light, slightly cool, believable venue context; screens display plausible branded ad content — not AdGrid UI). Saved as optimized web assets under `public/marketing/`.

1. `hero-gym.jpg` — modern gym interior, wall-mounted landscape display running a vibrant ad.
2. `venue-barbershop.jpg` — barbershop/salon counter screen.
3. `venue-cafe.jpg` — café window-facing screen with visible QR code, street-side context.
4. (Optional) `venue-waiting.jpg` — clinic/waiting-area screen, only if a 4th slot is needed.

Aspect ratios: hero 4:3 or 3:2 landscape; section images 3:2. Each image reviewed before wiring in; regenerate on mismatch (wrong screen content, uncanny artifacts, wrong vibe).

## Code Structure

- Split the 1,960-line `src/views/marketing/Home.jsx` into `src/views/marketing/sections/`: `Nav.jsx`, `Hero.jsx`, `ProofStrip.jsx`, `ProductShowcase.jsx`, `HowItWorks.jsx`, `OperatorsSection.jsx`, `AdvertisersSection.jsx`, `MarketBand.jsx`, `CtaBand.jsx`, `Footer.jsx`, plus `marketing.css` (or shared CSS constant module) holding the reduced stylesheet.
- `MarketingHome` becomes a thin composition root; existing routing/props (`onSignup`, `onLogin`) unchanged.
- Existing Supabase live-count query moves into the proof strip; waitlist form logic preserved as-is.
- Icon set lives in `src/views/marketing/sections/icons.jsx` (or equivalent single module).
- No new dependencies.

## Error Handling

- Live screen count: if the Supabase query fails or returns null, render the stat without a number (e.g., omit the stat item) — never show a fake fallback number.
- Images: explicit width/height to avoid layout shift; `loading="lazy"` below the fold; hero image eager.

## Verification

- Preview at desktop (1280px) and mobile (375px); screenshot each section.
- Console clean; `npm run lint` passes; `npm run build` succeeds.
- Route behavior unchanged (`/`, login/signup handoffs, legal links).

## Phase 2 (out of scope here)

App-wide pass: AppShell/sidebar/header consistency, shared stroke icon set, table/form/dashboard density patterns (Meta/Google Ads-inspired), primitive component polish. Own spec + plan after landing ships.
