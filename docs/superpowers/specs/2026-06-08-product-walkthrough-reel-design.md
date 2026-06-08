# Animated Product Walkthrough Reel — Design

## Goal
Add a new section directly below the marketing Home hero ([Home.jsx](../../../src/views/marketing/Home.jsx)) that shows a short looping "demo reel" cycling through 4 stylized product screens. Sells "this is a real, polished product" right after the hero's headline impact — replaces the earlier network-map-as-proof-of-scale idea (dropped after visual review) with a more direct product-credibility visual.

## Why plain CSS/React (no new deps)
Same constraint as the hero work: no GSAP/animation library in the project. No real product screenshots exist either (`src/assets` only has placeholder images) — the "screens" are hand-built mock UI, matching how `HowItWorks` and `CityPins` already fabricate visuals from divs/CSS rather than imagery.

## Composition
- **Device frame**: a stylized browser/display bezel (CSS-drawn — rounded rect, top bar with traffic-light dots, subtle border/glow in `--c1`/`--c2` tones) that hosts the reel content. Gives the screens a "real product" anchor.
- **4 mock-UI panels**, each a simplified CSS/div composition standing in for a real screen:
  1. **Operator dashboard** — inventory cards, fill-rate bar, earnings figure
  2. **Map / browse screens** — stylized map backdrop with pin markers and a price-tag card
  3. **Campaign analytics** — bar/line chart shapes, impression/reach stat tiles
  4. **Live display preview** — a mini "screen within the screen" showing a sample ad creative placeholder
- **Caption label** beneath the frame, crossfading in sync with the active panel (e.g. "Operator dashboard — list inventory, track fill rate")
- **Progress dots** (4, one per screen) below the caption, reusing the existing `.pin` dot visual language — active dot brighter/larger to show position in the cycle

## Data flow
A `REEL_SCREENS` array — `{ key, label, caption, render }` shape, mirroring the existing `steps` array pattern in `HowItWorks` — drives panels, captions, and dots from one source of truth. `render` is a small per-screen component (`OperatorPanel`, `MapPanel`, `AnalyticsPanel`, `DisplayPanel`) so each mock UI stays isolated and easy to adjust independently.

## Timeline (crossfade cycle)
1. `useReveal` gates the cycle — it doesn't start until the section scrolls into view (matches `NetworkMap`'s counter-trigger pattern, avoids animating off-screen)
2. `useState` index + `setInterval` (~4000ms) advances the active screen; cleared on unmount and paused when `prefers-reduced-motion` is set
3. Panels crossfade via CSS `opacity` transition (~600ms) — outgoing panel fades out as incoming fades in, both absolutely positioned within the frame so there's no layout jump
4. Caption and active dot crossfade/highlight in sync with the panel transition
5. Cycle loops indefinitely (1 → 2 → 3 → 4 → 1 …)

## Placement
- New section, inserted immediately after `<Hero />` and before `<ProblemSection />` in the `Root`/page composition (becomes the new "S2", existing sections shift down by one — no renumbering of section `id`s required since they're semantic, not positional)
- Background: `var(--surface)` or `var(--bg)` (whichever creates clearest contrast against the hero above and `ProblemSection` below — confirmed during implementation by visual check)
- Heading + one-line intro above the frame (e.g. "See it in action" / "From listing to live in minutes"), styled consistently with other section headers (`.tag` + `.sec-h` classes used in `HowItWorks`)

## Integration
- New `ProductReel` component (frame + cycler + panels + caption + dots), self-contained section like `HowItWorks`/`OperatorsSection`
- Reuses `useReveal` (existing hook) for scroll-gated start
- New `useInterval`-style effect inline (no new hook needed — small enough to inline in `ProductReel`, following the codebase's preference for inlining over abstracting single-use logic)
- Respects `prefers-reduced-motion`: cycle does not auto-advance; first screen (`Operator dashboard`) shown statically, dots still indicate position but don't animate

## Out of scope
- Real product screenshots (mock UI only — revisit if/when real screenshots become available)
- User-controlled navigation (no click-to-advance / arrows — purely ambient, matches "ambient demo reel" framing)
- Mobile-specific simplified variant (initial build targets desktop; mobile gets existing responsive fallback patterns or a simplified static single-panel view if needed — follow-up if required)
