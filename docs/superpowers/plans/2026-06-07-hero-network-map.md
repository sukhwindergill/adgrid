# Animated Network Map Hero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the marketing hero's background pin layer into a polished "live network" visual — connector lines drawing between cities and a tick-up stat counter — using the project's existing CSS-keyframe + React-hook conventions (no new dependencies).

**Architecture:** A new `NetworkMap` component renders inside the existing `Hero` section ([Home.jsx:519](../../../src/views/marketing/Home.jsx#L519)), replacing the bare `<CityPins />` backdrop layer. It composes: the existing pins (reusing `CITY_PINS`/`.pin`/`pinPulse`/`ripple`), a new SVG layer of connector lines animated with a `lineDraw` keyframe, and a stat counter overlay built on the existing `useCounter` + `useReveal` hooks. A `prefers-reduced-motion` media query disables the new line/pulse animations for users who request reduced motion.

**Tech Stack:** React 19 (JSX, hooks), plain CSS-in-template-string (existing `CSS` constant + injected `<style>`), no new dependencies. No test runner in this project (`vite` + `eslint` only) — verification is via lint + visual check in the dev server.

---

## File Structure

- **Modify:** `src/views/marketing/Home.jsx`
  - Add `lineDraw` keyframe + `prefers-reduced-motion` rule to the `CSS` template string (~line 92, alongside other `@keyframes`)
  - Add `CONNECTOR_LINES` data array near `CITY_PINS` (~line 332)
  - Add `NetworkMap` component near `CityPins` (~line 413, after `CityPins` closes)
  - Modify `Hero` (~line 519) to render `<NetworkMap />` instead of `<CityPins />`

No new files — this is a small, focused addition to an existing component file that already holds the full marketing page (established pattern in this codebase).

---

### Task 1: Add `lineDraw` keyframe and reduced-motion rule to CSS

**Files:**
- Modify: `src/views/marketing/Home.jsx:89-93` (insert after the `@keyframes ripple` block, before `@keyframes orbDrift1`)
- Modify: `src/views/marketing/Home.jsx` end of `CSS` template string (insert `prefers-reduced-motion` block just before the closing backtick, currently ~line 296 area — locate the final `}` of the last rule in `CSS`)

- [ ] **Step 1: Add the `lineDraw` keyframe**

Open `src/views/marketing/Home.jsx` and find the `@keyframes ripple` block (around line 55-58):

```css
@keyframes ripple {
  0%   { transform: scale(1);   opacity: 0.4; }
  100% { transform: scale(2.5); opacity: 0; }
}
```

Immediately after its closing `}`, insert:

```css
@keyframes lineDraw {
  from { stroke-dashoffset: var(--line-len, 240); opacity: 0; }
  15%  { opacity: 0.5; }
  to   { stroke-dashoffset: 0; opacity: 0.5; }
}
```

- [ ] **Step 2: Add the connector-line class**

Right after the `.pin::after` rule (around line 209-213):

```css
.pin::after {
  content: ''; position: absolute; inset: -4px;
  border-radius: 50%; background: rgba(0,194,255,0.3);
  animation: ripple 2s ease-out infinite;
}
```

Insert a new rule for the connector-line paths:

```css
.net-line {
  fill: none;
  stroke: url(#netLineGrad);
  stroke-width: 1.5;
  stroke-dasharray: var(--line-len, 240);
  animation: lineDraw 1.6s ease-out forwards;
}
```

- [ ] **Step 3: Add the reduced-motion override**

Find the end of the `CSS` template string — the last CSS rule before the closing backtick and semicolon (search for `` `; `` near the end of the constant, after the responsive `@media` block around line 295-300). Add a new media query block right before the closing backtick:

```css
@media (prefers-reduced-motion: reduce) {
  .pin, .pin::after, .net-line, .hero-orb {
    animation: none !important;
  }
  .net-line { stroke-dashoffset: 0; opacity: 0.5; }
}
```

- [ ] **Step 4: Verify no syntax errors**

Run: `npm run lint`
Expected: no new errors introduced (pre-existing warnings, if any, are unrelated and unchanged)

- [ ] **Step 5: Commit**

```bash
git add src/views/marketing/Home.jsx
git commit -m "feat: add line-draw keyframe and reduced-motion rules for hero network map"
```

---

### Task 2: Add `CONNECTOR_LINES` data array

**Files:**
- Modify: `src/views/marketing/Home.jsx:332` (immediately after the `CITY_PINS` array closes)

- [ ] **Step 1: Add the data array**

Find the end of `CITY_PINS` (closes with `];` around line 332). Immediately after it, insert:

```js
// Connector lines reference CITY_PINS indices — curated subset forming a
// loose east-west "network" arc across the existing pin scatter.
const CONNECTOR_LINES = [
  { from: 0,  to: 2,  delay: 0.0 },
  { from: 2,  to: 4,  delay: 0.25 },
  { from: 5,  to: 7,  delay: 0.5 },
  { from: 7,  to: 9,  delay: 0.75 },
  { from: 10, to: 12, delay: 1.0 },
  { from: 12, to: 14, delay: 1.25 },
  { from: 1,  to: 8,  delay: 1.5 },
  { from: 6,  to: 13, delay: 1.75 },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/views/marketing/Home.jsx
git commit -m "feat: add connector-line data for hero network map"
```

---

### Task 3: Build the `NetworkMap` component

**Files:**
- Modify: `src/views/marketing/Home.jsx` — insert immediately after the `CityPins` function closes (currently ends at line 413, right before the `// ─── Nav ───` comment)

- [ ] **Step 1: Write the component**

Insert this new component directly after `CityPins` closes and before the `// ─── Nav ───` section comment:

```jsx
// ─── Network Map (animated hero backdrop) ────────────────────────────────────

function NetworkMap({ style }) {
  const [ref, on] = useReveal(0.2);
  const screens = useCounter(2400, 1800, on);
  const cities = useCounter(14, 1200, on);

  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ...style }}>
      {/* Connector lines, drawn over the pin scatter */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      >
        <defs>
          <linearGradient id="netLineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00C2FF" />
            <stop offset="100%" stopColor="#7B2FFF" />
          </linearGradient>
        </defs>
        {on && CONNECTOR_LINES.map((line, i) => {
          const a = CITY_PINS[line.from];
          const b = CITY_PINS[line.to];
          const len = Math.hypot(b.x - a.x, b.y - a.y) * 4; // scale to viewBox units roughly
          return (
            <path
              key={i}
              className="net-line"
              d={`M ${a.x} ${a.y} L ${b.x} ${b.y}`}
              style={{
                '--line-len': len,
                animationDelay: `${line.delay}s`,
              }}
            />
          );
        })}
      </svg>

      {/* Pins — reuse existing scatter */}
      <CityPins />

      {/* Stat overlay */}
      <div style={{
        position: 'absolute', bottom: '6%', left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 24, alignItems: 'center',
        fontFamily: 'var(--inter)', fontSize: 13, color: 'var(--sec)',
        letterSpacing: '0.02em', whiteSpace: 'nowrap',
      }}>
        <span><strong style={{ color: '#fff', fontWeight: 700 }}>{screens.toLocaleString()}+</strong> screens</span>
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--muted)' }} />
        <span><strong style={{ color: '#fff', fontWeight: 700 }}>{cities}</strong> cities</span>
      </div>
    </div>
  );
}
```

**Note:** the placeholder figures `2400` / `14` match the spec's stated stat copy ("2,400+ screens · 14 cities") — confirm real numbers with the user before shipping to production if these are meant to reflect live counts.

- [ ] **Step 2: Commit**

```bash
git add src/views/marketing/Home.jsx
git commit -m "feat: add NetworkMap component combining pins, connector lines, and stat counter"
```

---

### Task 4: Wire `NetworkMap` into the `Hero` section

**Files:**
- Modify: `src/views/marketing/Home.jsx:519-521`

- [ ] **Step 1: Replace the `<CityPins />` backdrop layer**

Find this block in `Hero` (around line 518-521):

```jsx
      {/* City screen pins — low opacity */}
      <div className="orb-load" style={{ position: 'absolute', inset: 0, opacity: 0.18, pointerEvents: 'none' }}>
        <CityPins />
      </div>
```

Replace it with:

```jsx
      {/* Live network map — pins, connector lines, stat counter */}
      <div className="orb-load" style={{ position: 'absolute', inset: 0, opacity: 0.22, pointerEvents: 'none' }}>
        <NetworkMap />
      </div>
```

(Opacity nudged from `0.18` to `0.22` so the connector lines and stat text stay legible against the dark backdrop without competing with the headline — still well within the "low opacity backdrop" range that keeps text readable.)

- [ ] **Step 2: Run the dev server and visually verify**

Run: `npm run dev`

Open the marketing home page in a browser. Confirm:
- Pins still pulse as before
- Connector lines draw in (animate from invisible to a glowing gradient stroke) shortly after the hero scrolls into view
- The "X+ screens · Y cities" counter ticks up once near the bottom of the hero backdrop and holds
- Headline/CTA text remains fully readable over the backdrop
- Toggle OS-level "reduce motion" (Windows: Settings → Accessibility → Visual effects → Animation effects → off) and confirm pins/lines go static with no animation

- [ ] **Step 3: Commit**

```bash
git add src/views/marketing/Home.jsx
git commit -m "feat: replace hero pin backdrop with animated NetworkMap"
```

---

### Task 5: Final lint and review pass

**Files:**
- Review only: `src/views/marketing/Home.jsx`

- [ ] **Step 1: Run lint one more time across the full file**

Run: `npm run lint`
Expected: clean (matches pre-existing baseline — no new warnings/errors from the added code)

- [ ] **Step 2: Re-check the spec against the implementation**

Re-read [docs/superpowers/specs/2026-06-07-hero-network-map-design.md](../specs/2026-06-07-hero-network-map-design.md) and confirm each requirement is met:
- Pins pulse in staggered sequence — ✓ via reused `CITY_PINS`/`pinPulse`
- Connector lines draw between active pins — ✓ via `CONNECTOR_LINES` + `lineDraw`
- Stat counter ticks up and holds — ✓ via `useCounter` + `useReveal`
- Headline/CTA remain readable — ✓ verified visually in Task 4
- `prefers-reduced-motion` respected — ✓ via the media query in Task 1

- [ ] **Step 3: Final commit (if any cleanup was needed)**

```bash
git add src/views/marketing/Home.jsx
git commit -m "chore: final lint cleanup for hero network map"
```

(Skip this commit if Steps 1-2 found nothing to change.)
