# Animated Network Map Hero — Design

## Goal
Replace the current static/CSS-orb hero visual on the marketing Home ([Home.jsx](../../../src/views/marketing/Home.jsx)) with a polished, looping "live network" animation: a stylized Canada map with pulsing screen-location pins, drawing connector lines, and a ticking stat counter. Sells scale and reach at a glance, elevates the page from "nicely animated" to "high-end product."

## Why plain CSS/React (no new deps)
Checked package.json: project has **no GSAP, no HyperFrames, no animation library** — Home.jsx is built entirely on CSS keyframes + small React hooks (`useReveal` for scroll-triggered reveals, `useCounter` for tick-up stats, per-element `delay` props for staggering — see `CITY_PINS` array and `.pin`/`pinPulse`/`ripple` keyframes already in the file). Matching that convention ships faster, adds zero dependencies, and keeps the file consistent with the rest of the page.

## Approaches considered
- **A — Plain CSS/SVG + small sequencing hook (chosen)**: reuse existing `pinPulse`/`ripple` keyframes, stagger via per-pin `delay`, animate SVG line `stroke-dashoffset` via CSS, drive the counter with the existing `useCounter` hook gated by `useReveal`. Zero new deps, fits codebase exactly.
- **B — HyperFrames/GSAP composition**: would give precise single-timeline coordination, but requires adding a new runtime + GSAP dependency the project doesn't currently use — bigger lift than warranted for a 6-10s ambient loop.
- **C — Canvas/WebGL particles**: highest visual ceiling but heavy (custom render loop, perf tuning) — overkill here.

## Composition
- Stylized SVG outline of Canada, palette matches existing design tokens (`--c1` #00C2FF → `--c2` #7B2FFF gradient, `--bg` #0A0A0F backdrop)
- 6-8 city pins: Toronto, Vancouver, Montreal, Calgary, Ottawa, Edmonton, Halifax, Winnipeg
- Stat overlay: counter reading "2,400+ screens · 14 cities" (placeholder figures — confirm real numbers before ship)

## Timeline (6-10s seamless loop, CSS-driven)
1. Pins pulse on in staggered sequence — reuse the existing `.pin` / `pinPulse` / `ripple` keyframes and `delay` stagger pattern from `CITY_PINS`
2. Connector lines draw between a curated subset of active pins — SVG `<path>` with `stroke-dasharray`/`stroke-dashoffset` animated via a new CSS keyframe (`lineDraw`), staggered after pin pulse-in
3. Counter ticks up once and holds — drive with the existing `useCounter(target, duration, started)` hook (already in Home.jsx), gated by `useReveal` so it fires once when the hero scrolls into view
4. Infinite-looping pieces (pin pulse/ripple) already loop seamlessly via `infinite` CSS animation; the line-draw plays once per mount (matches "ambient, low distraction" — no jarring full-loop reset needed for a hero that's visible on load)

## Placement
- Upgrades the hero's existing low-opacity `<CityPins />` background layer in [Home.jsx](../../../src/views/marketing/Home.jsx) (around line 519) — adds the Canada outline, connector lines, and stat counter to that same backdrop layer; keeps current orbs/grid
- Headline + CTA text overlay stays as-is on top; map sits as backdrop at low opacity (matches current `opacity: 0.18` treatment so text stays readable — no new scrim needed)

## Integration
- New `NetworkMap` component (SVG + pins + lines + counter), rendered inside the hero in place of/alongside `<CityPins />`
- Respect `prefers-reduced-motion`: wrap animation classes in a media query (`@media (prefers-reduced-motion: reduce)`) that disables `pinPulse`/`ripple`/`lineDraw`, leaving static pins — same pattern would apply to existing orb animations if extended later

## Out of scope
- Real screen-location data wiring (counter uses placeholder stat, not live DB query)
- Mobile-specific simplified variant (initial build targets desktop hero; mobile gets existing fallback or simplified static version — follow-up if needed)
