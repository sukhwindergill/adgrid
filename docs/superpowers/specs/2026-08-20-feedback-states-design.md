# Feedback States — Design

Batch 2 of the site-polish backlog (see `docs/superpowers/specs/2026-08-20-layout-chrome-design.md` for batch 1). Covers: loading animations, hover states, form success/error states, confirmation modals.

## Context / prior art

Investigation of the existing codebase found most of this batch already implemented:

- **Confirmation modals** — `src/components/primitives/ConfirmModal.jsx` (`ConfirmProvider` + `useConfirm()`) already exists and is used in 12 places across the app.
- **Form success/error states** — `src/components/primitives/Toast.jsx` (`ToastProvider` + `useToast()`, success/error variants) already exists and is used in 13 places. The marketing waitlist form (`src/views/marketing/sections/CtaBand.jsx`) already has its own inline submitting/error/success (redirect) handling.
- **Loading animations** — `src/components/ui/Skeleton.jsx` already provides a pulsing placeholder primitive, used for content loading states.
- **Hover states** — `src/components/primitives/Btn.jsx` already has hover handlers for the `primary` and `secondary` variants; `src/components/primitives/Card.jsx` already has a hover box-shadow when `onClick` is passed; `marketing.css` already has 8 `:hover` rules for the public site.

These are out of scope for this batch. This spec covers the two remaining net-new items only.

## Scope

1. Hover states for `Btn`'s remaining variants (`ghost`, `danger`, `success`, `stripe`)
2. A reusable `Spinner` primitive + a `loading` prop on `Btn`

## Architecture

### 1. `Btn.jsx` — hover states for remaining variants

Extend the existing `onMouseEnter`/`onMouseLeave` handlers in `src/components/primitives/Btn.jsx` (currently only branching on `variant === 'primary'` and `variant === 'secondary'`) with branches for the remaining variants, following the same "swap background/boxShadow via direct style mutation" pattern already used:

- `ghost`: `background: 'transparent'` → `C.surfaceAlt` on hover, back to `'transparent'` on leave.
- `danger`: `background: C.redSoft` → a deeper red tint on hover. Reuse `C.red` at low opacity via an inline `rgba` (no new token needed — mirrors how `primary`'s hover uses `C.purpleDark`, a token that already exists one shade darker; since there's no `C.redDark` token, use `rgba(239,68,68,0.16)` — one shade darker than `C.redSoft`'s `#fef2f2` — as the hover fill), back to `C.redSoft` on leave.
- `success`: same pattern with `rgba(16,185,129,0.16)` hover fill (one shade darker than `C.greenSoft`), back to `C.greenSoft` on leave.
- `stripe`: `background: '#635bff'` → `'#5147e6'` on hover (darker version of Stripe's brand purple, same darkening ratio as `primary`'s `C.grad` → `C.purpleDark` step), back to `'#635bff'` on leave.

All hover branches keep the existing `if (!disabled)` guard already wrapping the handler body.

### 2. `Spinner` primitive

New file `src/components/primitives/Spinner.jsx`, following `Skeleton.jsx`'s established pattern of injecting a single `@keyframes` stylesheet into `document.head` on first import (guarded by an `id` check so it's only injected once):

```jsx
const keyframes = `
@keyframes spinner-rotate {
  to { transform: rotate(360deg); }
}`;
// inject once, same guard pattern as Skeleton.jsx
```

`Spinner` renders a small `<span>` styled as a circular ring: fixed `width`/`height` (default `14px`, overridable via a `size` prop), `border: 2px solid currentColor`, one side transparent (`borderTopColor: 'transparent'`) to create the spin illusion, `borderRadius: '50%'`, `animation: 'spinner-rotate 0.6s linear infinite'`. Using `currentColor` means it automatically matches whatever `color` the parent button variant sets (e.g. white on `primary`, `C.red` on `danger`) — no per-variant spinner styling needed.

### 3. `loading` prop on `Btn`

`Btn` gets a new optional `loading` boolean prop (default `false`):

- When `loading` is `true`: the button is forced `disabled` (`disabled={disabled || loading}`), `cursor: 'not-allowed'` regardless of the `disabled` prop, and the visible content becomes a `<Spinner />` positioned in place of the existing `icon`/`children` row.
- To avoid the button changing width when the spinner appears (distracting layout shift), the original `children` stay rendered but visually hidden (`visibility: 'hidden'`) in a wrapper, with the `Spinner` absolutely positioned centered over the button — same technique commonly used for this exact problem. Concretely: the button's content becomes `<span style={{ visibility: loading ? 'hidden' : 'visible', display: 'inline-flex', alignItems: 'center', gap: 6 }}>{icon}{children}</span>` plus, when `loading`, an absolutely-positioned `<Spinner />` centered via `position:absolute; inset:0; display:flex; alignItems:center; justifyContent:center`. The button itself needs `position: 'relative'` added to its style for the absolute spinner to anchor correctly.

No new dependencies. No changes to `ConfirmModal.jsx`, `Toast.jsx`, or `Skeleton.jsx` — they're already complete for this batch's purposes.

## Data flow / state

None — `loading` is a plain prop, caller-controlled (e.g. `<Btn loading={submitting}>Save</Btn>`), same pattern as the existing `disabled` prop.

## Error handling

None needed — pure presentational change, no network calls, no new failure modes.

## Testing

- `Spinner.test.jsx`: renders, has the spin animation class/style, respects a custom `size` prop.
- `Btn.test.jsx` (new or extended if one already exists — check before creating): `loading` prop disables the button, renders a spinner, keeps original children in the DOM (hidden, not removed) so accessible name / testing-library queries by text still find it, and that `onClick` doesn't fire while `loading` is true (mirroring existing `disabled` behavior).
- No test needed for the hover-state color changes themselves (jsdom doesn't render CSS, and mouse-enter/leave inline-style mutations were not previously tested for `primary`/`secondary` either — consistent with existing test coverage for this file).
