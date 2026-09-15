# Infra: UTM Tracking — Design

Batch 4 (final) of the site-polish backlog (see batch 1: `2026-08-20-layout-chrome-design.md`, batch 2: `2026-08-20-feedback-states-design.md`, batch 3: `2026-08-20-content-widgets-design.md`). Covers: UTM tracking. (A print stylesheet and last-updated dates were the other two items requested in this batch — both already existed pre-backlog, see decision below.)

## Context / prior art and scope decisions

- **Print stylesheet** — already exists at `src/views/public/CampaignReport.css` (`@media print` rules hiding report actions, adjusting layout, page-break rules for tables). Covers the one page where printing is a plausible user need (a shareable campaign delivery report). Not touched.
- **Last-updated dates** — already exist as static text on `src/views/legal/PrivacyPolicy.jsx` and `src/views/legal/TermsOfService.jsx` ("Last updated: June 29, 2026"). Not touched.
- **UTM tracking** — investigated and found genuinely absent. `src/views/advertiser/ScansView.jsx` only *reads* a `utm_source` database column (populated by some other, unrelated flow — QR scan attribution, not marketing-site visits); nothing anywhere captures UTM query parameters from an incoming URL. This is the only net-new item in this batch.

## Scope

Capture UTM query parameters (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`) from the URL a visitor first lands on, persist them for the browser session, and use them to pre-fill the existing "How did you hear about AdGrid?" free-text field on the marketing waitlist form (`src/views/marketing/sections/CtaBand.jsx`) — no database schema change, no new columns. The captured value rides the existing `source` text column exactly as if the user had typed it themselves.

## Architecture

### `src/lib/utm.js`

Two small, pure functions:

```js
const STORAGE_KEY = 'adgrid_utm';
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

export function captureUtmParams() {
  const params = new URLSearchParams(window.location.search);
  const found = {};
  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) found[key] = value;
  }
  if (Object.keys(found).length === 0) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(found));
  } catch {
    // sessionStorage unavailable — fail silently, UTM capture is best-effort
  }
}

export function getUtmLabel() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { utm_source, utm_medium, utm_campaign } = JSON.parse(raw);
    const parts = [utm_source, utm_medium, utm_campaign].filter(Boolean);
    return parts.length > 0 ? parts.join(' / ') : null;
  } catch {
    return null;
  }
}
```

- `captureUtmParams()` reads whichever of the five standard UTM keys are present on the current URL's query string and stores them as JSON in `sessionStorage` — only if at least one is present (an empty capture isn't written, so a later page without UTM params in its URL doesn't clobber an earlier capture during the same session).
- `getUtmLabel()` reads back `utm_source`/`utm_medium`/`utm_campaign` specifically (the three most human-readable for a free-text field — `utm_term`/`utm_content` are stored but not surfaced in the label, since they're typically keyword/ad-variant IDs that read poorly as a short label) and joins the present ones with `" / "`.
- Both wrapped in try/catch — `sessionStorage` can throw in some private-browsing/storage-disabled configurations; this is a best-effort marketing attribution nicety, not critical functionality, so it fails silently rather than crashing the page.

### Wiring

- **Capture**: called once in `src/main.jsx`, before the app renders — `captureUtmParams()` right after the imports, before `createRoot(...).render(...)`. This ensures UTM params are captured regardless of which route the user lands on first (not just the marketing home page — a paid ad could plausibly deep-link anywhere).
- **Pre-fill**: in `src/views/marketing/sections/CtaBand.jsx`, a `useEffect` on mount checks `getUtmLabel()`; if it returns a non-null value and the form's `source` field is still empty (its default `useState` value), pre-fill `form.source` with that label. The field remains a normal editable `<input>` — no read-only lock, no visual "auto-filled" indicator beyond the value simply appearing pre-typed, consistent with how a browser autofill would behave.

## Data flow / state

`sessionStorage` only — no global app state, no backend/API calls, no new database columns. The captured UTM data flows into the existing `waitlist_entries.source` text column purely because it's typed into the same form field a human would otherwise type into manually.

## Error handling

Both `sessionStorage` read and write are wrapped in try/catch with silent fallback (capture no-ops if write fails; pre-fill just doesn't happen if read fails or returns nothing) — matches the same fail-open pattern already established for `CookieBanner` in batch 3.

## Testing

- `utm.test.js`: `captureUtmParams()` stores the present UTM keys from a mocked `window.location.search`, does not write anything when no UTM keys are present, and doesn't throw if `sessionStorage` throws. `getUtmLabel()` returns the joined label when data is present, returns `null` when nothing was captured, returns `null` (not a throw) if `sessionStorage.getItem` throws or returns malformed JSON.
- `CtaBand.jsx`: extend or add test coverage — pre-fills the `source` field from `getUtmLabel()` on mount when the field is empty and a label exists; does NOT override an already-non-empty `source` field; renders normally with no UTM data present (field stays empty, as today).
