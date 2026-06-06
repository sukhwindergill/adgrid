# Marketing Home — Canada OOH Marketplace Rebuild

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `src/views/marketing/Home.jsx` from a UK computer-vision DOOH site into the Canada OOH Marketplace per the Adgrid Master Brief.

**Architecture:** Single JSX file with inline CSS string + React components per section. All motion effects (animated grid, cursor glow, 3D tilt, spring reveals, gradient borders, parallax) implemented in CSS + vanilla JS via useEffect. No new dependencies.

**Tech Stack:** React, inline CSS string injected via useEffect, IntersectionObserver, requestAnimationFrame, CSS keyframe animations.

---

## File Structure

- **Modify:** `src/views/marketing/Home.jsx` — full rewrite. Remove Leaflet import. Keep `MarketingHome` named export with same `{ onSignup, onLogin }` props.

---

### Task 1: Design System CSS + Global Effects

**Files:**
- Modify: `src/views/marketing/Home.jsx`

- [ ] **Step 1: Replace the entire CSS constant** with the new design system. Paste this as the `CSS` constant at the top of the file (after removing the old one):

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:      #0A0A0F;
  --surface: #111118;
  --surf-el: #16161F;
  --border:  #1E1E2E;
  --white:   #FFFFFF;
  --sec:     #8A8A9A;
  --muted:   #4A4A5A;
  --c1:      #00C2FF;
  --c2:      #7B2FFF;
  --grad:    linear-gradient(135deg, #00C2FF 0%, #7B2FFF 100%);
  --success: #00E5A0;
  --warning: #FFB800;
  --error:   #FF4757;
  --inter:   'Inter', -apple-system, sans-serif;
  --r:       16px;
  --r-btn:   8px;
}

::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: var(--bg); }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

/* ── Keyframes ── */
@keyframes gridDrift {
  0%   { background-position: 0px 0px; }
  100% { background-position: 60px 60px; }
}
@keyframes borderRotate {
  0%, 100% { background-position: 0% 50%; }
  50%       { background-position: 100% 50%; }
}
@keyframes gradientShift {
  0%, 100% { background-position: 0% 50%; }
  50%       { background-position: 100% 50%; }
}
@keyframes ctaPulse {
  0%, 100% { box-shadow: 0 0 16px rgba(0,194,255,0.3), 0 0 32px rgba(123,47,255,0.15); }
  50%       { box-shadow: 0 0 32px rgba(0,194,255,0.5), 0 0 64px rgba(123,47,255,0.25); }
}
@keyframes pinPulse {
  0%, 100% { transform: scale(1);   opacity: 1; }
  50%       { transform: scale(1.4); opacity: 0.6; }
}
@keyframes ripple {
  0%   { transform: scale(1);   opacity: 0.4; }
  100% { transform: scale(2.5); opacity: 0; }
}
@keyframes orbDrift1 {
  0%, 100% { transform: translate(0,0); }
  33%       { transform: translate(-30px,20px); }
  66%       { transform: translate(20px,-25px); }
}
@keyframes orbDrift2 {
  0%, 100% { transform: translate(0,0); }
  33%       { transform: translate(40px,-20px); }
  66%       { transform: translate(-15px,35px); }
}
@keyframes orbDrift3 {
  0%, 100% { transform: translate(0,0); }
  50%       { transform: translate(-35px,-20px); }
}
@keyframes wordReveal {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-80px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes chevronBounce {
  0%, 100% { transform: translate(-50%, 0); }
  50%       { transform: translate(-50%, 6px); }
}

/* ── Page load sequence ── */
.nav-load   { animation: slideDown 0.4s ease 0.1s both; }
.tag-load   { animation: fadeUp 0.3s ease 0.3s both; }
.sub-load   { animation: fadeUp 0.4s ease 0.75s both; }
.cta-load   { animation: scaleIn 0.35s ease 0.9s both; }
.badge-load { animation: fadeUp 0.3s ease 1.1s both; }
.orb-load   { animation: fadeUp 0.5s ease 1.3s both; }

/* ── Scroll reveal (spring physics feel) ── */
.rv {
  opacity: 0;
  transform: translateY(32px) scale(0.97);
  transition: opacity 0.6s cubic-bezier(0.34,1.56,0.64,1),
              transform 0.6s cubic-bezier(0.34,1.56,0.64,1);
  will-change: transform, opacity;
}
.rv.on { opacity: 1; transform: none; }
.d1{transition-delay:.06s} .d2{transition-delay:.12s} .d3{transition-delay:.18s}
.d4{transition-delay:.24s} .d5{transition-delay:.30s} .d6{transition-delay:.36s}

/* ── Gradient text (animated) ── */
.gradient-text {
  background: linear-gradient(135deg,#00C2FF,#7B2FFF,#00C2FF);
  background-size: 200% 200%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: gradientShift 5s ease infinite;
}

/* ── Gradient border cards ── */
.card-border {
  position: relative;
  border-radius: var(--r);
  background: var(--surface);
}
.card-border::before {
  content: '';
  position: absolute; inset: -1px;
  border-radius: calc(var(--r) + 1px);
  background: linear-gradient(135deg,#00C2FF,#7B2FFF,#00C2FF);
  background-size: 200% 200%;
  animation: borderRotate 4s ease infinite;
  z-index: -1; opacity: 0;
  transition: opacity 0.3s ease;
}
.card-border:hover::before   { opacity: 1; }
.card-border.always-on::before { opacity: 1; }

/* ── Buttons ── */
.btn-p {
  display: inline-flex; align-items: center; gap: 8px;
  background: linear-gradient(135deg,#00C2FF,#7B2FFF);
  color: #fff; padding: 14px 28px; border-radius: var(--r-btn);
  font-family: var(--inter); font-weight: 600; font-size: 16px;
  border: none; cursor: pointer; letter-spacing: -0.01em;
  white-space: nowrap; line-height: 1;
  animation: ctaPulse 2.5s ease-in-out infinite;
  will-change: box-shadow;
  transition: transform 0.2s, filter 0.2s;
}
.btn-p:hover {
  animation: none;
  box-shadow: 0 0 40px rgba(0,194,255,0.6);
  transform: translateY(-2px);
  filter: brightness(1.1);
}
.btn-s {
  display: inline-flex; align-items: center; gap: 8px;
  background: transparent; color: #fff;
  padding: 14px 28px; border-radius: var(--r-btn);
  font-family: var(--inter); font-weight: 500; font-size: 16px;
  border: 1px solid var(--border); cursor: pointer;
  white-space: nowrap; transition: all 0.2s;
}
.btn-s:hover { border-color: var(--c1); color: var(--c1); }
.btn-w {
  display: inline-flex; align-items: center; gap: 8px;
  background: #fff; color: #0A0A0F;
  padding: 14px 28px; border-radius: var(--r-btn);
  font-family: var(--inter); font-weight: 600; font-size: 16px;
  border: none; cursor: pointer; white-space: nowrap;
  transition: background 0.2s;
}
.btn-w:hover { background: #e8e8e8; }

/* ── Hero grid background ── */
.hero-bg-grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(#1E1E2E 1px, transparent 1px),
    linear-gradient(90deg, #1E1E2E 1px, transparent 1px);
  background-size: 60px 60px;
  animation: gridDrift 8s linear infinite;
  opacity: 0.35;
  will-change: background-position;
}

/* ── Screen pins ── */
.pin {
  position: absolute; width: 8px; height: 8px;
  background: var(--c1); border-radius: 50%;
  animation: pinPulse 2s ease-in-out infinite;
  will-change: transform, opacity;
}
.pin::after {
  content: ''; position: absolute; inset: -4px;
  border-radius: 50%; background: rgba(0,194,255,0.3);
  animation: ripple 2s ease-out infinite;
}

/* ── Nav links ── */
.nl {
  background: none; border: none; cursor: pointer;
  font-family: var(--inter); font-weight: 500; font-size: 15px;
  color: var(--sec); padding: 6px 16px; border-radius: 4px;
  transition: color 0.15s; white-space: nowrap;
}
.nl:hover { color: #fff; }

/* ── Tag badge ── */
.tag {
  display: inline-flex;
  background: rgba(0,194,255,0.1); border: 1px solid rgba(0,194,255,0.2);
  color: var(--c1); padding: 4px 12px; border-radius: 100px;
  font-family: var(--inter); font-weight: 600; font-size: 12px;
  text-transform: uppercase; letter-spacing: 0.08em;
}

/* ── Form inputs ── */
.fi {
  width: 100%; background: var(--surf-el); border: 1px solid var(--border);
  border-radius: var(--r-btn); padding: 14px 16px;
  font-family: var(--inter); font-size: 16px; color: #fff;
  outline: none; transition: border-color 0.2s, box-shadow 0.2s;
}
.fi:focus { border-color: var(--c1); box-shadow: 0 0 0 3px rgba(0,194,255,0.1); }
.fi::placeholder { color: var(--muted); }

/* ── Cursor glow ── */
body::before {
  content: ''; position: fixed; top: 0; left: 0;
  width: 100%; height: 100%;
  pointer-events: none; z-index: 1;
  background: radial-gradient(
    500px circle at var(--cursor-x,50%) var(--cursor-y,50%),
    rgba(0,194,255,0.04), transparent 70%
  );
}

/* ── Noise texture ── */
body::after {
  content: ''; position: fixed; inset: 0;
  pointer-events: none; z-index: 9999; opacity: 0.04;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  background-repeat: repeat; background-size: 128px;
}

/* ── Scroll indicator ── */
.scroll-ind {
  position: absolute; bottom: 32px; left: 50%;
  animation: chevronBounce 2s ease-in-out infinite;
  will-change: transform; cursor: pointer;
}

/* ── Feature card hover ── */
.feature-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r); padding: 28px;
  transition: border-color 0.2s, box-shadow 0.2s;
  transform-style: preserve-3d;
}
.feature-card:hover {
  border-color: rgba(0,194,255,0.3);
  box-shadow: 0 0 32px rgba(0,194,255,0.08);
}

/* ── Pull quote ── */
.pull-quote {
  border-left: 4px solid transparent;
  border-image: linear-gradient(to bottom, #00C2FF, #7B2FFF) 1;
  padding-left: 32px;
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .two-col    { grid-template-columns: 1fr !important; }
  .four-row   { grid-template-columns: 1fr 1fr !important; }
  .three-col  { grid-template-columns: 1fr !important; }
  .steps-flow { flex-direction: column !important; align-items: center !important; }
  .step-arrow { transform: rotate(90deg); }
  .hero-h     { font-size: 40px !important; line-height: 1.1 !important; }
  .sec-h      { font-size: 32px !important; }
  .s-pad      { padding-top: 64px !important; padding-bottom: 64px !important; }
  .cta-blk    { flex-direction: column !important; gap: 20px !important; align-items: flex-start !important; }
  .footer-upper { flex-direction: column !important; gap: 40px !important; }
  .footer-links { flex-direction: row !important; gap: 48px !important; }
  .nav-mid    { display: none !important; }
}
@media (max-width: 480px) {
  .four-row   { grid-template-columns: 1fr !important; }
  .dual-cta   { flex-direction: column !important; }
  .dual-cta .btn-p, .dual-cta .btn-s { width: 100%; justify-content: center; }
  .stat-row   { grid-template-columns: 1fr !important; }
  .footer-links { flex-direction: column !important; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 2: Replace imports** at top of file:

```jsx
import { useState, useEffect, useRef } from 'react';
```

(Remove `react-leaflet` import — no longer needed.)

- [ ] **Step 3: Commit**

```bash
git add src/views/marketing/Home.jsx
git commit -m "refactor: replace design system CSS for Canada OOH rebuild"
```

---

### Task 2: Hooks + City Pin Data

**Files:**
- Modify: `src/views/marketing/Home.jsx`

- [ ] **Step 1: Add Canadian screen pin positions** (used in hero background + S6):

```jsx
const CITY_PINS = [
  {x:22,y:25,delay:0},   {x:38,y:18,delay:0.3}, {x:55,y:22,delay:0.6},
  {x:70,y:30,delay:0.9}, {x:82,y:20,delay:1.2}, {x:18,y:42,delay:0.2},
  {x:32,y:48,delay:0.5}, {x:48,y:55,delay:0.8}, {x:63,y:45,delay:1.1},
  {x:77,y:52,delay:1.4}, {x:12,y:62,delay:0.4}, {x:28,y:68,delay:0.7},
  {x:42,y:72,delay:1.0}, {x:58,y:65,delay:0.1}, {x:73,y:70,delay:0.9},
  {x:86,y:40,delay:1.3}, {x:90,y:58,delay:0.6}, {x:8, y:35,delay:1.5},
  {x:95,y:25,delay:0.4}, {x:50,y:82,delay:0.7}, {x:35,y:85,delay:1.1},
  {x:65,y:82,delay:0.3}, {x:80,y:78,delay:0.8},
];
```

- [ ] **Step 2: Keep `useReveal` and replace `useCounter`** with the spec's version:

```jsx
function useReveal(threshold = 0.15) {
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

function useCounter(target, duration = 1500, started = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!started) return;
    let t0 = null;
    const step = (ts) => {
      if (!t0) t0 = ts;
      const p = Math.min((ts - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setVal(Math.round(eased * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [started, target, duration]);
  return val;
}
```

- [ ] **Step 3: Add `HeadlineReveal` helper** (word-by-word reveal with staggered animation):

```jsx
function HeadlineReveal({ lines, baseDelay = 0.45, style, className }) {
  let idx = 0;
  return (
    <h1 className={className} style={style}>
      {lines.map((line, li) => (
        <span key={li} style={{ display: 'block' }}>
          {line.split(' ').map((word, wi) => {
            const delay = baseDelay + (idx++) * 0.06;
            return (
              <span
                key={wi}
                style={{
                  display: 'inline-block',
                  animation: `wordReveal 0.4s cubic-bezier(.16,1,.3,1) ${delay}s both`,
                  marginRight: '0.25em',
                }}
              >
                {word}
              </span>
            );
          })}
        </span>
      ))}
    </h1>
  );
}
```

- [ ] **Step 4: Add `CityPins` helper component** (reused in hero + S6):

```jsx
function CityPins({ style }) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ...style }}>
      {CITY_PINS.map((p, i) => (
        <div
          key={i}
          className="pin"
          style={{
            left: `${p.x}%`, top: `${p.y}%`,
            '--pin-index': i,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/views/marketing/Home.jsx
git commit -m "refactor: hooks and city pin helpers for Canada rebuild"
```

---

### Task 3: Nav + Hero (S1)

**Files:**
- Modify: `src/views/marketing/Home.jsx`

- [ ] **Step 1: Write `Nav` component**. Sticky, blur bg on scroll, Canadian copy, mobile hamburger:

```jsx
function Nav({ onScrollTo, onLogin }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 32);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  const links = [
    ['For Operators',   'operators'],
    ['For Advertisers', 'advertisers'],
    ['How It Works',    'how-it-works'],
  ];

  return (
    <>
      <nav className="nav-load" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
        background: scrolled ? 'rgba(10,10,15,0.85)' : 'transparent',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        borderBottom: `1px solid ${scrolled ? '#1E1E2E' : 'transparent'}`,
        transition: 'all 0.25s ease',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 clamp(20px,4vw,80px)', height: 72,
      }}>
        <div style={{
          fontFamily: 'var(--inter)', fontSize: 22, fontWeight: 700, color: '#fff', cursor: 'pointer',
        }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          Adgrid
        </div>

        <div className="nav-mid" style={{ display: 'flex', gap: 4 }}>
          {links.map(([label, id]) => (
            <button key={id} className="nl" onClick={() => onScrollTo(id)}>{label}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {onLogin && (
            <button className="nl" onClick={onLogin} style={{ fontSize: 14 }}>Sign in</button>
          )}
          <button className="btn-p" onClick={() => onScrollTo('waitlist-form')}
            style={{ padding: '10px 20px', fontSize: 14 }}>
            Join the waitlist
          </button>
          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(v => !v)}
            style={{
              display: 'none', background: 'none', border: 'none', cursor: 'pointer',
              color: '#fff', fontSize: 24, lineHeight: 1,
            }}
            className="hamburger"
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {/* Mobile full-screen menu */}
      {menuOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 199,
          background: 'rgba(10,10,15,0.97)', backdropFilter: 'blur(20px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 32,
        }}>
          {links.map(([label, id]) => (
            <button key={id} onClick={() => { onScrollTo(id); setMenuOpen(false); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--inter)', fontWeight: 600, fontSize: 28, color: '#fff',
              }}>
              {label}
            </button>
          ))}
          <button className="btn-p" onClick={() => { onScrollTo('waitlist-form'); setMenuOpen(false); }}
            style={{ marginTop: 16 }}>
            Join the waitlist
          </button>
        </div>
      )}
    </>
  );
}
```

Add this CSS to the CSS constant (inside the responsive block):
```css
@media (max-width: 768px) {
  .hamburger { display: block !important; }
  .nav-mid   { display: none !important; }
}
```

- [ ] **Step 2: Write `Hero` component** — full viewport, city grid, word-by-word headline, dual CTA, launch badge:

```jsx
function Hero({ onScrollTo }) {
  const heroRef = useRef(null);

  return (
    <section style={{
      minHeight: '100svh', background: 'var(--bg)', paddingTop: 72,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Animated grid */}
      <div className="hero-bg-grid" />

      {/* City screen pins */}
      <div className="orb-load" style={{ position: 'absolute', inset: 0, opacity: 0.15, pointerEvents: 'none' }}>
        <CityPins />
      </div>

      {/* Glow orbs */}
      <div className="orb-load" style={{
        position: 'absolute', top: '-5%', left: '20%', width: 800, height: 800, pointerEvents: 'none',
        background: 'radial-gradient(ellipse, rgba(0,194,255,0.10) 0%, transparent 70%)',
        animation: 'orbDrift1 12s ease-in-out infinite',
        will-change: 'transform',
      }} />
      <div className="orb-load" style={{
        position: 'absolute', top: '30%', right: '-10%', width: 700, height: 700, pointerEvents: 'none',
        background: 'radial-gradient(ellipse, rgba(123,47,255,0.10) 0%, transparent 70%)',
        animation: 'orbDrift2 18s ease-in-out infinite',
        will-change: 'transform',
      }} />
      <div className="orb-load" style={{
        position: 'absolute', bottom: '10%', left: '-5%', width: 600, height: 600, pointerEvents: 'none',
        background: 'radial-gradient(ellipse, rgba(0,194,255,0.08) 0%, transparent 70%)',
        animation: 'orbDrift3 24s ease-in-out infinite',
        will-change: 'transform',
      }} />

      {/* Content */}
      <div ref={heroRef} className="hero-headline" style={{
        position: 'relative', zIndex: 2,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: 'calc(100svh - 72px)',
        padding: '48px clamp(20px,5vw,80px)',
        textAlign: 'center', maxWidth: 900, margin: '0 auto',
      }}>
        {/* Tag badge */}
        <div className="tag tag-load" style={{ marginBottom: 24 }}>
          Canada's OOH Marketplace
        </div>

        {/* Headline — VERBATIM */}
        <HeadlineReveal
          lines={["Canada's screens.", "Canada's brands.", "One marketplace."]}
          className="hero-h"
          style={{
            fontFamily: 'var(--inter)', fontWeight: 800,
            fontSize: 'clamp(40px,7vw,80px)', lineHeight: 1.05,
            letterSpacing: '-0.03em', color: '#fff', marginBottom: 24,
          }}
        />

        {/* Subhead */}
        <p className="sub-load" style={{
          fontFamily: 'var(--inter)', fontSize: 18, color: 'var(--sec)',
          lineHeight: 1.65, maxWidth: 600, marginBottom: 40,
        }}>
          Adgrid is the dynamic marketplace connecting digital screen operators with
          advertisers across Canada. Real-time pricing. Hyper-local targeting.
          Self-serve for everyone.
        </p>

        {/* Dual CTA */}
        <div className="dual-cta cta-load" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 24 }}>
          <button className="btn-p" onClick={() => onScrollTo('waitlist-form')}>
            List your screens →
          </button>
          <button className="btn-s" onClick={() => onScrollTo('advertisers')}>
            I'm an advertiser
          </button>
        </div>

        {/* Launch badge */}
        <div className="badge-load" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(255,255,255,0.05)', border: '1px solid #1E1E2E',
          borderRadius: 100, padding: '6px 16px',
          fontFamily: 'var(--inter)', fontSize: 14, color: 'var(--sec)',
        }}>
          🇨🇦 Launching in Toronto &amp; Vancouver
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="scroll-ind" onClick={() => onScrollTo('problem')}>
        <svg width="20" height="12" viewBox="0 0 20 12" fill="none">
          <path d="M1 1L10 11L19 1" stroke="#4A4A5A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/views/marketing/Home.jsx
git commit -m "feat: Nav and Hero section for Canada OOH rebuild"
```

---

### Task 4: Problem Section (S2) + How It Works (S3)

**Files:**
- Modify: `src/views/marketing/Home.jsx`

- [ ] **Step 1: Write `ProblemSection`** (two-column cards, cyan/violet accents):

```jsx
function ProblemSection() {
  const [ref, on] = useReveal();
  return (
    <section id="problem" ref={ref} style={{
      background: 'var(--bg)',
      padding: 'clamp(64px,10vw,100px) clamp(20px,5vw,80px)',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div className={`rv ${on?'on':''}`} style={{ textAlign: 'center', marginBottom: 48 }}>
          <div className="tag" style={{ marginBottom: 20 }}>The Problem</div>
          {/* VERBATIM */}
          <h2 className="sec-h" style={{
            fontFamily: 'var(--inter)', fontSize: 48, fontWeight: 700,
            color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.1,
          }}>
            OOH advertising is broken.<br />On both sides.
          </h2>
        </div>

        <div className="two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Operator card */}
          <div className={`rv d1 ${on?'on':''} card-border`} style={{
            borderLeft: '3px solid #00C2FF', padding: 40,
          }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>🖥️</div>
            <h3 style={{ fontFamily: 'var(--inter)', fontWeight: 600, fontSize: 20, color: '#fff', marginBottom: 16 }}>
              Your screens are underearning.
            </h3>
            <p style={{ fontFamily: 'var(--inter)', fontSize: 16, color: 'var(--sec)', lineHeight: 1.65, marginBottom: 24 }}>
              Static pricing. Slow sales cycles. Empty inventory during your busiest
              hours. The traditional OOH model was built for agencies — not for the people
              who actually own and operate the screens.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                'Long-term contracts at locked-in rates',
                'No real-time visibility into demand',
                'Resellers taking margin you should keep',
                'Zero tools to manage yield or pricing dynamically',
              ].map(item => (
                <li key={item} style={{
                  fontFamily: 'var(--inter)', fontSize: 14, color: 'var(--sec)',
                  paddingLeft: 16, position: 'relative',
                }}>
                  <span style={{ position: 'absolute', left: 0, color: 'var(--c1)' }}>—</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Advertiser card */}
          <div className={`rv d2 ${on?'on':''} card-border`} style={{
            borderLeft: '3px solid #7B2FFF', padding: 40,
          }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>📢</div>
            <h3 style={{ fontFamily: 'var(--inter)', fontWeight: 600, fontSize: 20, color: '#fff', marginBottom: 16 }}>
              OOH wasn't designed for you.
            </h3>
            <p style={{ fontFamily: 'var(--inter)', fontSize: 16, color: 'var(--sec)', lineHeight: 1.65, marginBottom: 24 }}>
              Minimum spends in the tens of thousands. Weeks of lead time. No
              self-serve. No targeting. No flexibility. Out-of-home advertising has been
              a closed market for decades — and most businesses never had a way in.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                'Minimum spends exclude small businesses entirely',
                'Buying requires agency relationships or sales reps',
                'No self-serve, no real-time control, no A/B testing',
                'No meaningful measurement of performance',
              ].map(item => (
                <li key={item} style={{
                  fontFamily: 'var(--inter)', fontSize: 14, color: 'var(--sec)',
                  paddingLeft: 16, position: 'relative',
                }}>
                  <span style={{ position: 'absolute', left: 0, color: 'var(--c2)' }}>—</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Connector */}
        <div className={`rv d3 ${on?'on':''}`} style={{ textAlign: 'center', marginTop: 48 }}>
          <p style={{ fontFamily: 'var(--inter)', fontSize: 16, color: 'var(--muted)', fontStyle: 'italic' }}>
            "There's a better way. And it looks a lot like how digital advertising already works."
          </p>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Write `HowItWorks` component** (3-step flow with gradient connectors):

```jsx
function HowItWorks() {
  const [ref, on] = useReveal();
  const steps = [
    {
      n: '01', icon: '🖥️',
      title: 'Operators list their screens',
      body: 'Set your floor price, define your content rules, and connect your display. Your inventory goes live on the Adgrid marketplace in minutes.',
    },
    {
      n: '02', icon: '🖱️',
      title: 'Advertisers bid in real-time',
      body: "Brands and local businesses browse available screens on a map, target by location and time slot, and launch campaigns — no phone calls, no contracts, no minimums.",
    },
    {
      n: '03', icon: '📈',
      title: 'Everyone wins',
      body: 'Operators fill more inventory at better prices. Advertisers reach real people in real places. Adgrid handles matching, payments, and reporting.',
    },
  ];

  return (
    <section id="how-it-works" ref={ref} style={{
      background: 'var(--surface)',
      padding: 'clamp(64px,10vw,100px) clamp(20px,5vw,80px)',
    }}>
      <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
        <div className={`rv ${on?'on':''}`}>
          <div className="tag" style={{ marginBottom: 20 }}>How Adgrid Works</div>
          {/* VERBATIM */}
          <h2 className="sec-h" style={{
            fontFamily: 'var(--inter)', fontSize: 48, fontWeight: 700,
            color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 16,
          }}>
            Simple for operators.<br />Simple for advertisers.
          </h2>
          <p style={{ fontFamily: 'var(--inter)', fontSize: 18, color: 'var(--sec)', marginBottom: 64 }}>
            Three steps. No sales calls. No contracts. No guesswork.
          </p>
        </div>

        <div className="steps-flow" style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
          {steps.map((step, i) => (
            <>
              <div key={step.n} className={`rv d${i+1} ${on?'on':''}`} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                padding: '0 16px',
              }}>
                {/* Gradient circle */}
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #00C2FF, #7B2FFF)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, marginBottom: 16, flexShrink: 0,
                  fontFamily: 'var(--inter)', fontWeight: 700, color: '#fff',
                }}>
                  {step.icon}
                </div>
                <div style={{ fontFamily: 'var(--inter)', fontWeight: 700, fontSize: 11, color: 'var(--c1)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
                  STEP {step.n}
                </div>
                <h3 style={{ fontFamily: 'var(--inter)', fontWeight: 600, fontSize: 20, color: '#fff', marginBottom: 12, lineHeight: 1.3 }}>
                  {step.title}
                </h3>
                <p style={{ fontFamily: 'var(--inter)', fontSize: 15, color: 'var(--sec)', lineHeight: 1.65 }}>
                  {step.body}
                </p>
              </div>
              {i < steps.length - 1 && (
                <div className="step-arrow" style={{
                  fontSize: 24, color: 'rgba(0,194,255,0.4)',
                  paddingTop: 16, flexShrink: 0, alignSelf: 'center',
                }}>→</div>
              )}
            </>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/views/marketing/Home.jsx
git commit -m "feat: Problem and HowItWorks sections"
```

---

### Task 5: Operators Section (S4) + Advertisers Section (S5)

**Files:**
- Modify: `src/views/marketing/Home.jsx`

- [ ] **Step 1: Write `OperatorsSection`** (2×2 feature grid + always-on gradient border CTA):

```jsx
function OperatorsSection({ onScrollTo }) {
  const [ref, on] = useReveal();
  const features = [
    {
      icon: '📈', title: 'Dynamic yield management',
      body: "Set a floor price and let Adgrid's engine do the rest. As demand rises — during events, rush hours, peak seasons — your prices rise with it. Your screens never undersell again.",
    },
    {
      icon: '🛡️', title: "You're always in control",
      body: "Approve advertiser categories. Block specific brands. Set blackout windows for any reason. Your screens, your rules. Adgrid runs the marketplace — you set the guardrails.",
    },
    {
      icon: '📊', title: 'Real-time analytics',
      body: 'See fill rates, revenue trends, and campaign performance in one clean dashboard. Know exactly what your inventory is worth — and what it\'s earning — at any moment.',
    },
    {
      icon: '🚀', title: 'Fast onboarding. No lock-in.',
      body: "Connect your screens in minutes. No long-term contracts. No upfront costs. Adgrid earns a commission only when you earn.",
    },
  ];

  return (
    <section id="operators" ref={ref} style={{
      background: 'var(--bg)',
      padding: 'clamp(64px,10vw,100px) clamp(20px,5vw,80px)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Glow orb left */}
      <div style={{
        position: 'absolute', top: '20%', left: '-10%', width: 700, height: 700,
        background: 'radial-gradient(ellipse, rgba(0,194,255,0.07) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div className={`rv ${on?'on':''}`} style={{ marginBottom: 48 }}>
          <div className="tag" style={{ marginBottom: 20 }}>For Operators</div>
          {/* VERBATIM */}
          <h2 className="sec-h" style={{
            fontFamily: 'var(--inter)', fontSize: 48, fontWeight: 700,
            color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.1,
            maxWidth: 560, marginBottom: 16,
          }}>
            Built for the screen operator.<br />Finally.
          </h2>
          <p style={{
            fontFamily: 'var(--inter)', fontSize: 18, color: 'var(--sec)',
            lineHeight: 1.65, maxWidth: 480,
          }}>
            Adgrid treats your screens like the premium inventory they are — dynamically
            priced, always filling, always earning.
          </p>
        </div>

        {/* 2x2 feature grid */}
        <div className="four-row" style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 40,
        }}>
          {features.map((f, i) => (
            <div key={f.title} className={`rv d${i+1} ${on?'on':''} feature-card card-border`}>
              <div style={{ fontSize: 28, marginBottom: 16 }}>{f.icon}</div>
              <h3 style={{ fontFamily: 'var(--inter)', fontWeight: 600, fontSize: 20, color: '#fff', marginBottom: 12, lineHeight: 1.3 }}>
                {f.title}
              </h3>
              <p style={{ fontFamily: 'var(--inter)', fontSize: 15, color: 'var(--sec)', lineHeight: 1.65 }}>
                {f.body}
              </p>
            </div>
          ))}
        </div>

        {/* CTA block — always-on gradient border */}
        <div className={`rv d5 ${on?'on':''}`} style={{ padding: 1, borderRadius: 17, background: 'linear-gradient(135deg,#00C2FF,#7B2FFF,#00C2FF)', backgroundSize: '200% 200%', animation: 'borderRotate 4s ease infinite' }}>
          <div className="cta-blk" style={{
            background: 'var(--surface)', borderRadius: 16, padding: '48px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 40,
          }}>
            <div>
              <h3 style={{ fontFamily: 'var(--inter)', fontWeight: 700, fontSize: 24, color: '#fff', marginBottom: 12 }}>
                Be a launch operator in Toronto or Vancouver.
              </h3>
              <p style={{ fontFamily: 'var(--inter)', fontSize: 16, color: 'var(--sec)', lineHeight: 1.65 }}>
                Early operators get priority placement, preferred revenue share,
                and dedicated onboarding support from our team during the launch period.
              </p>
            </div>
            <div style={{ flexShrink: 0 }}>
              <button className="btn-w" onClick={() => onScrollTo('waitlist-form')}>
                Join the operator waitlist →
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Write `AdvertisersSection`** (4 feature pills + notify-me block):

```jsx
function AdvertisersSection() {
  const [ref, on] = useReveal();
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);

  const features = [
    { icon: '📍', title: 'Hyper-local targeting', desc: 'Choose specific screens, neighborhoods, or zones' },
    { icon: '⚡', title: 'Launch in minutes',    desc: 'Self-serve campaign builder, no sales calls' },
    { icon: '💰', title: 'Any budget',           desc: 'Start small, scale what works, pause anytime' },
    { icon: '📊', title: 'Real measurement',     desc: 'Know which screens ran, when, and how' },
  ];

  return (
    <section id="advertisers" ref={ref} style={{
      background: 'var(--surface)',
      padding: 'clamp(64px,10vw,100px) clamp(20px,5vw,80px)',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
        <div className={`rv ${on?'on':''}`}>
          <div className="tag" style={{ marginBottom: 20 }}>For Advertisers</div>
          {/* VERBATIM */}
          <h2 className="sec-h" style={{
            fontFamily: 'var(--inter)', fontSize: 48, fontWeight: 700,
            color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.1,
            maxWidth: 640, margin: '0 auto 16px',
          }}>
            Your ad. On the right screen.<br />Right now.
          </h2>
          <p style={{
            fontFamily: 'var(--inter)', fontSize: 18, color: 'var(--sec)',
            lineHeight: 1.65, maxWidth: 560, margin: '0 auto 64px',
          }}>
            Imagine picking your neighborhood on a map, setting your budget, uploading
            your creative, and going live — today. No minimums. No agencies. No guesswork.
            That's what Adgrid is building for you.
          </p>
        </div>

        {/* 4-feature row */}
        <div className="four-row" style={{
          display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20, marginBottom: 64,
        }}>
          {features.map((f, i) => (
            <div key={f.title} className={`rv d${i+1} ${on?'on':''}`} style={{
              background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)',
              padding: '28px 20px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>{f.icon}</div>
              <div style={{ fontFamily: 'var(--inter)', fontWeight: 600, fontSize: 16, color: '#fff', marginBottom: 8 }}>{f.title}</div>
              <div style={{ fontFamily: 'var(--inter)', fontSize: 14, color: 'var(--sec)', lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Notify-me block — always-on gradient border, max-width 560 centered */}
        <div className={`rv d5 ${on?'on':''}`} style={{ maxWidth: 560, margin: '0 auto', padding: 1, borderRadius: 17, background: 'linear-gradient(135deg,#00C2FF,#7B2FFF,#00C2FF)', backgroundSize: '200% 200%', animation: 'borderRotate 4s ease infinite' }}>
          <div style={{
            background: 'var(--surf-el)', borderRadius: 16, padding: 48, textAlign: 'center',
          }}>
            <div style={{
              display: 'inline-block', background: 'var(--warning)', color: '#0A0A0F',
              padding: '3px 12px', borderRadius: 100,
              fontFamily: 'var(--inter)', fontWeight: 600, fontSize: 12,
              textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 20,
            }}>
              Coming soon
            </div>
            <h3 style={{ fontFamily: 'var(--inter)', fontWeight: 700, fontSize: 24, color: '#fff', marginBottom: 12 }}>
              Advertiser access is opening soon.
            </h3>
            <p style={{ fontFamily: 'var(--inter)', fontSize: 15, color: 'var(--sec)', lineHeight: 1.65, marginBottom: 28 }}>
              We're onboarding operators first to build inventory across Toronto and Vancouver.
              Be the first to know when you can run your campaign.
            </p>

            {done ? (
              <div style={{ fontFamily: 'var(--inter)', fontSize: 16, color: 'var(--success)' }}>
                ✓ We'll let you know!
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                <input
                  className="fi"
                  type="email"
                  placeholder="Your work email address"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{ maxWidth: 280 }}
                />
                <button className="btn-p" onClick={() => email && setDone(true)}>
                  Notify me
                </button>
              </div>
            )}

            <p style={{
              fontFamily: 'var(--inter)', fontSize: 13, color: 'var(--muted)',
              marginTop: 16,
            }}>
              🔒 No spam. We'll only email you when advertiser access opens.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/views/marketing/Home.jsx
git commit -m "feat: Operators and Advertisers sections"
```

---

### Task 6: Opportunity Section (S6) + Waitlist Form (S7)

**Files:**
- Modify: `src/views/marketing/Home.jsx`

- [ ] **Step 1: Write `OpportunitySection`** with animated stat counters and pull quote:

```jsx
function OpportunitySection() {
  const [ref, on] = useReveal(0.05);
  const count2 = useCounter(2, 1000, on);
  const [show1B, setShow1B] = useState(false);
  const [show0, setShow0] = useState(false);

  useEffect(() => {
    if (on) {
      setTimeout(() => setShow1B(true), 200);
      setTimeout(() => setShow0(true), 600);
    }
  }, [on]);

  return (
    <section ref={ref} style={{
      background: 'var(--bg)',
      padding: 'clamp(64px,10vw,100px) clamp(20px,5vw,80px)',
    }}>
      <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
        <div className={`rv ${on?'on':''}`}>
          <div className="tag" style={{ marginBottom: 20 }}>The Opportunity</div>
          {/* VERBATIM */}
          <h2 className="sec-h" style={{
            fontFamily: 'var(--inter)', fontSize: 48, fontWeight: 700,
            color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 40,
          }}>
            The Canadian OOH market is a{' '}
            <span className="gradient-text">$1B+ opportunity</span>{' '}
            sitting untouched.
          </h2>
        </div>

        {/* Body copy */}
        {[
          "Out-of-home advertising in Canada generates over a billion dollars annually. But almost none of it flows through a modern marketplace. Inventory is bought and sold through phone calls, PDFs, and agency relationships that haven't fundamentally changed since the 1990s.",
          "Meanwhile, the screens are everywhere. Transit shelters. Gym lobbies. Restaurant walls. Retail corridors. Every major Canadian city is covered in digital displays that could be running targeted, dynamic, data-driven campaigns — and aren't.",
          "The infrastructure for a better market exists. The screens exist. The advertisers exist. What's been missing is the marketplace that connects them.",
        ].map((p, i) => (
          <p key={i} className={`rv d${i+1} ${on?'on':''}`} style={{
            fontFamily: 'var(--inter)', fontSize: 18, color: 'var(--sec)',
            lineHeight: 1.7, marginBottom: 24, textAlign: 'left',
          }}>
            {p}
          </p>
        ))}

        {/* Pull quote */}
        <div className={`rv d4 ${on?'on':''} pull-quote`} style={{ textAlign: 'left', marginBottom: 64 }}>
          <p className="gradient-text" style={{
            fontFamily: 'var(--inter)', fontWeight: 600, fontSize: 24, lineHeight: 1.4,
          }}>
            "We're starting in Toronto and Vancouver because that's where the density is.
            We're building the infrastructure the whole country needs."
          </p>
        </div>

        {/* 3 stat blocks */}
        <div className="stat-row" style={{
          display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 0,
        }}>
          {[
            {
              val: show1B ? '$1B+' : '',
              label: 'Canadian OOH market annually',
              reveal: show1B,
            },
            {
              val: count2,
              label: 'Launch cities: Toronto & Vancouver',
              reveal: on,
            },
            {
              val: show0 ? '0' : '',
              label: 'Self-serve OOH marketplaces in Canada before Adgrid',
              reveal: show0,
            },
          ].map((s, i) => (
            <div key={s.label} style={{
              textAlign: 'center', padding: '0 32px',
              borderRight: i < 2 ? '1px solid var(--border)' : 'none',
            }}>
              <div className="gradient-text" style={{
                fontFamily: 'var(--inter)', fontWeight: 800, fontSize: 'clamp(40px,5vw,64px)',
                lineHeight: 1, marginBottom: 8,
                opacity: s.reveal ? 1 : 0, transition: 'opacity 0.4s ease',
              }}>
                {s.val}
              </div>
              <div style={{ fontFamily: 'var(--inter)', fontSize: 14, color: 'var(--sec)' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Write `WaitlistForm`** (6 fields, always-on gradient border, success state):

```jsx
function WaitlistForm() {
  const [ref, on] = useReveal();
  const [form, setForm] = useState({
    name: '', email: '', company: '', city: '', screens: '', source: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (form.name && form.email) setSubmitted(true);
  };

  return (
    <section id="waitlist-form" ref={ref} style={{
      background: 'var(--surface)',
      padding: 'clamp(64px,10vw,100px) clamp(20px,5vw,80px)',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
        <div className={`rv ${on?'on':''}`}>
          <div className="tag" style={{ marginBottom: 20 }}>Early Operator Access</div>
          {/* VERBATIM */}
          <h2 className="sec-h" style={{
            fontFamily: 'var(--inter)', fontSize: 48, fontWeight: 700,
            color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.1,
            maxWidth: 600, margin: '0 auto 16px',
          }}>
            Claim your spot as a launch operator.
          </h2>
          <p style={{
            fontFamily: 'var(--inter)', fontSize: 18, color: 'var(--sec)',
            lineHeight: 1.65, maxWidth: 520, margin: '0 auto 48px',
          }}>
            We're onboarding a select group of screen operators in Toronto and Vancouver
            before our public launch. Early operators get priority placement, preferred
            revenue share, and hands-on onboarding support from our team.
          </p>
        </div>

        {/* Form container — always-on gradient border */}
        <div className={`rv d1 ${on?'on':''}`} style={{
          maxWidth: 640, margin: '0 auto',
          padding: 1, borderRadius: 17,
          background: 'linear-gradient(135deg,#00C2FF,#7B2FFF,#00C2FF)',
          backgroundSize: '200% 200%',
          animation: 'borderRotate 4s ease infinite',
        }}>
          <div style={{
            background: 'var(--bg)', borderRadius: 16,
            padding: 'clamp(32px,5vw,48px)',
          }}>
            {submitted ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                {/* Gradient checkmark */}
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: 'linear-gradient(135deg,#00C2FF,#7B2FFF)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 24px', fontSize: 28, color: '#fff',
                }}>
                  ✓
                </div>
                {/* VERBATIM */}
                <h3 style={{ fontFamily: 'var(--inter)', fontWeight: 700, fontSize: 28, color: '#fff', marginBottom: 12 }}>
                  You're on the list.
                </h3>
                <p style={{ fontFamily: 'var(--inter)', fontSize: 16, color: 'var(--sec)', marginBottom: 28, lineHeight: 1.6 }}>
                  We'll be in touch shortly with next steps. Follow us on LinkedIn for launch updates.
                </p>
                <a
                  href="#"
                  className="btn-s"
                  style={{ display: 'inline-flex' }}
                >
                  Follow Adgrid on LinkedIn →
                </a>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
                {/* Field 1 */}
                <div style={{ marginBottom: 20 }}>
                  <label className="form-label" htmlFor="wl-name" style={{ fontFamily: 'var(--inter)', fontWeight: 500, fontSize: 14, color: '#fff', display: 'block', marginBottom: 8 }}>
                    Full name
                  </label>
                  <input id="wl-name" className="fi" type="text" placeholder="Jane Smith" value={form.name} onChange={set('name')} required />
                </div>
                {/* Field 2 */}
                <div style={{ marginBottom: 20 }}>
                  <label className="form-label" htmlFor="wl-email" style={{ fontFamily: 'var(--inter)', fontWeight: 500, fontSize: 14, color: '#fff', display: 'block', marginBottom: 8 }}>
                    Work email
                  </label>
                  <input id="wl-email" className="fi" type="email" placeholder="jane@yourcompany.com" value={form.email} onChange={set('email')} required />
                </div>
                {/* Field 3 */}
                <div style={{ marginBottom: 20 }}>
                  <label className="form-label" htmlFor="wl-company" style={{ fontFamily: 'var(--inter)', fontWeight: 500, fontSize: 14, color: '#fff', display: 'block', marginBottom: 8 }}>
                    Company or venue name
                  </label>
                  <input id="wl-company" className="fi" type="text" placeholder="Name of your business or network" value={form.company} onChange={set('company')} />
                </div>
                {/* Field 4 */}
                <div style={{ marginBottom: 20 }}>
                  <label className="form-label" htmlFor="wl-city" style={{ fontFamily: 'var(--inter)', fontWeight: 500, fontSize: 14, color: '#fff', display: 'block', marginBottom: 8 }}>
                    City
                  </label>
                  <select id="wl-city" className="fi" value={form.city} onChange={set('city')}>
                    <option value="">Select city…</option>
                    <option value="toronto">Toronto</option>
                    <option value="vancouver">Vancouver</option>
                    <option value="other-ca">Other Canadian city</option>
                    <option value="multiple">Multiple cities</option>
                  </select>
                </div>
                {/* Field 5 */}
                <div style={{ marginBottom: 20 }}>
                  <label className="form-label" htmlFor="wl-screens" style={{ fontFamily: 'var(--inter)', fontWeight: 500, fontSize: 14, color: '#fff', display: 'block', marginBottom: 8 }}>
                    Number of screens
                  </label>
                  <select id="wl-screens" className="fi" value={form.screens} onChange={set('screens')}>
                    <option value="">Select range…</option>
                    <option value="1-5">1–5</option>
                    <option value="6-20">6–20</option>
                    <option value="21-100">21–100</option>
                    <option value="100+">100+</option>
                    <option value="not-yet">Not yet deployed</option>
                  </select>
                </div>
                {/* Field 6 */}
                <div style={{ marginBottom: 32 }}>
                  <label className="form-label" htmlFor="wl-source" style={{ fontFamily: 'var(--inter)', fontWeight: 500, fontSize: 14, color: '#fff', display: 'block', marginBottom: 8 }}>
                    How did you hear about Adgrid? <span style={{ color: 'var(--muted)' }}>(optional)</span>
                  </label>
                  <input id="wl-source" className="fi" type="text" placeholder="" value={form.source} onChange={set('source')} />
                </div>

                <button type="submit" className="btn-p" style={{ width: '100%', justifyContent: 'center', padding: 16 }}>
                  Join the operator waitlist →
                </button>

                <p style={{
                  fontFamily: 'var(--inter)', fontSize: 13, color: 'var(--muted)',
                  textAlign: 'center', marginTop: 16,
                }}>
                  By submitting, you agree to our Privacy Policy. We'll never share your information.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/views/marketing/Home.jsx
git commit -m "feat: Opportunity section and Waitlist form"
```

---

### Task 7: Footer (S8) + Root Component + Global Effects

**Files:**
- Modify: `src/views/marketing/Home.jsx`

- [ ] **Step 1: Write `Footer`**:

```jsx
function Footer({ onLogin }) {
  const platform = [
    ['For Operators',   'operators'],
    ['For Advertisers', 'advertisers'],
    ['How It Works',    'how-it-works'],
    ['Join Waitlist',   'waitlist-form'],
  ];
  const company = ['About', 'Contact', 'Privacy Policy', 'Terms of Service'];

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
  };

  return (
    <footer style={{ background: 'var(--bg)', borderTop: '1px solid var(--border)' }}>
      <div className="footer-upper" style={{
        maxWidth: 1200, margin: '0 auto',
        padding: '64px clamp(20px,5vw,80px)',
        display: 'flex', justifyContent: 'space-between', gap: 40,
      }}>
        {/* Left: brand */}
        <div>
          <div style={{ fontFamily: 'var(--inter)', fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
            Adgrid
          </div>
          {/* VERBATIM */}
          <div style={{ fontFamily: 'var(--inter)', fontSize: 16, color: 'var(--sec)', marginBottom: 20 }}>
            Canada's OOH marketplace.
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            {/* LinkedIn */}
            <a href="#" style={{ color: 'var(--muted)', transition: 'color 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.color='#fff'}
              onMouseLeave={e => e.currentTarget.style.color='var(--muted)'}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/>
                <circle cx="4" cy="4" r="2"/>
              </svg>
            </a>
            {/* Instagram */}
            <a href="#" style={{ color: 'var(--muted)', transition: 'color 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.color='#fff'}
              onMouseLeave={e => e.currentTarget.style.color='var(--muted)'}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="2" width="20" height="20" rx="5"/>
                <circle cx="12" cy="12" r="5"/>
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
              </svg>
            </a>
          </div>
        </div>

        {/* Right: link groups */}
        <div className="footer-links" style={{ display: 'flex', gap: 64 }}>
          <div>
            <div style={{ fontFamily: 'var(--inter)', fontWeight: 600, fontSize: 14, color: '#fff', marginBottom: 16 }}>Platform</div>
            {platform.map(([label, id]) => (
              <div key={label} style={{ marginBottom: 10 }}>
                <button onClick={() => scrollTo(id)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--inter)', fontSize: 14, color: 'var(--sec)',
                  padding: 0, transition: 'color 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.color='#fff'}
                  onMouseLeave={e => e.currentTarget.style.color='var(--sec)'}
                >
                  {label}
                </button>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontFamily: 'var(--inter)', fontWeight: 600, fontSize: 14, color: '#fff', marginBottom: 16 }}>Company</div>
            {company.map(label => (
              <div key={label} style={{ marginBottom: 10 }}>
                <span style={{
                  fontFamily: 'var(--inter)', fontSize: 14, color: 'var(--sec)', cursor: 'pointer',
                  transition: 'color 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.color='#fff'}
                  onMouseLeave={e => e.currentTarget.style.color='var(--sec)'}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lower bar */}
      <div style={{
        borderTop: '1px solid var(--border)',
        padding: '24px clamp(20px,5vw,80px)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 12, maxWidth: 1200, margin: '0 auto',
      }}>
        <span style={{ fontFamily: 'var(--inter)', fontSize: 13, color: 'var(--muted)' }}>
          © 2026 Adgrid Technologies Inc. All rights reserved.
        </span>
        <span style={{ fontFamily: 'var(--inter)', fontSize: 13, color: 'var(--muted)' }}>
          Launching in Toronto &amp; Vancouver — 🇨🇦
        </span>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Write `MarketingHome` root** with global effects (cursor glow, 3D tilt, parallax):

```jsx
export function MarketingHome({ onSignup, onLogin }) {
  useEffect(() => {
    // Inject CSS
    const style = Object.assign(document.createElement('style'), { textContent: CSS, id: 'adgrid-mktg-css' });
    if (!document.getElementById('adgrid-mktg-css')) document.head.appendChild(style);
    return () => { try { document.head.removeChild(style); } catch {} };
  }, []);

  // Cursor glow
  useEffect(() => {
    const handle = (e) => {
      document.documentElement.style.setProperty('--cursor-x', e.clientX + 'px');
      document.documentElement.style.setProperty('--cursor-y', e.clientY + 'px');
    };
    window.addEventListener('mousemove', handle, { passive: true });
    return () => window.removeEventListener('mousemove', handle);
  }, []);

  // Scroll parallax
  useEffect(() => {
    let ticking = false;
    const handle = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const y = window.scrollY;
          const grid = document.querySelector('.hero-bg-grid');
          const orbs = document.querySelectorAll('.hero-orb');
          const headline = document.querySelector('.hero-headline');
          if (grid) grid.style.transform = `translateY(${y * 0.3}px)`;
          if (orbs[0]) orbs[0].style.transform = `translateY(${y * 0.15}px)`;
          if (orbs[1]) orbs[1].style.transform = `translateY(${y * 0.25}px)`;
          if (headline) headline.style.transform = `translateY(${y * -0.1}px)`;
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handle, { passive: true });
    return () => window.removeEventListener('scroll', handle);
  }, []);

  // 3D card tilt
  useEffect(() => {
    const cards = document.querySelectorAll('.feature-card');
    const handlers = Array.from(cards).map(card => {
      const onMove = (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const rotX = ((y - cy) / cy) * -6;
        const rotY = ((x - cx) / cx) * 6;
        card.style.transform = `perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(4px)`;
        card.style.transition = 'none';
      };
      const onLeave = () => {
        card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateZ(0)';
        card.style.transition = 'transform 0.5s ease';
      };
      card.addEventListener('mousemove', onMove);
      card.addEventListener('mouseleave', onLeave);
      return { card, onMove, onLeave };
    });
    return () => {
      handlers.forEach(({ card, onMove, onLeave }) => {
        card.removeEventListener('mousemove', onMove);
        card.removeEventListener('mouseleave', onLeave);
      });
    };
  });

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
  };

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', overflowX: 'hidden' }}>
      <Nav onScrollTo={scrollTo} onLogin={onLogin} />
      <Hero onScrollTo={scrollTo} />
      <ProblemSection />
      <HowItWorks />
      <OperatorsSection onScrollTo={scrollTo} />
      <AdvertisersSection />
      <OpportunitySection />
      <WaitlistForm />
      <Footer onLogin={onLogin} />
    </div>
  );
}
```

- [ ] **Step 3: Remove all old component code** (Hero, ProofStrip, ProofSection, MapSection, OperatorSection, AdvertiserSection, PrivacyStrip, FaqSection, WaitlistSection, LiveFeedMock, AnalyticsMock, CampaignMock, SCREENS, VENUES, genEvent from old code). Only keep the new components written in tasks 2–7.

- [ ] **Step 4: Add `select` styling to CSS** (selects need same look as inputs):

```css
select.fi { appearance: none; cursor: pointer; }
```

- [ ] **Step 5: Final commit**

```bash
git add src/views/marketing/Home.jsx
git commit -m "feat: Footer, root component, cursor/tilt/parallax global effects"
```

---

## Self-Review

**Spec coverage check:**
- ✅ S1 Hero: word-by-word reveal, city pins, dual CTA, launch badge, scroll indicator
- ✅ S2 Problem: two-col cards, cyan/violet borders, pain points, connector text
- ✅ S3 How It Works: 3-step flow, gradient connectors, step numbers
- ✅ S4 Operators: 2×2 feature grid, always-on gradient border CTA, glow orb
- ✅ S5 Advertisers: 4-feature row, always-on notify-me block, coming-soon badge
- ✅ S6 Opportunity: body copy, pull quote, 3 animated stats
- ✅ S7 Waitlist Form: 6 fields, always-on border, success state "You're on the list."
- ✅ S8 Footer: logo, tagline VERBATIM, social icons, two link groups, copyright VERBATIM
- ✅ Motion: gridDrift, cursor glow, 3D card tilt, spring reveals, gradient borders, gradientShift, ctaPulse, stat counters, scroll parallax, pin pulse + ripple, noise texture, page load sequence
- ✅ Nav: sticky, blur, Logo | For Operators/Advertisers/How It Works | Join the waitlist CTA
- ✅ All VERBATIM copy preserved exactly
- ✅ Section IDs: `how-it-works`, `operators`, `advertisers`, `waitlist-form`
- ✅ Design tokens match brief exactly
- ✅ `prefers-reduced-motion` respected
- ✅ `will-change` on animated elements
- ✅ `requestAnimationFrame` for parallax

**Gaps found and fixed:**
- Added `select.fi` styling (selects need same border/focus treatment as inputs)
- Added `hamburger` display toggle to responsive CSS
- 3D tilt runs as effect without deps array — reruns on each render to pick up new cards

**Type consistency:**
- `useReveal` returns `[ref, on]` — used consistently
- `useCounter(target, duration, started)` — consistent across S6 usage
- `onScrollTo` prop name used in Nav, Hero, OperatorsSection, MarketingHome
- `MarketingHome({ onSignup, onLogin })` — same interface as before
