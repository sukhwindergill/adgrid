# Landing Page Motion Elevation — Design Spec

**Date:** 2026-07-05
**Status:** Approved by user (brainstorming session)
**Scope:** Adds Framer/Linear-style scroll-driven motion and a real venue photo gallery to the already-redesigned marketing landing page (`docs/superpowers/specs/2026-07-04-landing-redesign-design.md`). No visual-language changes (colors, type, section order) — this is a motion + gallery layer on top of that work.

## Context

The prior redesign deliberately killed "AI slop" motion (glow orbs, cursor-follow glow, pulsing CTAs, 3D card tilt, animated gradient borders) in favor of a single scroll-fade-up. The user now wants a more premium, Framer-like feel: content that flows and reacts as you scroll, not just fades in once. The distinction that keeps this from regressing into slop: every effect here is **scroll-position-driven and purposeful** (parallax depth, pinned context, count-up proof, self-drawing diagrams) — nothing is ambient/looping-for-its-own-sake except the two explicitly-scoped exceptions (hero Ken Burns zoom, marquee ticker), both subtle and industry-standard.

**Budget constraint:** Higgsfield/Nano Banana account has ~4 image credits left (free plan), no video credits (cheapest video model is 7.5 credits/clip). Video is out of scope for this pass — motion is achieved via CSS/JS on stills instead.

## New Assets

Generate 2 more photoreal venue images via the banana skill (same brief style as the existing 3 — purple-accented ad content on a real screen in a real venue, natural lighting, commercial photography, 3:2 landscape, 2k):

- `public/marketing/venue-retail.jpg` — digital screen in a retail/clothing store, positioned near checkout or an aisle end-cap.
- `public/marketing/venue-transit.jpg` — digital screen at a transit shelter/bus stop, street-level, plausible ad content, daylight.

Both processed through the existing ffmpeg pipeline (scale to 1600px wide, `-q:v 4` JPEG, target ≤300KB) established in the prior pass.

## 1. Venue Gallery (replaces ProofStrip's static chip row)

**File:** `src/views/marketing/sections/Carousel.jsx` (new, generic — takes an array of `{src, alt, caption}` and renders the carousel), used from a rewritten `ProofStrip.jsx`.

- Auto-advances every 4s, crossfade transition (~500ms opacity cross-fade, not slide — cheaper, no layout thrash).
- Manual prev/next arrow buttons + dot indicators (click a dot to jump to that slide).
- Pauses auto-advance on hover and on keyboard focus within the carousel; resumes on mouse-leave/blur.
- 5 slides: gym, barbershop, café, retail, transit — each captioned with its venue-type label under the image.
- Keyboard accessible: arrows are real `<button>`s, dots are real `<button>`s with `aria-label="Go to slide N"`, carousel container has `aria-live="off"` (avoid screen-reader spam from auto-advance) with a visible pause-on-focus so keyboard users aren't fighting a moving target.
- Below the carousel: the existing venue-type chip row (Gyms, Cafés, Salons & barbershops, Clinics, Transit, Retail, Hotels, Campuses) becomes an infinite-scroll marquee — a flex row of chips duplicated once and animated via `translateX` keyframe looping seamlessly, `animation-play-state: paused` on hover.
- `prefers-reduced-motion`: auto-advance and marquee both stop (marquee renders as a static wrapped row instead of an animated strip); carousel remains manually navigable.

## 2. Hero Motion

**File:** `src/views/marketing/sections/Hero.jsx`, `marketing.css`

- Ken Burns: `.hero-img` gets a CSS animation `heroZoom` — `scale(1.0)` → `scale(1.06)`, `20s ease-in-out infinite alternate`. Applied via a wrapping div with `overflow: hidden` (the zoom must not visually clip outside the rounded-corner frame).
- Parallax: reuse the existing rAF-throttled scroll pattern (previously deleted, now reintroduced narrowly) — a `useParallax(factor)` hook returns a ref + inline `transform: translateY(px)`. Hero image gets `factor: 0.15` (moves slower than the page, i.e. text scrolls away faster, image lags), applied only while the hero is within/near the viewport (computed from `getBoundingClientRect`, not a global scroll listener that runs forever).
- `prefers-reduced-motion`: Ken Burns and parallax both disabled (image static at `scale(1)`, no transform).

## 3. Sticky Split Sections (Operators, Advertisers)

**Files:** `src/views/marketing/sections/OperatorsSection.jsx`, `AdvertisersSection.jsx`, `marketing.css`

- The `.split` grid becomes taller than the viewport (container gets extra bottom padding / min-height so there's scroll distance to pin against).
- The image column gets `position: sticky; top: 96px;` (clears the fixed nav) so it stays put in the viewport while the adjacent text + 4 feature cards scroll past.
- On mobile (`max-width: 900px`, where `.split` already stacks to 1 column), sticky is disabled (`position: static`) — pinning a stacked single-column layout has no benefit and would just look broken.
- No JS needed for the pin itself (pure CSS sticky); no new hook.

## 4. Product Showcase Count-Up

**File:** `src/views/marketing/sections/ProductShowcase.jsx`, new hook `src/views/marketing/sections/useCountUp.js`

- `useCountUp(target, active, duration=800)`: given a numeric target and an `active` boolean (from the existing `useReveal` intersection state), animates an internal state value from 0 → target using `requestAnimationFrame` with an ease-out curve, returns the current display value. Non-numeric KPI values (e.g. "$6,075", "80%") are parsed for their numeric portion, animated, then re-composed with the original prefix/suffix/formatting on each frame.
- Progress bars (`.mock-row .bar i`): width transitions from `0%` to the target `%` over ~600ms when the section becomes active (CSS transition, triggered by toggling a class once `on` flips true — same mechanism the section already uses).
- Table rows (`.mock-row`): staggered fade/slide-in (reuse `.rv` pattern with per-row incremental delay, e.g. `${i * 80}ms`).
- Switching tabs (operators ↔ advertisers) re-triggers the count-up/bar/row animation for the newly-shown tab's data (reset to 0 and re-animate on tab change, not just on first scroll-into-view).

## 5. How It Works — Scroll-Drawn Diagram

**File:** `src/views/marketing/sections/HowItWorks.jsx`

- New small SVG diagram inserted above the two `.track` cards: three icons in a horizontal row — screen/display icon (operator side) → connecting line → AdGrid mark (small logo/mark, reuse brand purple) → connecting line → storefront/bag icon (advertiser side).
- The two connecting lines are SVG `<path>` strokes with `stroke-dasharray` = path length and `stroke-dashoffset` animated from full-length → 0 when the section scrolls into view (reuses the section's existing `useReveal` `on` boolean — CSS transition on `stroke-dashoffset`, no new JS needed).
- Icons themselves fade/scale in with a slight stagger (reuse `.rv` pattern).
- The existing two-track step lists (operator steps, advertiser steps) are unchanged — the diagram is additive, sitting above them as a visual summary.

## Error Handling / Performance

- `useParallax` and the hero Ken Burns must not run when `prefers-reduced-motion: reduce` is set — checked once via `window.matchMedia('(prefers-reduced-motion: reduce)').matches` at hook init, and also covered by the existing global reduced-motion CSS override in `marketing.css`.
- Scroll listeners (parallax) are rAF-throttled and removed on unmount, consistent with the existing pattern already used elsewhere in this file before it was simplified.
- Carousel auto-advance interval is cleared on unmount and on pause; no leaked timers.
- All new images: explicit `width`/`height` to avoid layout shift, `loading="lazy"` (gallery carousel images are below the fold).

## File Structure Changes

```
public/marketing/
  venue-retail.jpg     (new)
  venue-transit.jpg    (new)
src/views/marketing/sections/
  Carousel.jsx          (new — generic image carousel)
  useCountUp.js         (new — number count-up hook)
  useParallax.js        (new — rAF scroll-parallax hook)
  ProofStrip.jsx         (rewritten — carousel + marquee instead of static chip row)
  Hero.jsx               (modified — Ken Burns + parallax on hero image)
  OperatorsSection.jsx   (modified — sticky image column)
  AdvertisersSection.jsx (modified — sticky image column)
  ProductShowcase.jsx    (modified — count-up KPIs, animated bars, staggered rows)
  HowItWorks.jsx         (modified — scroll-drawn SVG diagram added above tracks)
marketing.css             (modified — heroZoom keyframe, marquee keyframe, sticky rules, reduced-motion overrides extended)
```

## Verification

- Preview at desktop (1280–1440px) and mobile (375px): confirm sticky sections pin/release correctly, sticky disabled on mobile stack, carousel auto-advances and pauses on hover/focus, count-up fires once per scroll-into-view and re-fires on tab switch, diagram lines draw in.
- Test `prefers-reduced-motion: reduce` (via `preview_resize` colorScheme or direct emulation): confirm Ken Burns/parallax/marquee/auto-advance all stop, content remains fully usable.
- Console clean, `npm run lint` passes, `npm run build` succeeds.
- No new npm dependencies added.
