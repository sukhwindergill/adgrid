# AdGrid Landing Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the marketing landing page per `docs/superpowers/specs/2026-07-04-landing-redesign-design.md` — dark hero + light body, honest copy, photoreal creatives, minimal motion, Home.jsx split into section components.

**Architecture:** `src/views/marketing/Home.jsx` becomes a thin composition root importing section components from `src/views/marketing/sections/`. Styling moves from an injected CSS string to `src/views/marketing/marketing.css` (Vite CSS import). One shared `useReveal` hook drives the only scroll animation. Images live in `public/marketing/`.

**Tech Stack:** React 19, Vite, plain CSS, Supabase JS (live screen count), banana skill (Nano Banana) for creatives. No new npm dependencies.

**Verification model:** No test framework exists in this repo (lint + build only). Each task verifies via `npm run lint`, and visual tasks verify in the running preview (dev server on :5173). Final task does full-page screenshot verification at 1280px and 375px.

**Copy source of truth:** The copy deck in each task below is final. No "broken", "Finally.", "revolutionary", self-quotes, or invented metrics anywhere.

---

## File Structure

```
public/marketing/
  hero-gym.jpg            (new — Nano Banana creative #1)
  venue-barbershop.jpg    (new — creative #2)
  venue-cafe.jpg          (new — creative #3)
src/views/marketing/
  Home.jsx                (rewritten — thin composition root, keeps `MarketingHome` named export)
  marketing.css           (new — full reduced stylesheet)
  sections/
    useReveal.js          (new — IntersectionObserver reveal hook)
    icons.jsx             (new — stroke icon set)
    Nav.jsx               (new)
    Hero.jsx              (new)
    ProofStrip.jsx        (new — replaces TrustBar)
    ProductShowcase.jsx   (new — replaces ProductReel, light theme, toggle)
    HowItWorks.jsx        (new)
    OperatorsSection.jsx  (new)
    AdvertisersSection.jsx(new)
    MarketBand.jsx        (new — replaces OpportunitySection)
    CtaBand.jsx           (new — hosts existing waitlist form logic)
    Footer.jsx            (new)
```

`src/App.jsx:52` lazy-imports `m.MarketingHome` from `./views/marketing/Home.jsx` — export name and path must not change.

---

### Task 1: Generate photoreal creatives (banana skill)

**Files:**
- Create: `public/marketing/hero-gym.jpg`, `public/marketing/venue-barbershop.jpg`, `public/marketing/venue-cafe.jpg`

- [ ] **Step 1: Invoke the banana skill** three times with these briefs (photography mode, photoreal):

1. **hero-gym** (3:2 landscape): "Wide interior photo of a modern boutique gym. A wall-mounted 55-inch landscape digital signage display shows a vibrant fitness-apparel advertisement with bold purple (#7B2FFF) and white graphics and short headline text. One or two people work out, softly out of focus in the background. Natural daylight, cool colour grade, realistic reflections on the screen, photorealistic, 35mm."
2. **venue-barbershop** (3:2): "Interior photo of a stylish modern barbershop. A small landscape digital screen sits on the reception counter showing a local coffee-brand advertisement with purple-accented graphics. Barber chairs and warm wood tones softly out of focus behind. Natural window light, cool grade, photorealistic."
3. **venue-cafe** (3:2): "Photo of a café window-facing digital screen seen from the sidewalk at golden hour. The screen shows a local event advertisement with a visible QR code in the corner and purple-accented design. Reflections of the street on the glass, pedestrians blurred in motion, photorealistic."

- [ ] **Step 2: Review each image** — reject and regenerate if: screen content looks like UI/dashboard instead of an ad, text on screen is garbled beyond plausibility, anatomy artifacts, or grade wildly inconsistent between the three.

- [ ] **Step 3: Save to `public/marketing/`** with the exact filenames above. Check size: `ls -la public/marketing/` — each ≤ ~500KB. If larger, re-export/resize to ≤1600px wide.

- [ ] **Step 4: Commit**

```bash
git add public/marketing/
git commit -m "assets: photoreal venue creatives for landing redesign"
```

---

### Task 2: Stylesheet, reveal hook, icon set

**Files:**
- Create: `src/views/marketing/marketing.css`
- Create: `src/views/marketing/sections/useReveal.js`
- Create: `src/views/marketing/sections/icons.jsx`

- [ ] **Step 1: Write `marketing.css`** (complete file):

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

.mktg *, .mktg *::before, .mktg *::after { box-sizing: border-box; margin: 0; padding: 0; }

.mktg {
  --bg: #0A0A0F; --surface: #111118; --surf-el: #16161F; --border: #1E1E2E;
  --white: #FFFFFF; --sec: #8A8A9A; --muted: #55556A;
  --lbg: #fafafa; --lcard: #ffffff; --lborder: #e5e5e5; --ltext: #0a0a0a; --lsub: #525252; --lmuted: #737373;
  --purple: #7B2FFF; --purple-dark: #6B1FEF; --cyan: #00C2FF;
  --inter: 'Inter', -apple-system, sans-serif;
  --r: 14px; --r-btn: 8px;
  --maxw: 1160px;
  font-family: var(--inter);
}

/* ── Scroll reveal — the ONLY motion primitive ── */
.rv { opacity: 0; transform: translateY(8px); transition: opacity .4s ease-out, transform .4s ease-out; }
.rv.on { opacity: 1; transform: none; }
.d1 { transition-delay: .06s } .d2 { transition-delay: .12s }
@media (prefers-reduced-motion: reduce) {
  .mktg *, .mktg *::before, .mktg *::after { animation: none !important; transition: none !important; }
  .rv { opacity: 1; transform: none; }
}

/* ── Buttons ── */
.btn-p {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  background: var(--purple); color: #fff; padding: 13px 26px; border-radius: var(--r-btn);
  font: 600 15px/1 var(--inter); border: none; cursor: pointer; letter-spacing: -0.01em;
  white-space: nowrap; text-decoration: none; transition: background .15s ease;
}
.btn-p:hover { background: var(--purple-dark); }
.btn-s {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  background: transparent; color: #fff; padding: 13px 26px; border-radius: var(--r-btn);
  font: 500 15px/1 var(--inter); border: 1px solid var(--border); cursor: pointer;
  white-space: nowrap; text-decoration: none; transition: border-color .15s ease;
}
.btn-s:hover { border-color: var(--sec); }
.btn-s.light { color: var(--ltext); border-color: var(--lborder); }
.btn-s.light:hover { border-color: var(--lmuted); }

/* ── Nav ── */
.mnav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 50;
  background: rgba(10,10,15,0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}
.mnav .inner { max-width: var(--maxw); margin: 0 auto; display: flex; align-items: center; gap: 8px; padding: 0 24px; height: 64px; }
.mnav .logo { font: 700 20px/1 var(--inter); color: #fff; letter-spacing: -0.02em; cursor: pointer; margin-right: 24px; }
.nl { background: none; border: none; cursor: pointer; font: 500 14px/1 var(--inter); color: var(--sec); padding: 8px 12px; border-radius: 6px; transition: color .15s; white-space: nowrap; }
.nl:hover { color: #fff; }
.nav-spacer { flex: 1; }
@media (max-width: 768px) { .nav-mid { display: none; } }

/* ── Sections ── */
.sec { padding: 88px 24px; }
.sec .inner { max-width: var(--maxw); margin: 0 auto; }
.sec.light { background: var(--lbg); }
.sec.lcard-bg { background: var(--lcard); }
.sec.dark { background: var(--bg); }
.eyebrow { font: 600 12px/1 var(--inter); letter-spacing: 0.08em; text-transform: uppercase; color: var(--purple); margin-bottom: 14px; }
.dark .eyebrow { color: var(--cyan); }
.sec-h { font-weight: 700; font-size: clamp(30px, 4vw, 40px); letter-spacing: -0.02em; line-height: 1.12; color: var(--ltext); }
.dark .sec-h { color: #fff; }
.sec-sub { font-size: 17px; line-height: 1.6; color: var(--lsub); max-width: 560px; margin-top: 14px; }
.dark .sec-sub { color: var(--sec); }

/* ── Hero ── */
.hero { background: var(--bg); padding: 148px 24px 72px; position: relative; overflow: hidden; }
.hero::before {
  content: ''; position: absolute; inset: 0; opacity: .3; pointer-events: none;
  background-image: linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: radial-gradient(ellipse 80% 60% at 50% 30%, #000 30%, transparent 75%);
  -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 30%, #000 30%, transparent 75%);
}
.hero .inner { max-width: var(--maxw); margin: 0 auto; position: relative; display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 56px; align-items: center; }
.hero-h { font-weight: 800; font-size: clamp(38px, 4.6vw, 58px); line-height: 1.06; letter-spacing: -0.03em; color: #fff; }
.hero-h .accent { background: linear-gradient(120deg, var(--cyan), var(--purple)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.hero-sub { font-size: 17px; line-height: 1.65; color: var(--sec); max-width: 480px; margin: 20px 0 32px; }
.hero-img { border-radius: 16px; border: 1px solid var(--border); width: 100%; height: auto; display: block; box-shadow: 0 24px 64px rgba(0,0,0,.5); }
.hero-stats { display: flex; gap: 32px; margin-top: 36px; flex-wrap: wrap; }
.hero-stat .num { font: 700 22px/1.2 var(--inter); color: #fff; letter-spacing: -0.01em; }
.hero-stat .lbl { font-size: 13px; color: var(--sec); margin-top: 3px; }
@media (max-width: 900px) { .hero .inner { grid-template-columns: 1fr; gap: 40px; } .hero { padding-top: 120px; } }

/* ── Proof strip ── */
.venue-row { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; margin-top: 28px; }
.venue-chip {
  display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px;
  background: var(--lcard); border: 1px solid var(--lborder); border-radius: 100px;
  font: 500 14px/1 var(--inter); color: var(--lsub);
}
.venue-chip svg { color: var(--purple); }

/* ── Cards ── */
.card-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-top: 40px; }
.f-card { background: var(--lcard); border: 1px solid var(--lborder); border-radius: var(--r); padding: 26px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.f-card svg { color: var(--purple); margin-bottom: 14px; }
.f-card h3 { font: 600 17px/1.3 var(--inter); color: var(--ltext); margin-bottom: 8px; letter-spacing: -0.01em; }
.f-card p { font-size: 14.5px; line-height: 1.6; color: var(--lsub); }
@media (max-width: 768px) { .card-grid { grid-template-columns: 1fr; } }

/* ── Split feature (image + content) ── */
.split { display: grid; grid-template-columns: 1fr 1fr; gap: 56px; align-items: center; }
.split img { width: 100%; height: auto; border-radius: 16px; border: 1px solid var(--lborder); display: block; }
@media (max-width: 900px) { .split { grid-template-columns: 1fr; gap: 32px; } }

/* ── How it works ── */
.tracks { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 44px; }
.track { background: var(--lcard); border: 1px solid var(--lborder); border-radius: var(--r); padding: 30px; }
.track > .t-label { font: 600 13px/1 var(--inter); text-transform: uppercase; letter-spacing: .07em; color: var(--purple); margin-bottom: 22px; }
.step { display: flex; gap: 16px; }
.step + .step { margin-top: 22px; }
.step .n {
  flex-shrink: 0; width: 28px; height: 28px; border-radius: 50%;
  background: #f0ebff; color: var(--purple); font: 700 13px/28px var(--inter); text-align: center;
}
.step h4 { font: 600 15.5px/1.4 var(--inter); color: var(--ltext); }
.step p { font-size: 14px; line-height: 1.55; color: var(--lsub); margin-top: 3px; }
@media (max-width: 768px) { .tracks { grid-template-columns: 1fr; } }

/* ── Product showcase ── */
.toggle { display: inline-flex; background: var(--lcard); border: 1px solid var(--lborder); border-radius: 100px; padding: 4px; margin-top: 28px; }
.toggle button { border: none; background: none; cursor: pointer; padding: 9px 22px; border-radius: 100px; font: 600 14px/1 var(--inter); color: var(--lsub); transition: background .15s, color .15s; }
.toggle button.on { background: var(--purple); color: #fff; }
.shot-frame { margin-top: 36px; background: var(--lcard); border: 1px solid var(--lborder); border-radius: 16px; overflow: hidden; box-shadow: 0 12px 40px rgba(0,0,0,0.08); }
.shot-bar { display: flex; gap: 6px; padding: 12px 16px; border-bottom: 1px solid var(--lborder); }
.shot-bar span { width: 10px; height: 10px; border-radius: 50%; background: var(--lborder); }
.shot-stage { padding: clamp(18px, 3vw, 34px); background: var(--lbg); }
.mock-kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 16px; }
.mock-kpi { background: var(--lcard); border: 1px solid var(--lborder); border-radius: 10px; padding: 14px 16px; }
.mock-kpi .k { font: 500 11px/1 var(--inter); letter-spacing: .06em; text-transform: uppercase; color: var(--lmuted); }
.mock-kpi .v { font: 700 20px/1.3 var(--inter); color: var(--ltext); margin-top: 6px; }
.mock-row { display: flex; align-items: center; gap: 14px; background: var(--lcard); border: 1px solid var(--lborder); border-radius: 10px; padding: 13px 16px; }
.mock-row + .mock-row { margin-top: 10px; }
.mock-row .dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; flex-shrink: 0; }
.mock-row .name { font: 500 14px/1.3 var(--inter); color: var(--ltext); flex: 1; }
.mock-row .bar { flex: 2; height: 6px; border-radius: 3px; background: var(--lborder); overflow: hidden; }
.mock-row .bar i { display: block; height: 100%; background: var(--purple); border-radius: 3px; }
.mock-row .val { font: 600 14px/1 var(--inter); color: var(--ltext); min-width: 64px; text-align: right; }
@media (max-width: 600px) { .mock-kpis { grid-template-columns: 1fr; } .mock-row .bar { display: none; } }

/* ── Market band ── */
.market-band { background: var(--lcard); border-top: 1px solid var(--lborder); border-bottom: 1px solid var(--lborder); padding: 44px 24px; }
.market-band p { max-width: 720px; margin: 0 auto; text-align: center; font-size: 17px; line-height: 1.65; color: var(--lsub); }
.market-band strong { color: var(--ltext); font-weight: 600; }

/* ── CTA band / forms ── */
.fi {
  width: 100%; background: var(--surf-el); border: 1px solid var(--border); border-radius: var(--r-btn);
  padding: 13px 15px; font: 400 15px/1.4 var(--inter); color: #fff; outline: none;
  transition: border-color .15s, box-shadow .15s;
}
.fi:focus { border-color: var(--purple); box-shadow: 0 0 0 3px rgba(123,47,255,0.15); }
.fi::placeholder { color: var(--muted); }
select.fi { appearance: none; cursor: pointer; }
.form-card { max-width: 620px; margin: 44px auto 0; background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: clamp(28px, 5vw, 44px); text-align: left; }
.form-label { display: block; font: 500 13.5px/1 var(--inter); color: #fff; margin-bottom: 8px; }
.form-field { margin-bottom: 18px; }

/* ── Footer ── */
.mfooter { background: var(--bg); border-top: 1px solid var(--border); padding: 56px 24px 32px; }
.mfooter .inner { max-width: var(--maxw); margin: 0 auto; }
.mfooter .top { display: flex; justify-content: space-between; gap: 40px; flex-wrap: wrap; }
.mfooter .logo { font: 700 20px/1 var(--inter); color: #fff; letter-spacing: -0.02em; }
.mfooter .tagline { font-size: 14px; color: var(--sec); margin-top: 10px; max-width: 280px; line-height: 1.6; }
.mfooter .cols { display: flex; gap: 64px; flex-wrap: wrap; }
.mfooter .col h5 { font: 600 12px/1 var(--inter); letter-spacing: .07em; text-transform: uppercase; color: var(--muted); margin-bottom: 14px; }
.mfooter .col a, .mfooter .col button { display: block; background: none; border: none; cursor: pointer; text-align: left; font: 400 14px/1 var(--inter); color: var(--sec); text-decoration: none; padding: 0; margin-bottom: 11px; transition: color .15s; }
.mfooter .col a:hover, .mfooter .col button:hover { color: #fff; }
.mfooter .base { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; border-top: 1px solid var(--border); margin-top: 44px; padding-top: 24px; font-size: 13px; color: var(--muted); }
```

- [ ] **Step 2: Write `sections/useReveal.js`** (complete file):

```js
import { useEffect, useRef, useState } from 'react';

// Reveal-on-scroll: returns [ref, on]. Element fades up once when ≥`threshold` visible.
export function useReveal(threshold = 0.15) {
  const ref = useRef(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setOn(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, on];
}
```

- [ ] **Step 3: Write `sections/icons.jsx`** — one shared `<I>` wrapper, named 24px/1.5px-stroke icons (complete file):

```jsx
const I = ({ size = 22, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export const IconTrend    = p => <I {...p}><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></I>;
export const IconShield   = p => <I {...p}><path d="M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z"/></I>;
export const IconChart    = p => <I {...p}><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/></I>;
export const IconBolt     = p => <I {...p}><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/></I>;
export const IconPin      = p => <I {...p}><path d="M12 21s-7-5.5-7-11a7 7 0 1114 0c0 5.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></I>;
export const IconTagPrice = p => <I {...p}><path d="M20 13l-7 7-9-9V4h7l9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/></I>;
export const IconQr       = p => <I {...p}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM18 18h3v3h-3z"/></I>;
export const IconClock    = p => <I {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></I>;
export const IconDumbbell = p => <I {...p}><path d="M6 7v10M18 7v10M3 9v6M21 9v6M6 12h12"/></I>;
export const IconCoffee   = p => <I {...p}><path d="M4 8h13v6a5 5 0 01-5 5H9a5 5 0 01-5-5V8z"/><path d="M17 9h2a2.5 2.5 0 010 5h-2"/><path d="M7 3v2M11 3v2M15 3v2"/></I>;
export const IconScissors = p => <I {...p}><circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8 7.5L20 19M8 16.5L20 5"/></I>;
export const IconCross    = p => <I {...p}><path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7V3z"/></I>;
export const IconBus      = p => <I {...p}><rect x="4" y="3" width="16" height="14" rx="2"/><path d="M4 9h16"/><circle cx="8" cy="20" r="1.5"/><circle cx="16" cy="20" r="1.5"/></I>;
export const IconBag      = p => <I {...p}><path d="M5 8h14l-1 12H6L5 8z"/><path d="M8 8V6a4 4 0 018 0v2"/></I>;
export const IconBed      = p => <I {...p}><path d="M3 18V7"/><path d="M3 13h18v5"/><path d="M3 11h8V9a2 2 0 00-2-2H3"/></I>;
export const IconCap      = p => <I {...p}><path d="M2 9l10-5 10 5-10 5L2 9z"/><path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5"/></I>;
export const IconCheck    = p => <I {...p}><path d="M4 12l5 5L20 6"/></I>;
export const IconArrow    = p => <I {...p}><path d="M5 12h14M13 6l6 6-6 6"/></I>;
```

- [ ] **Step 4: Lint** — `npm run lint`. Expected: passes (new files unused yet; if `no-unused-vars` flags them, that clears in later tasks — only fix real syntax errors now).

- [ ] **Step 5: Commit**

```bash
git add src/views/marketing/marketing.css src/views/marketing/sections/
git commit -m "feat(marketing): stylesheet, reveal hook, icon set for landing redesign"
```

---

### Task 3: Nav + Hero

**Files:**
- Create: `src/views/marketing/sections/Nav.jsx`
- Create: `src/views/marketing/sections/Hero.jsx`

- [ ] **Step 1: Write `Nav.jsx`.** Structure: fixed `.mnav`, inner flex — logo "AdGrid" (click → scroll top), `.nav-mid` links (For operators → `#operators`, For advertisers → `#advertisers`, How it works → `#how`), spacer, `.nl` Sign in (calls `onLogin`), `.btn-p` "Join the waitlist" (scroll → `#waitlist-form`). Props: `{ onScrollTo, onLogin }`. No hamburger (mid links hide on mobile; Sign in + CTA remain).

```jsx
export function Nav({ onScrollTo, onLogin }) {
  return (
    <nav className="mnav">
      <div className="inner">
        <div className="logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>AdGrid</div>
        <div className="nav-mid">
          <button className="nl" onClick={() => onScrollTo('operators')}>For operators</button>
          <button className="nl" onClick={() => onScrollTo('advertisers')}>For advertisers</button>
          <button className="nl" onClick={() => onScrollTo('how')}>How it works</button>
        </div>
        <div className="nav-spacer" />
        <button className="nl" onClick={onLogin}>Sign in</button>
        <button className="btn-p" onClick={() => onScrollTo('waitlist-form')}>Join the waitlist</button>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Write `Hero.jsx`.** Two-column `.hero`. Left column: `.eyebrow` "Canada's OOH marketplace"; `.hero-h` headline `Canada's screens. Canada's brands. <span className="accent">One marketplace.</span>` (the page's single gradient use); `.hero-sub`: **"The self-serve marketplace where Canadian screen operators sell ad time and local advertisers buy it. Real-time pricing, full control on both sides."**; CTAs: `.btn-p` "List your screens" → `#waitlist-form`, `.btn-s` "Book a campaign" → `#advertisers`; `.hero-stats` with three `.hero-stat` items:
  - live screen count from Supabase (`screens` table, `status = 'live'`, head count — same query as old TrustBar). Render the stat only when count is a number ≥ 1; otherwise omit the entire stat item (never a fake number).
  - "Toronto & Vancouver" / "Launch cities"
  - "8" / "Venue categories"

  Right column: `<img className="hero-img" src="/marketing/hero-gym.jpg" alt="Digital ad screen mounted in a gym" width="1600" height="1067" fetchPriority="high" />`.
  Whole section wrapped in a single mount-fade (add `rv on` via `useEffect` after mount, or CSS-only: apply `.rv.on` classes with a `requestAnimationFrame` toggle). No other animation.

```jsx
import { useEffect, useState } from 'react';

export function Hero({ onScrollTo }) {
  const [liveCount, setLiveCount] = useState(null);
  const [mounted, setMounted] = useState(false);

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
        <img className="hero-img" src="/marketing/hero-gym.jpg"
          alt="Digital ad screen mounted in a gym" width="1600" height="1067" fetchPriority="high" />
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/views/marketing/sections/Nav.jsx src/views/marketing/sections/Hero.jsx
git commit -m "feat(marketing): nav and hero sections"
```

---

### Task 4: ProofStrip + ProductShowcase

**Files:**
- Create: `src/views/marketing/sections/ProofStrip.jsx`
- Create: `src/views/marketing/sections/ProductShowcase.jsx`

- [ ] **Step 1: Write `ProofStrip.jsx`** — first light section. Centered `.sec.light`: `.sec-h` (smaller, 24px override inline) **"Screens where people actually spend time"**, then `.venue-row` of 8 `.venue-chip`s with icons: Gyms (IconDumbbell), Cafés (IconCoffee), Salons & barbershops (IconScissors), Clinics (IconCross), Transit (IconBus), Retail (IconBag), Hotels (IconBed), Campuses (IconCap). Uses `useReveal`.

```jsx
import { useReveal } from './useReveal.js';
import { IconDumbbell, IconCoffee, IconScissors, IconCross, IconBus, IconBag, IconBed, IconCap } from './icons.jsx';

const VENUES = [
  ['Gyms', IconDumbbell], ['Cafés', IconCoffee], ['Salons & barbershops', IconScissors],
  ['Clinics', IconCross], ['Transit', IconBus], ['Retail', IconBag],
  ['Hotels', IconBed], ['Campuses', IconCap],
];

export function ProofStrip() {
  const [ref, on] = useReveal();
  return (
    <section className="sec light" ref={ref} style={{ padding: '56px 24px', textAlign: 'center' }}>
      <div className={`inner rv ${on ? 'on' : ''}`}>
        <h2 className="sec-h" style={{ fontSize: 24 }}>Screens where people actually spend time</h2>
        <div className="venue-row">
          {VENUES.map(([label, Icon]) => (
            <span className="venue-chip" key={label}><Icon size={17} /> {label}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Write `ProductShowcase.jsx`** — light section, id `product`. Header: eyebrow **"The product"**, `.sec-h` **"One dashboard for each side of the marketplace"**. `.toggle` with two buttons: "For operators" / "For advertisers" (useState, default operators — no auto-rotate). `.shot-frame` (3 dots bar + `.shot-stage`) rendering per tab:
  - **Operators tab:** `.mock-kpis`: Screens live "3", Fill rate "80%", This month "$6,075". `.mock-rows`: Queen St & Spadina (82% bar, $1,240), Union Station Concourse (91%, $2,860), Yonge-Dundas Square (67%, $1,975). Caption under frame: **"List inventory, set floor prices, approve every ad, and track earnings per screen."**
  - **Advertisers tab:** `.mock-kpis`: Active campaigns "2", Plays today "1,431", QR scans "96". `.mock-rows`: Downtown coffee launch (74% bar, 512 plays), Weekend class promo (58%, 344 plays), Neighbourhood open house (41%, 187 plays). Caption: **"Pick venues, set a budget, upload creative, and watch plays and scans come in live."**

  Numbers are internally consistent demo data in a clearly-labeled product mock — captions refer to product capability, not claimed scale. Uses `useReveal`.

```jsx
import { useState } from 'react';
import { useReveal } from './useReveal.js';

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
                <div className="mock-kpi" key={k}><div className="k">{k}</div><div className="v">{v}</div></div>
              ))}
            </div>
            {t.rows.map(([name, pct, val]) => (
              <div className="mock-row" key={name}>
                <span className="dot" />
                <span className="name">{name}</span>
                <span className="bar"><i style={{ width: `${pct}%` }} /></span>
                <span className="val">{val}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="sec-sub" style={{ margin: '20px auto 0' }}>{t.caption}</p>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/views/marketing/sections/ProofStrip.jsx src/views/marketing/sections/ProductShowcase.jsx
git commit -m "feat(marketing): proof strip and product showcase sections"
```

---

### Task 5: HowItWorks

**Files:**
- Create: `src/views/marketing/sections/HowItWorks.jsx`

- [ ] **Step 1: Write `HowItWorks.jsx`** — light section, id `how`, centered header: eyebrow **"How it works"**, `.sec-h` **"Two sides, one marketplace"**. `.tracks` grid with two `.track` cards:

  **Operators track** (label "For screen operators"):
  1. **Connect your screen** — "Pair any display in minutes. No proprietary hardware to buy."
  2. **Set your rules** — "Floor price, allowed ad categories, blackout hours. You approve every ad before it plays."
  3. **Get paid** — "Automatic payouts for every second of ad time sold. Track earnings per screen."

  **Advertisers track** (label "For advertisers"):
  1. **Choose your venues** — "Filter by neighbourhood, venue type, and daily foot traffic."
  2. **Set budget and schedule** — "Transparent per-slot pricing. No minimums, no long-term contracts."
  3. **Measure what happens** — "Live playback logs and QR scan tracking for every campaign."

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

export function HowItWorks() {
  const [ref, on] = useReveal();
  return (
    <section className="sec light" id="how" ref={ref}>
      <div className="inner" style={{ textAlign: 'center' }}>
        <div className={`rv ${on ? 'on' : ''}`}>
          <div className="eyebrow">How it works</div>
          <h2 className="sec-h">Two sides, one marketplace</h2>
        </div>
        <div className="tracks" style={{ textAlign: 'left' }}>
          {TRACKS.map((track, ti) => (
            <div className={`track rv d${ti + 1} ${on ? 'on' : ''}`} key={track.label}>
              <div className="t-label">{track.label}</div>
              {track.steps.map(([h, p], i) => (
                <div className="step" key={h}>
                  <div className="n">{i + 1}</div>
                  <div><h4>{h}</h4><p>{p}</p></div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/views/marketing/sections/HowItWorks.jsx
git commit -m "feat(marketing): how-it-works section"
```

---

### Task 6: OperatorsSection + AdvertisersSection

**Files:**
- Create: `src/views/marketing/sections/OperatorsSection.jsx`
- Create: `src/views/marketing/sections/AdvertisersSection.jsx`

- [ ] **Step 1: Write `OperatorsSection.jsx`** — light section (`.sec.lcard-bg` for alternating background), id `operators`. `.split`: left = image `/marketing/venue-barbershop.jpg` (`alt="Digital ad screen on a barbershop counter"`, `loading="lazy"`, width/height 1600×1067); right = eyebrow **"For operators"**, `.sec-h` **"Your screens. Your rules. New revenue."**, `.sec-sub` **"Turn idle screen time into income without giving up control of what plays in your venue."**, then `.card-grid` (grid moves below the split on its own row — place it after the `.split` div, full width) with 4 `.f-card`s:
  - IconTrend — **Dynamic pricing** — "Set a floor price and let demand move it up. Event nights and rush hours price themselves."
  - IconShield — **Full approval control** — "Approve or reject every ad. Block categories and competitors. Set blackout windows."
  - IconChart — **Real-time analytics** — "Fill rate, revenue trends, and playback proof — per screen, per day."
  - IconBolt — **No lock-in** — "Connect in minutes. No long-term contracts, no upfront costs."
  CTA under cards: `.btn-p` "Join the operator waitlist" → `#waitlist-form`. Props: `{ onScrollTo }`.

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
        <div className={`split rv ${on ? 'on' : ''}`}>
          <img src="/marketing/venue-barbershop.jpg" alt="Digital ad screen on a barbershop counter"
            loading="lazy" width="1600" height="1067" />
          <div>
            <div className="eyebrow">For operators</div>
            <h2 className="sec-h">Your screens. Your rules. New revenue.</h2>
            <p className="sec-sub">Turn idle screen time into income without giving up control of what plays in your venue.</p>
          </div>
        </div>
        <div className={`card-grid rv d1 ${on ? 'on' : ''}`}>
          {CARDS.map(([Icon, h, p]) => (
            <div className="f-card" key={h}><Icon /><h3>{h}</h3><p>{p}</p></div>
          ))}
        </div>
        <div className={`rv d2 ${on ? 'on' : ''}`} style={{ marginTop: 32 }}>
          <button className="btn-p" onClick={() => onScrollTo('waitlist-form')}>Join the operator waitlist</button>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Write `AdvertisersSection.jsx`** — same structure, `.sec.light`, id `advertisers`, image on the RIGHT side of `.split` (put the text div first): `/marketing/venue-cafe.jpg` (`alt="Café window screen showing an ad with a QR code"`, lazy). Eyebrow **"For advertisers"**, `.sec-h` **"Local reach you can actually measure"**, `.sec-sub` **"Put your brand on real screens in the neighbourhoods your customers live in — and see exactly what it did."** Cards:
  - IconPin — **Hyper-local targeting** — "Pick the exact venues your customers already visit, down to the block."
  - IconTagPrice — **Transparent pricing** — "See the price per slot before you book. Pay only for played time."
  - IconQr — **Scan-level measurement** — "Every campaign gets a unique QR code. Track scans by screen and by hour."
  - IconClock — **Live in days** — "Upload creative, get approved, go live. No agencies, no RFPs."
  No CTA button in this section (waitlist is operator-focused; advertisers CTA comes at CTA band).

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
        <div className={`split rv ${on ? 'on' : ''}`}>
          <div>
            <div className="eyebrow">For advertisers</div>
            <h2 className="sec-h">Local reach you can actually measure</h2>
            <p className="sec-sub">Put your brand on real screens in the neighbourhoods your customers live in — and see exactly what it did.</p>
          </div>
          <img src="/marketing/venue-cafe.jpg" alt="Café window screen showing an ad with a QR code"
            loading="lazy" width="1600" height="1067" />
        </div>
        <div className={`card-grid rv d1 ${on ? 'on' : ''}`}>
          {CARDS.map(([Icon, h, p]) => (
            <div className="f-card" key={h}><Icon /><h3>{h}</h3><p>{p}</p></div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/views/marketing/sections/OperatorsSection.jsx src/views/marketing/sections/AdvertisersSection.jsx
git commit -m "feat(marketing): operators and advertisers sections"
```

---

### Task 7: MarketBand + CtaBand + Footer

**Files:**
- Create: `src/views/marketing/sections/MarketBand.jsx`
- Create: `src/views/marketing/sections/CtaBand.jsx`
- Create: `src/views/marketing/sections/Footer.jsx`

- [ ] **Step 1: Write `MarketBand.jsx`** — slim `.market-band`, single paragraph (replaces the whole OpportunitySection + self-quote):

```jsx
import { useReveal } from './useReveal.js';

export function MarketBand() {
  const [ref, on] = useReveal();
  return (
    <div className="market-band" ref={ref}>
      <p className={`rv ${on ? 'on' : ''}`}>
        <strong>Out-of-home advertising in Canada is a billion-dollar market</strong> — and most of
        it is still bought over email, phone calls, and PDFs. AdGrid brings it online.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Write `CtaBand.jsx`** — dark `.sec.dark`, id `waitlist-form`. Header: eyebrow **"Early operator access"**, `.sec-h` **"Launching in Toronto and Vancouver"**, `.sec-sub` (centered) **"We're onboarding a first group of screen operators before public launch. Early operators get priority placement and hands-on onboarding support."** (removed unverifiable "preferred revenue share" claim). Then `.form-card` containing the waitlist form ported from `Home.jsx:1499-1659` with these changes ONLY:
  - Remove the gradient border wrapper (`borderRotate` animation div) — plain `.form-card`.
  - Submit button: `.btn-p` full width, label **"Join the operator waitlist"** (no arrow glyph).
  - Success state: replace gradient circle + ✓ emoji with a solid purple circle containing `IconCheck`; heading **"You're on the list."**; body **"We'll be in touch with next steps as we onboard operators in your city."**; DELETE the dead "Follow Adgrid on LinkedIn →" link (`href="#"`).
  - Form state/submit logic (`form`, `set`, `handleSubmit`, `submitted`) copied verbatim — behavior unchanged.
  - Keep the privacy line, but link the words "Privacy Policy" to `/privacy` via `react-router-dom` `Link`.
  - All labels/inputs/selects keep their ids, options, and required flags exactly as in the original (fields: name, email, company, city select, screens select, source).

- [ ] **Step 3: Write `Footer.jsx`** — `.mfooter`, props `{ onLogin }`. Top: logo "AdGrid" + tagline **"The self-serve marketplace for digital out-of-home advertising in Canada."**; columns: **Platform** (For operators → `#operators`, For advertisers → `#advertisers`, How it works → `#how` — buttons calling `onScrollTo`; add prop), **Account** (Sign in → `onLogin`, Join the waitlist → `#waitlist-form`), **Legal** (Privacy Policy → `/privacy`, Terms of Service → `/terms` via `Link`). Base row: `© {new Date().getFullYear()} AdGrid` + "Made in Canada" (text, no emoji). Update props to `{ onLogin, onScrollTo }`.

- [ ] **Step 4: Commit**

```bash
git add src/views/marketing/sections/MarketBand.jsx src/views/marketing/sections/CtaBand.jsx src/views/marketing/sections/Footer.jsx
git commit -m "feat(marketing): market band, CTA band with waitlist form, footer"
```

---

### Task 8: Composition root — rewrite Home.jsx

**Files:**
- Rewrite: `src/views/marketing/Home.jsx` (1,960 lines → ~50)

- [ ] **Step 1: Rewrite `Home.jsx`** (complete file):

```jsx
import { useNavigate } from 'react-router-dom';
import './marketing.css';
import { Nav } from './sections/Nav.jsx';
import { Hero } from './sections/Hero.jsx';
import { ProofStrip } from './sections/ProofStrip.jsx';
import { ProductShowcase } from './sections/ProductShowcase.jsx';
import { HowItWorks } from './sections/HowItWorks.jsx';
import { OperatorsSection } from './sections/OperatorsSection.jsx';
import { AdvertisersSection } from './sections/AdvertisersSection.jsx';
import { MarketBand } from './sections/MarketBand.jsx';
import { CtaBand } from './sections/CtaBand.jsx';
import { Footer } from './sections/Footer.jsx';

export function MarketingHome({ onLogin: onLoginProp }) {
  const navigate = useNavigate();
  const onLogin = onLoginProp ?? (() => navigate('/login'));

  const scrollTo = id => {
    const el = document.getElementById(id);
    if (!el) return;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 72, behavior: 'smooth' });
  };

  return (
    <div className="mktg" style={{ background: 'var(--bg, #0A0A0F)', minHeight: '100vh' }}>
      <Nav onScrollTo={scrollTo} onLogin={onLogin} />
      <Hero onScrollTo={scrollTo} />
      <ProofStrip />
      <ProductShowcase />
      <HowItWorks />
      <OperatorsSection onScrollTo={scrollTo} />
      <AdvertisersSection />
      <MarketBand />
      <CtaBand />
      <Footer onLogin={onLogin} onScrollTo={scrollTo} />
    </div>
  );
}
```

Note: the old `onSignup` prop is unused at the call site (`App.jsx:438` renders `<MarketingHome />` bare) — drop it. Everything else from the old file (CSS string, CITY_PINS, REEL_*, NetworkMap, panels, TrustBar, OpportunitySection, all keyframe-driven components) is deleted.

- [ ] **Step 2: Search for orphaned references**

Run: `grep -rn "TrustBar\|ProductReel\|NetworkMap\|OpportunitySection\|adgrid-mktg-css" src/`
Expected: no matches outside marketing sections.

- [ ] **Step 3: Lint + build**

Run: `npm run lint` → passes. `npm run build` → succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/views/marketing/Home.jsx
git commit -m "feat(marketing): rewire Home.jsx as thin composition root, delete legacy page"
```

---

### Task 9: Visual verification + fixes

- [ ] **Step 1: Preview at 1280px** — dev server on :5173, reload `/`, screenshot every section (scroll through). Check: hero image loads, single gradient accent only, no emoji, stat row honest, toggle works, sections alternate dark→light→dark correctly, footer links navigate.
- [ ] **Step 2: Preview at 375px** — hero stacks, chips wrap, tracks stack, form usable.
- [ ] **Step 3: Console + network clean** — no errors; `/marketing/*.jpg` all 200.
- [ ] **Step 4: Interaction pass** — nav links scroll to correct sections; Sign in → `/login`; waitlist submit → success state; toggle switches tabs.
- [ ] **Step 5: Fix anything found, re-verify, then final commit**

```bash
git add -A
git commit -m "fix(marketing): visual polish from verification pass"
```

(Skip commit if nothing changed.)

---

## Self-Review Notes

- Spec coverage: every spec section maps to a task (creatives→T1, visual language→T2, nav/hero→T3, proof/product→T4, how→T5, operators/advertisers→T6, market/CTA/footer→T7, split/root→T8, verification→T9). Copy rules enforced in copy decks. Error handling (missing live count, image dims/lazy) in T3.
- The only gradient on the page: hero `.accent` span. Buttons solid purple everywhere.
- Old page's `2,400+ screens`, testimonials, self-quote, orbs/tilt/parallax/pulse: all deleted via T8 rewrite.
- Waitlist form behavior preserved (known non-persistence flagged as separate task, out of scope).
