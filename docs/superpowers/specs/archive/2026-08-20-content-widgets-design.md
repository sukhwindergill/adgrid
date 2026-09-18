# Content Widgets — Design

Batch 3 of the site-polish backlog (see batch 1: `2026-08-20-layout-chrome-design.md`, batch 2: `2026-08-20-feedback-states-design.md`). Covers: copy-to-clipboard buttons, a password visibility toggle, a cookie banner, and a marketing-site search. (Expandable FAQ sections already existed pre-backlog — see batch 1's spec. Dark mode toggle was scoped out — see decision below.)

## Context / prior art and scope decisions

- **Expandable FAQ** — `src/views/marketing/sections/Faq.jsx` already implements an accordion. Not touched.
- **Copy-to-clipboard** — already implemented ad-hoc in 4 files: `src/components/shared/ShareReportModal.jsx`, `src/views/operator/ScreenDetail.jsx` (3 separate copy buttons), `src/views/operator/ScreenOnboard.jsx` (`CopyBox`/`CodeBox` helper components), `src/views/shared/IntegrationsView.jsx`. This batch extracts a shared primitive and refactors these 4 spots onto it.
- **Password visibility toggle** — the app has exactly one password field, in `src/components/login/LoginPage.jsx`'s local `DarkInp` helper. Small, contained target.
- **Dark mode toggle** — investigated and **dropped from this batch**. The entire app uses hardcoded hex colors via `src/design/tokens.js` (`C.bg`, `C.surface`, etc.) with no CSS custom properties and no dark-mode variants anywhere in the codebase. A real dark mode requires a token-system rewrite (CSS variables or a theme-context + doubled token maps) touching every component that imports `C`/`F` from `tokens.js` — a separate, much larger project, not an incremental widget. Out of scope here.
- **Cookie banner** — none exists. Net new.
- **Full site search** — none exists. Scoped down to marketing-site-only client-side search (no backend, no search index infra) — see below.

## Scope

1. `CopyButton` primitive + refactor of the 4 existing ad-hoc copy spots
2. Password visibility toggle on `LoginPage`'s password field
3. `CookieBanner` (marketing/public pages only)
4. Marketing site search (client-side, no backend)

## Architecture

### 1. `CopyButton` primitive

New file `src/components/primitives/CopyButton.jsx`:

```jsx
export function CopyButton({ value, label = 'Copy', copiedLabel = 'Copied!', variant = 'secondary', size = 'sm', style = {} }) {
  // useState(copied), setTimeout(2000ms) to reset — same timing as the existing
  // ScreenOnboard.jsx CopyBox/CodeBox pattern being replaced
  // navigator.clipboard.writeText(value).then(() => setCopied(true))
  // renders <Btn variant={variant} size={size} onClick={copy} style={style}>{copied ? copiedLabel : label}</Btn>
}
```

Built on top of the existing `Btn` primitive (`src/components/primitives/Btn.jsx`, already has hover states and variants from batch 2) rather than a raw `<button>`, so it inherits consistent styling for free. No toast dependency — callers that want a toast on top (like `ShareReportModal.jsx` currently does via `useToast()`) keep that as a separate `onCopied` callback prop:

```jsx
export function CopyButton({ value, label = 'Copy', copiedLabel = 'Copied!', variant = 'secondary', size = 'sm', style = {}, onCopied }) {
  // ...same as above, plus: onCopied?.() after a successful copy
}
```

**Refactor targets** (replace the inline `navigator.clipboard.writeText(...)` + local copied-state logic with `<CopyButton value={...} .../>`, preserving each call site's existing visible label and toast/feedback behavior):

- `src/components/shared/ShareReportModal.jsx` — `copy(token)` becomes `<CopyButton value={urlFor(token)} onCopied={() => toast.success('Link copied')} label="Copy link" />` (or equivalent inline, matching existing visible text).
- `src/views/operator/ScreenDetail.jsx` — three buttons: `copyInviteLink(token, id)` (has its own per-row `copiedInviteId` state — becomes a plain `<CopyButton>` per row, dropping the manual `copiedInviteId` state since `CopyButton` owns its own local `copied` state now), "Copy Token", "Copy Player URL".
- `src/views/operator/ScreenOnboard.jsx` — `CopyBox`/`CodeBox` helper components' internal copy button becomes `<CopyButton>`; keep the surrounding box/label markup, only replace the button element.
- `src/views/shared/IntegrationsView.jsx` — the absolutely-positioned "Copy" button over the tracking-pixel snippet.

No new "missing" spots are added — `GrantAccessModal.jsx` was checked as a plausible candidate (account-access invites) and found not to generate any shareable link/token, so there's nothing to wire there.

### 2. Password visibility toggle

In `src/components/login/LoginPage.jsx`, `DarkInp` (currently used for name/email/password fields) gets an optional `toggleable` boolean prop. When `true` (passed only on the password field usage):

- Local `useState` tracks `visible` (default `false`).
- The `<input>`'s `type` becomes `visible ? 'text' : 'password'` instead of the static `type` prop when `toggleable` is set.
- An eye/eye-off icon button is absolutely-positioned inside the input's wrapper `<div>` (which needs `position: 'relative'` added), toggling `visible` on click. Uses simple text/emoji glyphs (👁 / 🙈, matching the codebase's existing emoji-icon convention seen in `GlobalHeader.jsx`'s "👁 Viewing as..." impersonation banner) rather than an SVG icon set, since the codebase has no icon library dependency.
- `type="button"` on the toggle so it never triggers form submission (the surrounding form's Enter-key handler is on the input itself, not this button).

### 3. `CookieBanner`

New file `src/components/chrome/CookieBanner.jsx`, following the same `src/components/chrome/` convention as batch 1's `SkipLink`/`ScrollToTopButton`/etc.:

- Fixed bottom bar (below `FloatingContactButton`'s left position and `StickyMobileCta`'s full-width mobile bar — needs its own non-colliding placement, see below), plain-language copy (e.g. "We use minimal cookies to keep you signed in and remember your preferences.") plus a single "Got it" dismiss button — not a two-button accept/decline consent gate, since the site doesn't currently set any non-essential/tracking cookies to gate.
- Dismissal persisted via `localStorage.setItem('adgrid_cookie_ack', '1')`; on mount, checks `localStorage.getItem('adgrid_cookie_ack')` and renders `null` if already acknowledged.
- **Placement:** full-width bar pinned to the very bottom (`bottom: 0`, not `24px` up like the floating buttons), so it sits below/behind the floating buttons rather than overlapping them — those already have deliberate `z-index: 500`; the cookie banner uses a lower `z-index` (e.g. `400`) so if both are visible simultaneously the floating buttons stay on top and legible, and the banner's own dismiss action means it's transient (first-visit only) rather than a permanent fixture competing for the same space.
- Mounted on marketing/public pages only, same scope decision as `FloatingContactButton` — via `MarketingHome.jsx` (not site-wide `SiteChrome`, since a cookie banner in the authenticated dashboard is unusual UX for an already-logged-in user).

### 4. Marketing site search

New file `src/views/marketing/sections/SiteSearch.jsx`:

- A small static searchable index built at module load from existing marketing copy already in the codebase — hand-written array of `{ id, section, title, text }` entries covering each marketing section's heading + summary (Hero, HowItWorks, OperatorsSection, AdvertisersSection, MarketBand) plus every existing FAQ Q&A pair (imported/duplicated from `Faq.jsx`'s `FAQS` array — reuse that array directly via export rather than re-typing it, to avoid drift).
- Search input rendered in `Nav.jsx` (both desktop nav-mid row and the mobile dropdown), opens a small results dropdown/overlay on input, filtered by simple case-insensitive substring match against `title`+`text` (no fuzzy-matching library — substring match is sufficient for a handful of static entries and adds no dependency).
- Clicking a result scrolls to that section via the same `scrollTo(id)` handler `Nav.jsx` already receives as a prop, then closes the search overlay (mirrors the existing `go(id)` pattern already in `Nav.jsx` for its nav links).
- No backend, no index build step, no new dependency.

## Data flow / state

- `CopyButton` and the password toggle: fully local component state, no new global state.
- `CookieBanner`: reads/writes `localStorage` only, no global state, no backend.
- `SiteSearch`: local component state for the query string and open/closed dropdown; the searchable index is a static in-memory array computed once at module load, not fetched.

## Error handling

- `CopyButton`: `navigator.clipboard.writeText` can reject (e.g. no clipboard permission) — catch and no-op (matches existing `ShareReportModal.jsx` behavior of falling back to a toast telling the user to copy manually; that fallback stays the responsibility of the `onCopied`-calling parent, `CopyButton` itself doesn't need to render an error UI since it's a small optional enhancement, not critical-path).
- `CookieBanner`, `SiteSearch`: no network calls, no failure modes beyond standard React rendering; `localStorage` access wrapped in a try/catch in case it's unavailable (e.g. private browsing with storage disabled) — falls back to always showing the banner rather than crashing.

## Testing

- `CopyButton.test.jsx`: renders with default label, copies `value` to clipboard on click (mock `navigator.clipboard.writeText`), shows `copiedLabel` after click then reverts after the timeout, calls `onCopied` when provided.
- Password toggle: extend or add `LoginPage.test.jsx` coverage — toggle button flips the input's `type` attribute between `password`/`text` on click, and back on a second click.
- `CookieBanner.test.jsx`: renders when `localStorage` has no ack key, hides after clicking "Got it", doesn't render on a fresh mount if the ack key is already set (mock `localStorage`).
- `SiteSearch.test.jsx`: typing a query that matches a known FAQ/section entry shows it in results; typing a query matching nothing shows an empty/no-results state; clicking a result calls the provided `scrollTo` handler with the right section id.
