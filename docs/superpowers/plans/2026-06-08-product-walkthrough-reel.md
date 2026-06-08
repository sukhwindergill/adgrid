# Animated Product Walkthrough Reel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `ProductReel` section directly below the marketing Home hero that crossfades through 4 hand-built mock product screens (Operator dashboard, Map/browse, Campaign analytics, Live display preview) inside a stylized device frame, selling product credibility right after the hero's headline.

**Architecture:** A new `ProductReel` section component is inserted between `<Hero />` and `<ProblemSection />` in the page composition ([Home.jsx:1538](../../../src/views/marketing/Home.jsx#L1538)). It renders a CSS-drawn device frame containing 4 absolutely-stacked mock-UI panels (`OperatorPanel`, `MapPanel`, `AnalyticsPanel`, `DisplayPanel`), driven by a `REEL_SCREENS` data array. A `useReveal`-gated `setInterval` cycles an active index; panels crossfade via CSS `opacity` transitions, with a caption and progress dots crossfading/highlighting in sync. Respects `prefers-reduced-motion` by freezing on the first screen.

**Tech Stack:** React 19 (JSX, hooks), plain CSS-in-template-string (existing `CSS` constant), no new dependencies. Verification via lint + visual check in dev server (no test runner in this project).

---

## File Structure

- **Modify:** `src/views/marketing/Home.jsx`
  - Add `panelFade` keyframe to the `CSS` template string (~line 50, alongside other `@keyframes`)
  - Add `.reel-frame`, `.reel-panel`, `.reel-panel.on`, `.reel-dot`, `.reel-dot.on` classes to `CSS` (~line 313, just before the `prefers-reduced-motion` block)
  - Add `.reel-panel` to the `prefers-reduced-motion` override list (~line 319)
  - Add `REEL_SCREENS` data array near `CITY_PINS` (~line 326)
  - Add 4 mock-panel components (`OperatorPanel`, `MapPanel`, `AnalyticsPanel`, `DisplayPanel`) and `ProductReel` component after `NetworkMap` closes (~line 451, before `// ─── Nav ───`)
  - Modify the `Root` composition (~line 1538) to render `<ProductReel />` between `<Hero />` and `<ProblemSection />`

No new files — matches the established pattern of keeping the full marketing page in one file.

---

### Task 1: Add crossfade keyframe and reel CSS classes

**Files:**
- Modify: `src/views/marketing/Home.jsx:50` (insert after the `ctaPulse` keyframe block, before `@keyframes pinPulse`)
- Modify: `src/views/marketing/Home.jsx:313` (insert new rules just before the `@media (prefers-reduced-motion: reduce)` block)
- Modify: `src/views/marketing/Home.jsx:319` (extend the reduced-motion selector list)

- [ ] **Step 1: Add the `panelFade` keyframe**

Open `src/views/marketing/Home.jsx` and find the `@keyframes ctaPulse` block (lines 47-50):

```css
@keyframes ctaPulse {
  0%, 100% { box-shadow: 0 0 16px rgba(0,194,255,0.3), 0 0 32px rgba(123,47,255,0.15); }
  50%       { box-shadow: 0 0 32px rgba(0,194,255,0.5), 0 0 64px rgba(123,47,255,0.25); }
}
```

Immediately after its closing `}`, insert:

```css
@keyframes panelFade {
  from { opacity: 0; transform: translateY(8px) scale(0.99); }
  to   { opacity: 1; transform: none; }
}
```

- [ ] **Step 2: Add the reel CSS classes**

Find the `@media (prefers-reduced-motion: reduce)` block (currently starting at line 314):

```css
@media (prefers-reduced-motion: reduce) {
```

Immediately *before* that line, insert:

```css
.reel-frame {
  position: relative;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: 0 0 0 1px rgba(0,194,255,0.06), 0 24px 80px rgba(0,0,0,0.5);
  overflow: hidden;
}
.reel-frame-bar {
  display: flex; align-items: center; gap: 6px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
  background: rgba(255,255,255,0.02);
}
.reel-frame-dot {
  width: 10px; height: 10px; border-radius: 50%;
  background: var(--muted);
}
.reel-stage {
  position: relative;
  aspect-ratio: 16 / 9;
  background: var(--bg);
}
.reel-panel {
  position: absolute; inset: 0;
  padding: clamp(20px, 4vw, 40px);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.6s ease;
}
.reel-panel.on {
  opacity: 1;
  pointer-events: auto;
  animation: panelFade 0.6s ease both;
}
.reel-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--muted);
  transition: background 0.4s ease, transform 0.4s ease, box-shadow 0.4s ease;
}
.reel-dot.on {
  background: var(--c1);
  transform: scale(1.3);
  box-shadow: 0 0 10px 2px rgba(0,194,255,0.5);
}
```

- [ ] **Step 3: Disable the crossfade animation under reduced motion**

Find the reduced-motion selector list (currently line 319):

```css
  .pin, .pin::after, .hero-orb {
    animation: none !important;
  }
```

Replace it with:

```css
  .pin, .pin::after, .hero-orb, .reel-panel {
    animation: none !important;
  }
  .reel-panel { transition: none !important; }
```

- [ ] **Step 4: Verify no syntax errors**

Run: `npx eslint src/views/marketing/Home.jsx`
Expected: only the 3 pre-existing baseline errors (`'onLogin' is defined but never used`, `'onSignup' is defined but never used`, `Empty block statement`) — no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/views/marketing/Home.jsx
git commit -m "feat: add crossfade keyframe and reel CSS classes for product walkthrough"
```

---

### Task 2: Add `REEL_SCREENS` data array and mock panel components

**Files:**
- Modify: `src/views/marketing/Home.jsx` — insert the data array immediately after `CITY_PINS` closes (currently `];` around line 344, right before the `// Connector lines...` comment was — that comment block was removed; insert right after `CITY_PINS` now)
- Modify: `src/views/marketing/Home.jsx` — insert the 4 panel components after `NetworkMap` closes (currently ends ~line 451, right before the `// ─── Nav ───` comment)

- [ ] **Step 1: Add the `REEL_SCREENS` data array**

Find the end of `CITY_PINS` — it closes with `];`. Immediately after it, insert:

```js
// Drives the ProductReel cycle — one entry per mock screen. `Panel` is the
// component that renders that screen's mock UI inside the device frame.
const REEL_SCREENS = [
  { key: 'operator',  label: 'Operator dashboard',   caption: 'List inventory, set floor prices, track fill rate and earnings — all from one screen.' },
  { key: 'map',       label: 'Map & browse screens', caption: 'Advertisers browse available screens by location, audience, and price in real time.' },
  { key: 'analytics', label: 'Campaign analytics',   caption: 'Impressions, reach, and spend — reported live, not weeks after the campaign ends.' },
  { key: 'display',   label: 'Live display preview', caption: "See exactly what's playing on a screen, right now, from anywhere." },
];
```

- [ ] **Step 2: Write the four mock panel components**

Find where `NetworkMap` closes (the `}` that ends the function, right before the `// ─── Nav ───` section comment). Immediately before that comment, insert:

```jsx
// ─── Product Reel mock panels ─────────────────────────────────────────────────

function OperatorPanel() {
  const cards = [
    { name: 'Queen St & Spadina',  fill: 82, earn: '$1,240' },
    { name: 'Union Station Concourse', fill: 91, earn: '$2,860' },
    { name: 'Yonge-Dundas Square', fill: 67, earn: '$1,975' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
      <div style={{ fontFamily: 'var(--inter)', fontSize: 13, color: 'var(--sec)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        Your inventory
      </div>
      {cards.map((c) => (
        <div key={c.name} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '14px 18px',
        }}>
          <div>
            <div style={{ fontFamily: 'var(--inter)', fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 6 }}>{c.name}</div>
            <div style={{ width: 140, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <div style={{ width: `${c.fill}%`, height: '100%', background: 'linear-gradient(90deg, var(--c1), var(--c2))', borderRadius: 3 }} />
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--inter)', fontSize: 11, color: 'var(--muted)' }}>fill rate {c.fill}%</div>
            <div style={{ fontFamily: 'var(--inter)', fontSize: 16, fontWeight: 700, color: 'var(--c1)' }}>{c.earn}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MapPanel() {
  const pins = [
    { x: 28, y: 35 }, { x: 52, y: 22 }, { x: 68, y: 48 }, { x: 40, y: 64 }, { x: 78, y: 30 },
  ];
  return (
    <div style={{ position: 'relative', height: '100%', borderRadius: 12, overflow: 'hidden', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
        <line x1="0" y1="20" x2="100" y2="20" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
        <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
        <line x1="0" y1="80" x2="100" y2="80" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
        <line x1="25" y1="0" x2="25" y2="100" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
        <line x1="60" y1="0" x2="60" y2="100" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
      </svg>
      {pins.map((p, i) => (
        <div key={i} style={{
          position: 'absolute', left: `${p.x}%`, top: `${p.y}%`,
          width: 10, height: 10, borderRadius: '50%',
          background: 'var(--c1)', boxShadow: '0 0 12px 2px rgba(0,194,255,0.55)',
          transform: 'translate(-50%, -50%)',
        }} />
      ))}
      <div style={{
        position: 'absolute', left: '52%', top: '22%', transform: 'translate(12px, -130%)',
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
        padding: '8px 12px', whiteSpace: 'nowrap',
      }}>
        <div style={{ fontFamily: 'var(--inter)', fontSize: 12, fontWeight: 600, color: '#fff' }}>Bloor & Bathurst</div>
        <div style={{ fontFamily: 'var(--inter)', fontSize: 12, color: 'var(--c1)' }}>$18 / hr</div>
      </div>
    </div>
  );
}

function AnalyticsPanel() {
  const bars = [38, 62, 51, 74, 88, 69, 95];
  const stats = [
    { label: 'Impressions', value: '482K' },
    { label: 'Reach',       value: '96K' },
    { label: 'Spend',       value: '$3,140' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, height: '100%' }}>
      <div style={{ display: 'flex', gap: 16 }}>
        {stats.map((s) => (
          <div key={s.label} style={{
            flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '14px 16px',
          }}>
            <div style={{ fontFamily: 'var(--inter)', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontFamily: 'var(--inter)', fontSize: 22, fontWeight: 700, color: '#fff' }}>{s.value}</div>
          </div>
        ))}
      </div>
      <div style={{
        flex: 1, display: 'flex', alignItems: 'flex-end', gap: 10,
        background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '20px 24px',
      }}>
        {bars.map((h, i) => (
          <div key={i} style={{
            flex: 1, height: `${h}%`, borderRadius: '4px 4px 0 0',
            background: 'linear-gradient(180deg, var(--c1), var(--c2))',
            opacity: 0.85,
          }} />
        ))}
      </div>
    </div>
  );
}

function DisplayPanel() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', borderRadius: 12, overflow: 'hidden',
      background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
    }}>
      <div style={{
        width: '70%', aspectRatio: '16 / 9', borderRadius: 10, overflow: 'hidden',
        border: '1px solid var(--border)', position: 'relative',
        background: 'linear-gradient(135deg, rgba(0,194,255,0.18), rgba(123,47,255,0.22))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          position: 'absolute', top: 10, left: 12,
          display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: 'var(--inter)', fontSize: 11, color: '#fff',
          background: 'rgba(0,0,0,0.35)', borderRadius: 999, padding: '4px 10px',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3DDC73' }} />
          LIVE — Union Station Concourse
        </div>
        <div style={{ fontFamily: 'var(--inter)', fontSize: 24, fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
          Now playing: Local Coffee Co.
        </div>
      </div>
    </div>
  );
}

const REEL_PANELS = {
  operator: OperatorPanel,
  map: MapPanel,
  analytics: AnalyticsPanel,
  display: DisplayPanel,
};

```

**Note:** `REEL_PANELS` maps each `REEL_SCREENS[i].key` to its panel component — `ProductReel` (Task 3) looks up the component by key so the data array stays the single source of truth for ordering, labels, and captions.

- [ ] **Step 3: Commit**

```bash
git add src/views/marketing/Home.jsx
git commit -m "feat: add REEL_SCREENS data and mock panel components for product walkthrough"
```

---

### Task 3: Build the `ProductReel` component

**Files:**
- Modify: `src/views/marketing/Home.jsx` — insert immediately after `REEL_PANELS` closes (end of Task 2's insertion), before the `// ─── Nav ───` comment

- [ ] **Step 1: Write the component**

Insert this directly after the `const REEL_PANELS = { ... };` block from Task 2:

```jsx
function ProductReel() {
  const [ref, on] = useReveal(0.25);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!on) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;
    const id = setInterval(() => {
      setActive((i) => (i + 1) % REEL_SCREENS.length);
    }, 4000);
    return () => clearInterval(id);
  }, [on]);

  return (
    <section id="product" ref={ref} style={{
      background: 'var(--bg)',
      padding: 'clamp(64px,10vw,100px) clamp(20px,5vw,80px)',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div className={`rv ${on ? 'on' : ''}`} style={{ textAlign: 'center', marginBottom: 48 }}>
          <div className="tag" style={{ marginBottom: 20 }}>See It In Action</div>
          <h2 className="sec-h" style={{
            fontFamily: 'var(--inter)', fontSize: 48, fontWeight: 700,
            color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.1,
          }}>
            From listing to live.<br />In minutes, not weeks.
          </h2>
        </div>

        <div className={`rv d1 ${on ? 'on' : ''} reel-frame`}>
          <div className="reel-frame-bar">
            <span className="reel-frame-dot" style={{ background: '#FF5F57' }} />
            <span className="reel-frame-dot" style={{ background: '#FEBC2E' }} />
            <span className="reel-frame-dot" style={{ background: '#28C840' }} />
            <span style={{ fontFamily: 'var(--inter)', fontSize: 12, color: 'var(--muted)', marginLeft: 12 }}>
              app.adgrid.ca
            </span>
          </div>
          <div className="reel-stage">
            {REEL_SCREENS.map((screen, i) => {
              const Panel = REEL_PANELS[screen.key];
              return (
                <div key={screen.key} className={`reel-panel ${i === active ? 'on' : ''}`}>
                  <Panel />
                </div>
              );
            })}
          </div>
        </div>

        <div className={`rv d2 ${on ? 'on' : ''}`} style={{ textAlign: 'center', marginTop: 28 }}>
          <p style={{ fontFamily: 'var(--inter)', fontSize: 16, color: 'var(--sec)', minHeight: 24 }}>
            <strong style={{ color: '#fff', fontWeight: 600 }}>{REEL_SCREENS[active].label}.</strong>{' '}
            {REEL_SCREENS[active].caption}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 20 }}>
            {REEL_SCREENS.map((screen, i) => (
              <span key={screen.key} className={`reel-dot ${i === active ? 'on' : ''}`} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

```

**Note:** `useEffect`/`useState` are already imported at the top of `Home.jsx` (used by `useReveal`/`useCounter`/`HeadlineReveal` etc.) — no new imports needed.

- [ ] **Step 2: Commit**

```bash
git add src/views/marketing/Home.jsx
git commit -m "feat: add ProductReel component with crossfade cycle and reduced-motion handling"
```

---

### Task 4: Wire `ProductReel` into the page composition

**Files:**
- Modify: `src/views/marketing/Home.jsx:1538-1539`

- [ ] **Step 1: Insert `<ProductReel />` between `<Hero />` and `<ProblemSection />`**

Find this in the `Root` composition (around line 1538-1539):

```jsx
      <Hero onScrollTo={scrollTo} />
      <ProblemSection />
```

Replace it with:

```jsx
      <Hero onScrollTo={scrollTo} />
      <ProductReel />
      <ProblemSection />
```

- [ ] **Step 2: Run the dev server and visually verify**

Run: `npm run dev`

Open the marketing home page in a browser and scroll past the hero. Confirm:
- The "See It In Action" section appears directly below the hero, above "OOH advertising is broken"
- The device frame shows a browser-style top bar (red/yellow/green dots + "app.adgrid.ca")
- The 4 mock screens crossfade through in order (Operator dashboard → Map & browse → Campaign analytics → Live display preview) roughly every 4 seconds, looping
- The caption text and the active progress dot update in sync with each panel change
- The cycle does not start until the section scrolls into view
- Toggle OS-level "reduce motion" (Windows: Settings → Accessibility → Visual effects → Animation effects → off) and confirm the reel freezes on the first screen (Operator dashboard) with no auto-advance, dots static

- [ ] **Step 3: Commit**

```bash
git add src/views/marketing/Home.jsx
git commit -m "feat: wire ProductReel into marketing home page composition"
```

---

### Task 5: Final lint and spec review pass

**Files:**
- Review only: `src/views/marketing/Home.jsx`

- [ ] **Step 1: Run lint one more time across the full file**

Run: `npx eslint src/views/marketing/Home.jsx`
Expected: only the 3 pre-existing baseline errors remain (`'onLogin' is defined but never used`, `'onSignup' is defined but never used`, `Empty block statement`) — no new errors or warnings introduced.

- [ ] **Step 2: Re-check the spec against the implementation**

Re-read [docs/superpowers/specs/2026-06-08-product-walkthrough-reel-design.md](../specs/2026-06-08-product-walkthrough-reel-design.md) and confirm each requirement is met:
- Device frame hosts the reel — ✓ via `.reel-frame`/`.reel-frame-bar`
- 4 mock-UI panels (operator, map, analytics, display) — ✓ via `OperatorPanel`/`MapPanel`/`AnalyticsPanel`/`DisplayPanel` + `REEL_PANELS`
- Caption crossfades in sync with active panel — ✓ via `REEL_SCREENS[active]` lookup re-rendering on `active` change
- Progress dots indicate position — ✓ via `.reel-dot`/`.reel-dot.on`
- Crossfade cycle gated by scroll-into-view, ~4s per screen — ✓ via `useReveal` + `setInterval`
- `prefers-reduced-motion` respected (freeze on first screen, no auto-advance) — ✓ via the `matchMedia` check in the `useEffect` and the CSS override
- Section placed between Hero and ProblemSection — ✓ via Task 4 wiring

- [ ] **Step 3: Final commit (if any cleanup was needed)**

```bash
git add src/views/marketing/Home.jsx
git commit -m "chore: final lint cleanup for product walkthrough reel"
```

(Skip this commit if Steps 1-2 found nothing to change.)
