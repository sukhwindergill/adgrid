# Animated Network Map Hero — Design

## Goal
Replace the current static/CSS-orb hero visual on the marketing Home ([Home.jsx](../../../src/views/marketing/Home.jsx)) with a polished, looping "live network" animation: a stylized Canada map with pulsing screen-location pins, drawing connector lines, and a ticking stat counter. Sells scale and reach at a glance, elevates the page from "nicely animated" to "high-end product."

## Why HyperFrames
The platform already leans on in-browser CSS/GSAP animation (orb drift, gradient text, scroll reveals — see CSS block in Home.jsx). HyperFrames extends that pattern with a single seek-driven GSAP timeline that coordinates many elements precisely, without adding a video render pipeline (ruled out Remotion/Canvas — see approaches below).

## Approaches considered
- **A — Extend existing CSS/SVG keyframes**: fastest, zero new deps, but CSS keyframes can't coordinate many synced elements (pins + lines + counter) cleanly.
- **B — HyperFrames composition (chosen)**: one paused `gsap.timeline()` drives every pin pulse, line draw, and counter tick in sync. Scrubbable, easy to extend with more cities later.
- **C — Canvas/WebGL particles**: highest visual ceiling but heavy (custom render loop, perf tuning) — overkill for a 6-10s ambient loop.

## Composition
- Stylized SVG outline of Canada, palette matches existing design tokens (`--c1` #00C2FF → `--c2` #7B2FFF gradient, `--bg` #0A0A0F backdrop)
- 6-8 city pins: Toronto, Vancouver, Montreal, Calgary, Ottawa, Edmonton, Halifax, Winnipeg
- Stat overlay: counter reading "2,400+ screens · 14 cities" (placeholder figures — confirm real numbers before ship)

## Timeline (6-10s seamless loop)
1. Pins pulse on in staggered sequence (scale + opacity, ripple effect — reuses `pinPulse`/`ripple` keyframe concepts already in Home.jsx CSS)
2. Connector lines draw between active pins (stroke-dashoffset animation)
3. Counter ticks up once, holds at final value
4. Loop resets cleanly — final frame state matches frame 0 (no visible jump)

## Placement
- Replaces the hero's current background visual in [Home.jsx](../../../src/views/marketing/Home.jsx) (the orb/grid section near the top)
- Headline + CTA text overlay on top, unchanged in position; map sits as backdrop
- Add subtle scrim/gradient behind text to preserve readability over the animated map

## Integration
- HyperFrames comp embeds via its runtime player (HTML/GSAP), mounted inside the existing hero `<section>` 
- Respect `prefers-reduced-motion`: fall back to a static frame (final pulse state) for users who request it

## Out of scope
- Real screen-location data wiring (counter uses placeholder stat, not live DB query)
- Mobile-specific simplified variant (initial build targets desktop hero; mobile gets existing fallback or simplified static version — follow-up if needed)
