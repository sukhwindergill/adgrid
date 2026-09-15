# Landing Page Motion Elevation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Layer Framer/Linear-style scroll-driven motion and a real 5-photo venue gallery onto the existing marketing landing page, per `docs/superpowers/specs/2026-07-05-landing-motion-elevation-design.md`.

**Architecture:** Three new hooks (`useParallax`, `useCountUp`, existing `useReveal`) drive all motion — no ambient/looping effects except the explicitly-scoped hero Ken Burns zoom and venue-chip marquee, both CSS-only and disabled under `prefers-reduced-motion`. A new generic `Carousel.jsx` component replaces the static chip row in `ProofStrip`. Sticky positioning (pure CSS, no JS) pins the Operators/Advertisers images while their text+cards scroll past.

**Tech Stack:** React 19 (existing), plain CSS (existing `marketing.css`), Higgsfield MCP `nano_banana_pro` for 2 new images, ffmpeg for image processing (established pattern). No new npm dependencies.

**Budget note:** Account has ~4 image credits left. Task 1 generates exactly 2 images (4 credits) — check balance first; if less than 4 credits available, stop and report rather than generating a partial/mismatched set.

---

## File Structure

```
public/marketing/
  venue-retail.jpg      (new)
  venue-transit.jpg     (new)
src/views/marketing/sections/
  Carousel.jsx           (new — generic auto-advancing image carousel)
  useParallax.js         (new — rAF scroll-parallax hook)
  useCountUp.js          (new — number count-up hook)
  ProofStrip.jsx          (rewritten — Carousel + marquee)
  Hero.jsx                (modified — Ken Burns + parallax wrapper)
  OperatorsSection.jsx    (modified — sticky-split restructure)
  AdvertisersSection.jsx  (modified — sticky-split restructure)
  ProductShowcase.jsx     (modified — count-up KPIs, animated bars, staggered rows)
  HowItWorks.jsx          (modified — scroll-drawn flow diagram)
src/views/marketing/
  marketing.css            (modified — new CSS for all of the above)
```

---

### Task 1: Generate 2 new venue images

**Files:**
- Create: `public/marketing/venue-retail.jpg`, `public/marketing/venue-transit.jpg`

- [ ] **Step 1: Check Higgsfield credit balance before generating anything**

Call the `balance` MCP tool (`mcp__c4e15303-f0cc-481b-bf50-7a96a1782d77__balance`). Expected: `credits >= 4`. If fewer than 4, stop this task and report the shortfall — do not generate a partial/mismatched pair.

- [ ] **Step 2: Generate `venue-retail`**

Call `mcp__c4e15303-f0cc-481b-bf50-7a96a1782d77__generate_image` with:
```json
{
  "model": "nano_banana_pro",
  "prompt": "Interior photograph of a modern retail clothing store. A landscape digital signage screen is mounted near the checkout counter or at an aisle end-cap, showing a seasonal sale advertisement with purple-accented graphics and bold short text. Clothing racks and shelving softly out of focus in the background, natural store lighting, cool colour grade, realistic reflections on the screen glass, commercial interior photography.",
  "aspect_ratio": "3:2",
  "resolution": "2k"
}
```
This returns a `pending` job with an `id`. Poll `mcp__c4e15303-f0cc-481b-bf50-7a96a1782d77__job_display` with that `id` every ~15s until `status: "completed"`, then read `results.rawUrl`.

- [ ] **Step 3: Generate `venue-transit`**

Call the same tool with:
```json
{
  "model": "nano_banana_pro",
  "prompt": "Photograph of a digital signage screen mounted inside a transit shelter / bus stop at street level, seen from the sidewalk. The screen displays a local advertisement with purple-accented design and short bold text. Daylight, realistic reflections on the glass, a blurred bus or street traffic in the background, photorealistic commercial photography.",
  "aspect_ratio": "3:2",
  "resolution": "2k"
}
```
Poll the same way until completed, read `results.rawUrl`.

- [ ] **Step 4: Download and process both images**

```bash
cd C:/Users/corpo/adgrid/public/marketing
curl -sL "<venue-retail rawUrl>" -o venue-retail.png
ffmpeg -y -i venue-retail.png -vf "scale=1600:-1" -q:v 4 venue-retail.jpg
rm venue-retail.png

curl -sL "<venue-transit rawUrl>" -o venue-transit.png
ffmpeg -y -i venue-transit.png -vf "scale=1600:-1" -q:v 4 venue-transit.jpg
rm venue-transit.png
```
Expected: both `.jpg` files exist, each ≤ ~350KB. Check dimensions match the pattern from the earlier 3 images (should be `1600x1073` given the same 3:2 source ratio, but confirm with `ffmpeg -i venue-retail.jpg 2>&1 | grep Stream` — use the actual reported width/height in Task 2's `Carousel` slide data, don't assume).

- [ ] **Step 5: Visually review both images**

Read each file with the Read tool. Reject and regenerate (back to Step 2/3) if: the screen shows UI/dashboard content instead of an ad, garbled text, anatomy artifacts, or a wildly inconsistent grade vs. the existing 3 images.

- [ ] **Step 6: Commit**

```bash
git add public/marketing/venue-retail.jpg public/marketing/venue-transit.jpg
git commit -m "assets: 2 more photoreal venue creatives for gallery carousel"
```

---

### Task 2: Carousel component + ProofStrip rewrite

**Files:**
- Create: `src/views/marketing/sections/Carousel.jsx`
- Modify: `src/views/marketing/sections/ProofStrip.jsx` (full rewrite)
- Modify: `src/views/marketing/marketing.css` (append new section)

- [ ] **Step 1: Write `Carousel.jsx`**

```jsx
import { useEffect, useRef, useState } from 'react';

const INTERVAL_MS = 4000;

export function Carousel({ slides }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useRef(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    if (paused || reducedMotion.current) return;
    const id = setInterval(() => setIndex(i => (i + 1) % slides.length), INTERVAL_MS);
    return () => clearInterval(id);
  }, [paused, slides.length]);

  const goTo = i => setIndex(((i % slides.length) + slides.length) % slides.length);

  return (
    <div className="gallery-carousel" aria-live="off"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
    >
      <div className="gallery-stage">
        {slides.map((slide, i) => (
          <div className={`gallery-slide ${i === index ? 'on' : ''}`} key={slide.src}>
            <img src={slide.src} alt={slide.alt} loading="lazy" width={slide.width} height={slide.height} />
          </div>
        ))}
        <button className="gallery-arrow prev" onClick={() => goTo(index - 1)} aria-label="Previous slide">‹</button>
        <button className="gallery-arrow next" onClick={() => goTo(index + 1)} aria-label="Next slide">›</button>
      </div>
      <div className="gallery-caption-bar">
        <span className="gallery-caption">{slides[index].caption}</span>
        <div className="gallery-dots">
          {slides.map((slide, i) => (
            <button key={slide.src} className={`gallery-dot ${i === index ? 'on' : ''}`}
              onClick={() => goTo(i)} aria-label={`Go to slide ${i + 1}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `ProofStrip.jsx`**

Use the actual width/height reported by `ffmpeg -i` in Task 1 Step 4 for the two new slides (`venue-retail.jpg`, `venue-transit.jpg`); the 3 existing images are confirmed `1600x1073`.

```jsx
import { useReveal } from './useReveal.js';
import { Carousel } from './Carousel.jsx';
import { IconDumbbell, IconCoffee, IconScissors, IconCross, IconBus, IconBag, IconBed, IconCap } from './icons.jsx';

const VENUES = [
  ['Gyms', IconDumbbell], ['Cafés', IconCoffee], ['Salons & barbershops', IconScissors],
  ['Clinics', IconCross], ['Transit', IconBus], ['Retail', IconBag],
  ['Hotels', IconBed], ['Campuses', IconCap],
];

const SLIDES = [
  { src: '/marketing/hero-gym.jpg', alt: 'Digital ad screen mounted in a gym', caption: 'Gym — wall-mounted display', width: 1600, height: 1073 },
  { src: '/marketing/venue-barbershop.jpg', alt: 'Digital ad screen on a barbershop counter', caption: 'Barbershop — counter display', width: 1600, height: 1073 },
  { src: '/marketing/venue-cafe.jpg', alt: 'Café window screen showing an ad with a QR code', caption: 'Café — window-facing display', width: 1600, height: 1073 },
  { src: '/marketing/venue-retail.jpg', alt: 'Digital ad screen in a retail store', caption: 'Retail — in-store display', width: 1600, height: 1073 },
  { src: '/marketing/venue-transit.jpg', alt: 'Digital ad screen at a transit shelter', caption: 'Transit — shelter display', width: 1600, height: 1073 },
];

export function ProofStrip() {
  const [ref, on] = useReveal();
  return (
    <section className="sec light" ref={ref} style={{ padding: '56px 24px', textAlign: 'center' }}>
      <div className={`inner rv ${on ? 'on' : ''}`}>
        <h2 className="sec-h" style={{ fontSize: 24 }}>Screens where people actually spend time</h2>
        <Carousel slides={SLIDES} />
        <div className="marquee">
          <div className="marquee-track">
            {[...VENUES, ...VENUES].map((v, i) => {
              const [label, Icon] = v;
              return <span className="venue-chip" key={`${label}-${i}`}><Icon size={17} /> {label}</span>;
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Append carousel + marquee CSS to `marketing.css`**

Insert immediately after the existing `/* ── Proof strip ── */` block (after the `.venue-chip svg { color: var(--purple); }` line):

```css
.marquee { margin-top: 28px; overflow: hidden; position: relative; }
.marquee::before, .marquee::after {
  content: ''; position: absolute; top: 0; bottom: 0; width: 60px; z-index: 2; pointer-events: none;
}
.marquee::before { left: 0; background: linear-gradient(to right, var(--lbg), transparent); }
.marquee::after { right: 0; background: linear-gradient(to left, var(--lbg), transparent); }
.marquee-track { display: flex; gap: 12px; width: max-content; animation: marqueeScroll 28s linear infinite; }
.marquee:hover .marquee-track { animation-play-state: paused; }
@keyframes marqueeScroll {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

/* ── Gallery carousel ── */
.gallery-carousel { margin-top: 32px; }
.gallery-stage { position: relative; aspect-ratio: 3 / 2; max-height: 420px; border-radius: 16px; overflow: hidden; }
.gallery-slide { position: absolute; inset: 0; opacity: 0; transition: opacity .5s ease; }
.gallery-slide.on { opacity: 1; z-index: 1; }
.gallery-slide img { width: 100%; height: 100%; object-fit: cover; display: block; }
.gallery-arrow {
  position: absolute; top: 50%; transform: translateY(-50%); z-index: 2;
  width: 36px; height: 36px; border-radius: 50%; border: none; cursor: pointer;
  background: rgba(10,10,15,0.5); color: #fff; font-size: 18px; line-height: 1;
  display: flex; align-items: center; justify-content: center; transition: background .15s;
}
.gallery-arrow:hover { background: rgba(10,10,15,0.75); }
.gallery-arrow.prev { left: 14px; }
.gallery-arrow.next { right: 14px; }
.gallery-caption-bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 14px; }
.gallery-caption { font: 500 14px/1.4 var(--inter); color: var(--lsub); }
.gallery-dots { display: flex; gap: 6px; flex-shrink: 0; }
.gallery-dot { width: 7px; height: 7px; border-radius: 50%; border: none; cursor: pointer; background: var(--lborder); padding: 0; transition: background .15s, transform .15s; }
.gallery-dot.on { background: var(--purple); transform: scale(1.4); }
```

- [ ] **Step 4: Extend the existing reduced-motion block**

Find the existing block near the top of `marketing.css`:
```css
@media (prefers-reduced-motion: reduce) {
  .mktg *, .mktg *::before, .mktg *::after { animation: none !important; transition: none !important; }
  .rv { opacity: 1; transform: none; }
}
```
Replace it with (adds marquee-specific overrides — the wildcard `animation: none` already stops `marqueeScroll`, but `.marquee`'s `overflow: hidden` plus fade gradients look broken once the track stops scrolling, so unwrap it into a static wrapped row):
```css
@media (prefers-reduced-motion: reduce) {
  .mktg *, .mktg *::before, .mktg *::after { animation: none !important; transition: none !important; }
  .rv { opacity: 1; transform: none; }
  .marquee { overflow: visible; }
  .marquee::before, .marquee::after { display: none; }
  .marquee-track { flex-wrap: wrap; width: auto; justify-content: center; }
}
```

- [ ] **Step 5: Lint**

Run: `npx eslint src/views/marketing/sections/Carousel.jsx src/views/marketing/sections/ProofStrip.jsx`
Expected: no output (clean).

- [ ] **Step 6: Visual check in preview**

Start/reuse the dev server (`adgrid-dev` on :5173), navigate to `/`, scroll to the proof strip. Confirm: 5 slides crossfade every 4s, arrows/dots work, hovering pauses auto-advance, venue chip row scrolls infinitely and pauses on hover.

- [ ] **Step 7: Commit**

```bash
git add src/views/marketing/sections/Carousel.jsx src/views/marketing/sections/ProofStrip.jsx src/views/marketing/marketing.css
git commit -m "feat(marketing): venue gallery carousel + marquee ticker"
```

---

### Task 3: Hero Ken Burns + parallax

**Files:**
- Create: `src/views/marketing/sections/useParallax.js`
- Modify: `src/views/marketing/sections/Hero.jsx`
- Modify: `src/views/marketing/marketing.css`

- [ ] **Step 1: Write `useParallax.js`**

```js
import { useEffect, useRef } from 'react';

// Scroll-parallax: element's own transform moves at `factor` of scroll speed while near the viewport.
export function useParallax(factor = 0.15) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let ticking = false;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.bottom > 0 && rect.top < window.innerHeight) {
        const offset = (rect.top - window.innerHeight / 2) * factor;
        el.style.transform = `translateY(${offset}px)`;
      }
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [factor]);

  return ref;
}
```

- [ ] **Step 2: Modify `Hero.jsx`**

Add the import and hook call, and wrap the `<img>` in a parallax-carrying div:

```jsx
import { useEffect, useState } from 'react';
import { useParallax } from './useParallax.js';

export function Hero({ onScrollTo }) {
  const [liveCount, setLiveCount] = useState(null);
  const [mounted, setMounted] = useState(false);
  const parallaxRef = useParallax(0.15);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    import('../../../lib/supabase.js').then(({ supabase }) => {
      supabase.from('screens').select('id', { count: 'exact', head: true }).eq('status', 'live')
        .then(({ count }) => { if (count != null) setLiveCount(count); });
    }).catch(() => {});
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <section className="hero">
      <div className={`inner rv ${mounted ? 'on' : ''}`}>
        <div>
          <div className="eyebrow">Canada's OOH marketplace</div>
          <h1 className="hero-h">
            Canada's screens. Canada's brands. <span className="accent">One marketplace.</span>
          </h1>
          <p className="hero-sub">
            The self-serve marketplace where Canadian screen operators sell ad time and
            local advertisers buy it. Real-time pricing, full control on both sides.
          </p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <button className="btn-p" onClick={() => onScrollTo('waitlist-form')}>List your screens</button>
            <button className="btn-s" onClick={() => onScrollTo('advertisers')}>Book a campaign</button>
          </div>
          <div className="hero-stats">
            {typeof liveCount === 'number' && liveCount >= 1 && (
              <div className="hero-stat">
                <div className="num">{liveCount}</div>
                <div className="lbl">Screens live now</div>
              </div>
            )}
            <div className="hero-stat">
              <div className="num">Toronto &amp; Vancouver</div>
              <div className="lbl">Launch cities</div>
            </div>
            <div className="hero-stat">
              <div className="num">8</div>
              <div className="lbl">Venue categories</div>
            </div>
          </div>
        </div>
        <div className="hero-img-wrap" ref={parallaxRef}>
          <img className="hero-img" src="/marketing/hero-gym.jpg"
            alt="Digital ad screen mounted in a gym" width="1600" height="1073" fetchPriority="high" />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Update `.hero-img` CSS in `marketing.css`**

Replace the existing line:
```css
.hero-img { border-radius: 16px; border: 1px solid var(--border); width: 100%; height: auto; display: block; box-shadow: 0 24px 64px rgba(0,0,0,.5); }
```
with:
```css
.hero-img-wrap { border-radius: 16px; border: 1px solid var(--border); overflow: hidden; box-shadow: 0 24px 64px rgba(0,0,0,.5); will-change: transform; }
.hero-img { width: 100%; height: auto; display: block; animation: heroZoom 20s ease-in-out infinite alternate; }
@keyframes heroZoom { from { transform: scale(1); } to { transform: scale(1.06); } }
```
(The existing global reduced-motion wildcard rule `.mktg * { animation: none !important; }` already disables `heroZoom` under reduced motion — no extra override needed there. The parallax hook itself already no-ops under reduced motion.)

- [ ] **Step 4: Lint**

Run: `npx eslint src/views/marketing/sections/useParallax.js src/views/marketing/sections/Hero.jsx`
Expected: clean.

- [ ] **Step 5: Visual check**

Reload `/` in preview, confirm hero image slowly zooms, and scrolling down makes it lag slightly behind the text (parallax). Emulate `prefers-reduced-motion: reduce` (via `preview_resize` colorScheme param or OS emulation) and confirm the zoom stops and the image stays static while scrolling.

- [ ] **Step 6: Commit**

```bash
git add src/views/marketing/sections/useParallax.js src/views/marketing/sections/Hero.jsx src/views/marketing/marketing.css
git commit -m "feat(marketing): hero Ken Burns zoom + scroll parallax"
```

---

### Task 4: Sticky split sections (Operators, Advertisers)

**Files:**
- Modify: `src/views/marketing/sections/OperatorsSection.jsx` (full rewrite)
- Modify: `src/views/marketing/sections/AdvertisersSection.jsx` (full rewrite)
- Modify: `src/views/marketing/marketing.css`

- [ ] **Step 1: Rewrite `OperatorsSection.jsx`**

```jsx
import { useReveal } from './useReveal.js';
import { IconTrend, IconShield, IconChart, IconBolt } from './icons.jsx';

const CARDS = [
  [IconTrend, 'Dynamic pricing', 'Set a floor price and let demand move it up. Event nights and rush hours price themselves.'],
  [IconShield, 'Full approval control', 'Approve or reject every ad. Block categories and competitors. Set blackout windows.'],
  [IconChart, 'Real-time analytics', 'Fill rate, revenue trends, and playback proof — per screen, per day.'],
  [IconBolt, 'No lock-in', 'Connect in minutes. No long-term contracts, no upfront costs.'],
];

export function OperatorsSection({ onScrollTo }) {
  const [ref, on] = useReveal();
  return (
    <section className="sec lcard-bg" id="operators" ref={ref}>
      <div className="inner">
        <div className={`sticky-split rv ${on ? 'on' : ''}`}>
          <div className="sticky-col">
            <img src="/marketing/venue-barbershop.jpg" alt="Digital ad screen on a barbershop counter"
              loading="lazy" width="1600" height="1073" />
          </div>
          <div className="scroll-col">
            <div className="eyebrow">For operators</div>
            <h2 className="sec-h">Your screens. Your rules. New revenue.</h2>
            <p className="sec-sub">Turn idle screen time into income without giving up control of what plays in your venue.</p>
            <div className="card-grid">
              {CARDS.map(card => {
                const [Icon, h, p] = card;
                return <div className="f-card" key={h}><Icon /><h3>{h}</h3><p>{p}</p></div>;
              })}
            </div>
            <div style={{ marginTop: 32 }}>
              <button className="btn-p" onClick={() => onScrollTo('waitlist-form')}>Join the operator waitlist</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Rewrite `AdvertisersSection.jsx`**

```jsx
import { useReveal } from './useReveal.js';
import { IconPin, IconTagPrice, IconQr, IconClock } from './icons.jsx';

const CARDS = [
  [IconPin, 'Hyper-local targeting', 'Pick the exact venues your customers already visit, down to the block.'],
  [IconTagPrice, 'Transparent pricing', 'See the price per slot before you book. Pay only for played time.'],
  [IconQr, 'Scan-level measurement', 'Every campaign gets a unique QR code. Track scans by screen and by hour.'],
  [IconClock, 'Live in days', 'Upload creative, get approved, go live. No agencies, no RFPs.'],
];

export function AdvertisersSection() {
  const [ref, on] = useReveal();
  return (
    <section className="sec light" id="advertisers" ref={ref}>
      <div className="inner">
        <div className={`sticky-split rv ${on ? 'on' : ''}`}>
          <div className="scroll-col">
            <div className="eyebrow">For advertisers</div>
            <h2 className="sec-h">Local reach you can actually measure</h2>
            <p className="sec-sub">Put your brand on real screens in the neighbourhoods your customers live in — and see exactly what it did.</p>
            <div className="card-grid">
              {CARDS.map(card => {
                const [Icon, h, p] = card;
                return <div className="f-card" key={h}><Icon /><h3>{h}</h3><p>{p}</p></div>;
              })}
            </div>
          </div>
          <div className="sticky-col">
            <img src="/marketing/venue-cafe.jpg" alt="Café window screen showing an ad with a QR code"
              loading="lazy" width="1600" height="1073" />
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Replace `.split` CSS with `.sticky-split` in `marketing.css`**

Find and remove the existing block:
```css
/* ── Split feature (image + content) ── */
.split { display: grid; grid-template-columns: 1fr 1fr; gap: 56px; align-items: center; }
.split img { width: 100%; height: auto; border-radius: 16px; border: 1px solid var(--lborder); display: block; }
@media (max-width: 900px) { .split { grid-template-columns: 1fr; gap: 32px; } }
```
Replace with:
```css
/* ── Sticky split (Operators / Advertisers) ── */
.sticky-split { display: grid; grid-template-columns: 1fr 1fr; gap: 56px; }
.sticky-col { align-self: start; position: sticky; top: 96px; }
.sticky-col img { width: 100%; height: auto; border-radius: 16px; border: 1px solid var(--lborder); display: block; }
@media (min-width: 901px) { .scroll-col { min-height: 620px; } }
@media (max-width: 900px) {
  .sticky-split { grid-template-columns: 1fr; gap: 32px; }
  .sticky-col { position: static; }
}
```
(No change needed to `.card-grid` — it's already `repeat(2, 1fr)` and is reused as-is inside `.scroll-col`.)

- [ ] **Step 4: Lint**

Run: `npx eslint src/views/marketing/sections/OperatorsSection.jsx src/views/marketing/sections/AdvertisersSection.jsx`
Expected: clean.

- [ ] **Step 5: Visual check**

Reload `/`, scroll through the Operators section at desktop width (≥901px): confirm the barbershop image stays pinned near the top of the viewport while the heading, copy, and 4 cards scroll past beside it, then releases once the column ends. Repeat for Advertisers (café image, on the right). At mobile width (375px), confirm both sections stack to a single column with no sticky/pinning behavior.

- [ ] **Step 6: Commit**

```bash
git add src/views/marketing/sections/OperatorsSection.jsx src/views/marketing/sections/AdvertisersSection.jsx src/views/marketing/marketing.css
git commit -m "feat(marketing): sticky-pinned images in operators/advertisers sections"
```

---

### Task 5: Product Showcase count-up + animated bars/rows

**Files:**
- Create: `src/views/marketing/sections/useCountUp.js`
- Modify: `src/views/marketing/sections/ProductShowcase.jsx` (full rewrite)
- Modify: `src/views/marketing/marketing.css`

- [ ] **Step 1: Write `useCountUp.js`**

```js
import { useEffect, useRef, useState } from 'react';

// Animates a numeric value from 0 -> target while `active` is true.
export function useCountUp(target, active, duration = 800) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!active) { setDisplay(0); return; }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setDisplay(target); return; }

    const start = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(target * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, target, duration]);

  return display;
}
```

- [ ] **Step 2: Rewrite `ProductShowcase.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { useReveal } from './useReveal.js';
import { useCountUp } from './useCountUp.js';

const TABS = {
  operators: {
    kpis: [['Screens live', '3'], ['Fill rate', '80%'], ['This month', '$6,075']],
    rows: [
      ['Queen St & Spadina', 82, '$1,240'],
      ['Union Station Concourse', 91, '$2,860'],
      ['Yonge-Dundas Square', 67, '$1,975'],
    ],
    caption: 'List inventory, set floor prices, approve every ad, and track earnings per screen.',
  },
  advertisers: {
    kpis: [['Active campaigns', '2'], ['Plays today', '1,431'], ['QR scans', '96']],
    rows: [
      ['Downtown coffee launch', 74, '512 plays'],
      ['Weekend class promo', 58, '344 plays'],
      ['Neighbourhood open house', 41, '187 plays'],
    ],
    caption: 'Pick venues, set a budget, upload creative, and watch plays and scans come in live.',
  },
};

function parseKpi(str) {
  const m = str.match(/^([^\d]*)([\d,]+)(.*)$/);
  if (!m) return { prefix: '', target: 0, suffix: str, hasComma: false };
  const [, prefix, digits, suffix] = m;
  return { prefix, target: parseInt(digits.replace(/,/g, ''), 10), suffix, hasComma: digits.includes(',') };
}

function formatKpi(parsed, value) {
  const rounded = Math.round(value);
  const numStr = parsed.hasComma ? rounded.toLocaleString('en-US') : String(rounded);
  return `${parsed.prefix}${numStr}${parsed.suffix}`;
}

function Kpi({ label, value, active }) {
  const parsed = parseKpi(value);
  const animated = useCountUp(parsed.target, active);
  return (
    <div className="mock-kpi">
      <div className="k">{label}</div>
      <div className="v">{formatKpi(parsed, animated)}</div>
    </div>
  );
}

function MockRow({ name, pct, val, delay }) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div className={`mock-row rv ${entered ? 'on' : ''}`} style={{ transitionDelay: `${delay}ms` }}>
      <span className="dot" />
      <span className="name">{name}</span>
      <span className="bar"><i className={entered ? 'on' : ''} style={{ width: `${pct}%` }} /></span>
      <span className="val">{val}</span>
    </div>
  );
}

export function ProductShowcase() {
  const [ref, on] = useReveal();
  const [tab, setTab] = useState('operators');
  const t = TABS[tab];
  return (
    <section className="sec light" id="product" ref={ref}>
      <div className={`inner rv ${on ? 'on' : ''}`} style={{ textAlign: 'center' }}>
        <div className="eyebrow">The product</div>
        <h2 className="sec-h">One dashboard for each side of the marketplace</h2>
        <div className="toggle">
          <button className={tab === 'operators' ? 'on' : ''} onClick={() => setTab('operators')}>For operators</button>
          <button className={tab === 'advertisers' ? 'on' : ''} onClick={() => setTab('advertisers')}>For advertisers</button>
        </div>
        <div className="shot-frame">
          <div className="shot-bar"><span /><span /><span /></div>
          <div className="shot-stage" style={{ textAlign: 'left' }}>
            <div className="mock-kpis">
              {t.kpis.map(([k, v]) => (
                <Kpi key={`${tab}-${k}`} label={k} value={v} active={on} />
              ))}
            </div>
            {t.rows.map(([name, pct, val], i) => (
              <MockRow key={`${tab}-${name}`} name={name} pct={pct} val={val} delay={i * 80} />
            ))}
          </div>
        </div>
        <p className="sec-sub" style={{ margin: '20px auto 0' }}>{t.caption}</p>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Update `.mock-row .bar i` CSS in `marketing.css`**

Replace:
```css
.mock-row .bar i { display: block; height: 100%; background: var(--purple); border-radius: 3px; }
```
with:
```css
.mock-row .bar i {
  display: block; height: 100%; background: var(--purple); border-radius: 3px;
  transform-origin: left; transform: scaleX(0); transition: transform .6s ease;
}
.mock-row .bar i.on { transform: scaleX(1); }
```

- [ ] **Step 4: Lint**

Run: `npx eslint src/views/marketing/sections/useCountUp.js src/views/marketing/sections/ProductShowcase.jsx`
Expected: clean.

- [ ] **Step 5: Visual check**

Reload `/`, scroll the Product Showcase into view: confirm KPI numbers count up from 0, progress bars sweep in, rows fade in with a stagger. Click the "For advertisers" toggle: confirm the new tab's numbers/bars/rows animate in fresh (not just swap statically). Emulate reduced motion: confirm KPIs show final values immediately (no count-up) and bars/rows appear without animation.

- [ ] **Step 6: Commit**

```bash
git add src/views/marketing/sections/useCountUp.js src/views/marketing/sections/ProductShowcase.jsx src/views/marketing/marketing.css
git commit -m "feat(marketing): animated count-up KPIs, bars, and staggered rows in product showcase"
```

---

### Task 6: How It Works scroll-drawn flow diagram

**Files:**
- Modify: `src/views/marketing/sections/HowItWorks.jsx` (full rewrite)
- Modify: `src/views/marketing/marketing.css`

- [ ] **Step 1: Rewrite `HowItWorks.jsx`**

```jsx
import { useReveal } from './useReveal.js';

const TRACKS = [
  {
    label: 'For screen operators',
    steps: [
      ['Connect your screen', 'Pair any display in minutes. No proprietary hardware to buy.'],
      ['Set your rules', 'Floor price, allowed ad categories, blackout hours. You approve every ad before it plays.'],
      ['Get paid', 'Automatic payouts for every second of ad time sold. Track earnings per screen.'],
    ],
  },
  {
    label: 'For advertisers',
    steps: [
      ['Choose your venues', 'Filter by neighbourhood, venue type, and daily foot traffic.'],
      ['Set budget and schedule', 'Transparent per-slot pricing. No minimums, no long-term contracts.'],
      ['Measure what happens', 'Live playback logs and QR scan tracking for every campaign.'],
    ],
  },
];

function FlowDiagram() {
  return (
    <svg className="flow-diagram" viewBox="0 0 440 72" fill="none" aria-hidden="true">
      <rect x="8" y="20" width="48" height="32" rx="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M24 60h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path className="flow-line" d="M60 36H180" stroke="#7B2FFF" strokeWidth="2" strokeLinecap="round" pathLength="1" />
      <circle cx="220" cy="36" r="26" stroke="#7B2FFF" strokeWidth="1.5" />
      <text x="220" y="41" textAnchor="middle" fontSize="11" fontWeight="700" fill="#7B2FFF">AG</text>
      <path className="flow-line" d="M260 36H380" stroke="#7B2FFF" strokeWidth="2" strokeLinecap="round" pathLength="1" />
      <path d="M384 28h48v6l-4 4v20h-40V38l-4-4v-6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function HowItWorks() {
  const [ref, on] = useReveal();
  return (
    <section className="sec light" id="how" ref={ref}>
      <div className="inner" style={{ textAlign: 'center' }}>
        <div className={`rv ${on ? 'on' : ''}`}>
          <div className="eyebrow">How it works</div>
          <h2 className="sec-h">Two sides, one marketplace</h2>
          <div className={on ? 'flow-on' : ''}>
            <FlowDiagram />
          </div>
        </div>
        <div className="tracks" style={{ textAlign: 'left' }}>
          {TRACKS.map((track, ti) => (
            <div className={`track rv d${ti + 1} ${on ? 'on' : ''}`} key={track.label}>
              <div className="t-label">{track.label}</div>
              {track.steps.map((step, i) => {
                const [h, p] = step;
                return (
                  <div className="step" key={h}>
                    <div className="n">{i + 1}</div>
                    <div><h4>{h}</h4><p>{p}</p></div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Append flow-diagram CSS to `marketing.css`**

Insert after the existing `/* ── How it works ── */` block's media query line:

```css
.flow-diagram { display: block; margin: 16px auto 28px; color: var(--lmuted); width: 100%; max-width: 440px; height: auto; }
.flow-line { stroke-dasharray: 1; stroke-dashoffset: 1; transition: stroke-dashoffset .9s ease .3s; }
.flow-on .flow-line { stroke-dashoffset: 0; }
.flow-diagram rect, .flow-diagram path:not(.flow-line), .flow-diagram circle, .flow-diagram text {
  opacity: 0; transition: opacity .4s ease;
}
.flow-on .flow-diagram rect, .flow-on .flow-diagram path:not(.flow-line), .flow-on .flow-diagram circle, .flow-on .flow-diagram text {
  opacity: 1;
}
.flow-diagram circle, .flow-diagram text { transition-delay: .15s; }
.flow-diagram path:not(.flow-line):last-of-type { transition-delay: .3s; }
```

- [ ] **Step 3: Lint**

Run: `npx eslint src/views/marketing/sections/HowItWorks.jsx`
Expected: clean.

- [ ] **Step 4: Visual check**

Reload `/`, scroll How It Works into view: confirm the operator icon fades in first, the AdGrid mark slightly after, the two connecting lines draw themselves in, then the advertiser icon fades in — all before/alongside the two track cards below. Emulate reduced motion: confirm the diagram appears fully-formed instantly (no draw-in, no fade stagger) since the wildcard reduced-motion rule kills all `transition`s.

- [ ] **Step 5: Commit**

```bash
git add src/views/marketing/sections/HowItWorks.jsx src/views/marketing/marketing.css
git commit -m "feat(marketing): scroll-drawn flow diagram in how-it-works"
```

---

### Task 7: Full verification pass

- [ ] **Step 1: Lint the whole marketing directory**

Run: `npx eslint src/views/marketing/`
Expected: clean (no errors).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: succeeds (pre-existing chunk-size warning is fine, unrelated).

- [ ] **Step 3: Desktop pass (1440×900)**

Reload `/` in preview. Scroll the full page top to bottom. Confirm in order: hero zooms/parallaxes, gallery carousel auto-advances with working arrows/dots, marquee scrolls and pauses on hover, product showcase KPIs count up and tab-switch re-animates, operators image pins while cards scroll past, advertisers image pins on the right while its cards scroll past, how-it-works diagram draws in, market band / CTA / footer unchanged from the prior pass.

- [ ] **Step 4: Mobile pass (375×812)**

Confirm sticky sections fall back to stacked/static (no pinning), carousel and marquee still work, all text remains readable and nothing overlaps.

- [ ] **Step 5: Reduced-motion pass**

Emulate `prefers-reduced-motion: reduce` (via `preview_resize` or OS-level emulation). Confirm: hero image static (no zoom, no parallax drift), carousel auto-advance stopped (manual arrows/dots still work), marquee renders as a static wrapped row, product KPIs show final values immediately, bars/rows appear without transition, flow diagram appears fully drawn instantly. Nothing should look broken or half-rendered in this mode.

- [ ] **Step 6: Console + network check**

`preview_console_logs` (error level) clean; no failed image requests for the 2 new venue images.

- [ ] **Step 7: Push**

```bash
git push
```

---

## Self-Review Notes

- Spec coverage: gallery/marquee → Task 2, hero motion → Task 3, sticky sections → Task 4, product count-up → Task 5, flow diagram → Task 6, cross-cutting verification (including reduced-motion, which touches every task's output) → Task 7. All 5 spec sections covered.
- No new npm dependencies anywhere in this plan.
- Every new hook (`useParallax`, `useCountUp`) explicitly checks `prefers-reduced-motion` itself, on top of the existing blanket CSS override — belt and suspenders, matches spec's error-handling section.
- Type/signature consistency: `useCountUp(target, active, duration)` used identically in Task 5; `useParallax(factor)` used identically in Task 3; `Carousel({ slides })` shape (`src, alt, caption, width, height`) matches between Task 2's component definition and its `ProofStrip` usage.
- `.split`/`.split img` CSS is fully removed in Task 4 (not left dead) since `.sticky-split`/`.sticky-col`/`.scroll-col` replace it entirely.
