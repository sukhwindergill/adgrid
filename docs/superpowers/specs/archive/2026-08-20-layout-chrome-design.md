# Layout Chrome — Design

Batch 1 of a larger site-polish backlog (skip-to-content, scroll-to-top, scroll progress bar, floating contact button, mobile menus, loading animations, hover states, scroll progress, copy-to-clipboard, print stylesheet, sticky headers, password toggle, UTM tracking, form success/error states, confirmation modals, last-updated dates, expandable FAQ, floating contact button, dark mode toggle, cookie banner, site search).

## Context / prior art

Investigation of the existing codebase found several requested items already implemented:

- **Sticky header** — `GlobalHeader.jsx` (dashboard) is already `position: sticky; top: 0`.
- **Mobile menu** — `views/marketing/sections/Nav.jsx` already has a hamburger + mobile dropdown. Dashboard `Sidebar.jsx` already collapses to an icon-rail on mobile via `useBreakpoint`.
- **Expandable FAQ** — `views/marketing/sections/Faq.jsx` already implements an accordion.

These are out of scope for this batch. This spec covers the four remaining net-new items only.

## Scope

1. Skip-to-content link
2. Scroll-to-top button
3. Scroll progress bar
4. Floating contact button

## Architecture

New directory: `src/components/chrome/` — small, self-contained, no new dependencies. Styling via inline styles using existing `C` (colors) and `F` (fonts) tokens from `src/design/tokens.js`, matching the codebase's existing convention (see `GlobalHeader.jsx`).

### 1. `SkipLink.jsx`

- Renders `<a href="#main-content" className="skip-link">Skip to content</a>`.
- Visually hidden by default (absolute positioned off-screen), becomes visible on `:focus` (moves on-screen, high z-index, high contrast).
- Styling via a small CSS class added to `src/index.css` (needs `:focus` pseudo-class, not expressible in inline styles).
- Mounted once, as the very first child of `App()`, before `<Routes>`.
- Each route target needs `id="main-content"` on its outermost rendered container so the link has something to jump to:
  - `AppShell.jsx` (dashboard shell) — add `id="main-content"` to its main content wrapper.
  - `MarketingHome.jsx` — add to its root `<div className="mktg">`.
  - `PrivacyPolicy.jsx`, `TermsOfService.jsx`, `ThankYou.jsx`, `NotFound.jsx` — add to each root container.
- Not mounted on `/display/:token` (kiosk display player — no keyboard-nav audience).

### 2. `ScrollToTopButton.jsx`

- Fixed bottom-right (e.g. `bottom: 24, right: 24`), circular button with an up-arrow icon.
- Own `useEffect` scroll listener toggling visibility state: hidden until `window.scrollY > 400`, fade/scale transition.
- `onClick` → `window.scrollTo({ top: 0, behavior: 'smooth' })`.
- Renders `null` when not visible (no DOM cost when hidden).
- Mounted once at the `App()` root level (sibling to `<Routes>`, inside the `Suspense` boundary at the top), so it's present across all routes.
- Excluded on `/display/:token` via a route check (kiosk player owns its own fullscreen UI).

### 3. `ScrollProgressBar.jsx`

- Fixed top of viewport, 3px tall, `width: ${progress}%`, gradient fill (reuse the existing purple gradient from `GlobalHeader`'s avatar: `linear-gradient(135deg, #7c3aed, #a855f7)`).
- `z-index` above the dashboard header's `100` (e.g. `101`) so it stays visible under the sticky header on dashboard pages.
- Progress computed on scroll: `scrollY / (scrollHeight - innerHeight) * 100`, clamped 0–100.
- Mounted alongside `ScrollToTopButton`, same exclusion for `/display/:token`.

### 4. `FloatingContactButton.jsx`

- Fixed bottom-left (`bottom: 24, left: 24`), pill-shaped button, "Contact us" label + chat-bubble icon.
- `onClick` scrolls to `#waitlist-form`, mirroring the existing pattern in `StickyMobileCta.jsx` (`scrollTo('waitlist-form')`).
- **Marketing home only** — mounted directly inside `MarketingHome.jsx` next to the existing `<StickyMobileCta />`, not at the `App()` root (no equivalent target section exists on other pages).
- On small viewports, position must not collide with the existing `StickyMobileCta` bar — offset above it or hide `FloatingContactButton` at the same breakpoint where `StickyMobileCta` takes over (check `StickyMobileCta.jsx`'s breakpoint during implementation).

## Data flow / state

No new global state, no backend/API changes. Each component is fully self-contained (local `useState`/`useEffect` for scroll tracking).

## Error handling

None needed — pure UI, no network calls, no failure modes beyond standard React rendering.

## Testing

- Component-level render tests (vitest + testing-library) for each of the 4 components: renders, responds to scroll-position thresholds (mock `window.scrollY`/`scrollTo`), click handlers fire.
- Skip link: assert `href="#main-content"` and that at least one route's root element carries `id="main-content"`.
