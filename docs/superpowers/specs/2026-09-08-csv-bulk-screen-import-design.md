# CSV Bulk Screen Import — Design

Competitive Parity Program, Phase 6 (`docs/superpowers/specs/2026-07-24-competitive-parity-program.md`), G21 (bulk-import half only — the REST campaign API half of G21 is a separate, later spec):

> CSV bulk screen import for operators onboarding 40+ screens.

## Problem

`ScreenOnboard.jsx`'s `StepRegister` is a one-screen-at-a-time form (12 required fields, a map pin drop for lat/lng). An operator bringing an existing network of 40+ screens onto AdGrid today has to repeat that form 40+ times by hand. This is the single biggest friction point for exactly the operators AdGrid most wants — established networks, not first-time single-screen hosts.

## Goals

- An operator with a spreadsheet of their existing screens can get them all into AdGrid in one action, without re-typing anything already in that spreadsheet.
- Row-level validation errors are specific and actionable ("row 14: missing venue category") — a bad row never silently drops or blocks the whole batch.
- Reuses `screens` table semantics exactly as they exist today (same required columns, same RLS, same `pending` approval status) — bulk-imported screens are ordinary screens to every other reader, not a special case.

## Non-goals

- **Not a general data-migration tool.** No column-remapping UI, no support for arbitrary CSV shapes — a fixed, documented column header format only (mirrors how `screensToCsv`'s *export* format is already fixed, not configurable).
- **No CSV re-import/update of existing screens.** v1 is create-only. Editing an already-imported screen goes through the existing per-screen edit flow (`EditScreenModal.jsx`), not a re-upload.
- **No async/background job.** Given the stated 40-screen scale (not 4,000), the whole batch is validated and inserted synchronously in the browser session — no edge function, no job queue, no progress-persisted-across-reloads requirement.
- **No image/photo bulk upload.** `screen_photos` stays empty on an imported screen, same as a screen just past `StepRegister` and not yet at the (separate) photo-upload step today.

## Scope

1. `src/lib/screenCsvImport.js` — pure parse + per-row validation + payload-building functions, framework-free so they're directly unit-testable.
2. A "Bulk Import" entry point + modal on `Screens.jsx`, next to the existing "↓ Export" / "+ Register Screen" actions.
3. Optional geocoding fallback for rows that supply an address but no lat/lng.

## Architecture

### 1. CSV format (fixed columns)

Header row, in this exact order (mirrors `StepRegister`'s required-field list, `src/views/operator/ScreenOnboard.jsx:157-193`):

```
name,owner_name,country,state,city,location,venue_category,venue_subtype,environment,screen_position,display_size,monthly_traffic_estimate,lat,lng
```

- `country` — one of `COUNTRIES` (`src/lib/venueTypes.js`) codes (`CA`, `GB`, `US`, `AU`); defaults to `CA` if blank, matching `StepRegister`'s form default.
- `venue_category` — one of `VENUE_TAXONOMY`'s keys (`src/lib/venueTypes.js`), not its display label (e.g. `retail`, not `Retail`) — avoids a label→key lookup ambiguity if AdGrid ever renames a label.
- `venue_subtype` — required only when that category has subtypes (`VENUE_TAXONOMY[venue_category].subtypes.length > 0`), optional otherwise — same conditional-requirement rule `StepRegister`'s `missingFields` already applies.
- `environment` — `Indoor` or `Outdoor`.
- `screen_position` — one of `SCREEN_POSITION_OPTIONS` (`src/lib/venueTypes.js`).
- `lat`/`lng` — optional. If both are present and parse as finite numbers, used directly. If either is missing/invalid and `location`+`city`+`state` are present, the row is queued for geocoding (see §3). If geocoding isn't possible or fails, the row is a validation error, not a silent skip — coordinates are load-bearing for radius targeting exactly as `StepRegister` already treats them.
- Fields not collected by import (`resolution_w/h`, `accepted_formats`, `max_file_mb`, `screen_photos`, etc.) are left `null`, same as `StepRegister` when those optional fields are blank.

A `screens-import-template.csv` header-only download (reusing `downloadCsv`/`toCsv` from `src/lib/csv.js`) is offered from the import modal so operators don't have to hand-type the header row.

### 2. `src/lib/screenCsvImport.js`

```js
export function parseScreenCsv(text) {
  // Splits into header + data rows (reuse a minimal RFC-4180-ish parser --
  // handles quoted fields containing commas, matching the quoting csv.js's
  // toCsv() already produces on export, so an operator's own AdGrid export
  // round-trips through this parser cleanly). Returns { rows: [{...}], error }
  // where error is set (and rows is []) only for a structurally broken file
  // (no header row, header doesn't match the fixed column list).
}

export function validateImportRow(row, index) {
  // Same shape as StepRegister's missingFields, but returns
  // { row, errors: string[] } for this one row rather than disabling a
  // submit button -- errors are the actionable "row 14: missing venue
  // category" strings the UI lists per-row.
}

export function buildScreenInsertPayload(row, operatorId) {
  // Mirrors StepRegister's insertPayload construction exactly (same
  // defaults: status: 'pending', max_ad_duration: 30, owner_type:
  // 'Business', timezone derived via STATE_TIMEZONE[country][state]).
  // Assumes the row already passed validateImportRow (including having
  // resolved lat/lng, whether from the CSV or geocoding).
}
```

Kept as three separate pure functions (parse / validate / build) rather than one do-everything import function, so each is independently unit-testable and the modal component can show progress between phases ("Parsing…" → "Validating…" → "Importing…").

### 3. Geocoding fallback

For rows missing `lat`/`lng` but with a usable address (`location` + `city` + `state`), the import modal calls the existing `geocodeAddress()` (`src/lib/geocodeAddress.js`, already used by `ScreenLocationPicker.jsx`) with `VITE_MAPBOX_TOKEN`, one row at a time, before validation finalizes that row. A geocode miss (no result, or the API call fails) makes that row a validation error ("row N: couldn't locate this address — add lat/lng manually or fix the address") rather than importing a screen with no coordinates.

### 4. Screens.jsx — "Bulk Import" modal

New file `src/components/screens/BulkImportModal.jsx`, opened from a new "↑ Import CSV" button next to the existing Export/Register Screen actions (`Screens.jsx:188`).

Flow inside the modal:
1. File picker (`<input type="file" accept=".csv">`) + a "Download template" link.
2. On file select: `parseScreenCsv()` → `validateImportRow()` on every row → render a summary table (row #, screen name, status: valid / error list) before anything is written. An all-or-nothing "Import N valid rows" button is disabled while any row is still unresolved (geocoding in flight); rows with validation errors are excluded from the count and listed separately with their specific reasons, never silently dropped without being shown.
3. On confirm: geocode any rows still needing it, then insert valid rows via `supabase.from('screens').insert(payloads)` in one batch call (no new edge function needed — `StepRegister` already inserts directly from the client under existing RLS, and RLS scopes inserts to `operator_id = auth.uid()` the same way for one row or many). For each inserted screen, fetch its token via the existing `get_screen_token` RPC (same as `StepRegister`), same as single-screen onboarding needs it to show the player-setup instructions.
4. Result screen: N screens imported successfully, listed with links into each `ScreenDetail`; any rows that failed the insert itself (rare — a DB-level failure after passing validation) are listed with the raw error, not silently lost.

## Data flow / state

- Parsing/validation/geocoding: local component state in `BulkImportModal`, no global state.
- Import: a single batched `supabase.from('screens').insert([...])` call — same RLS-scoped, client-direct-insert pattern `StepRegister` already uses for one screen. No new edge function, no service-role code path (bulk-imported screens are not "trusted" any differently than any other operator-created screen; they land in `status: 'pending'` exactly like a single-screen registration and go through whatever review the operator's own screens already go through).

## Error handling

- Malformed file (wrong header, empty file, unreadable): `parseScreenCsv()` returns a top-level error, shown before any row-level UI renders.
- Per-row validation errors: never block the rows that *did* validate — the operator can still import the valid subset and re-upload a fixed CSV for the rest.
- Geocoding failures: treated as a validation error on that row (see §3), not a silent `lat: null` import.
- Batch insert failure: if the whole `insert([...])` call fails (e.g. a transient network error), no partial-success ambiguity exists since it's one call — the modal shows a single retryable error and no rows are created. (A partial per-row insert failure isn't possible with a single-statement batch insert; this is a deliberate simplification enabled by the synchronous, non-job-queue architecture — see Non-goals.)

## Testing

- `screenCsvImport.test.js`: `parseScreenCsv()` on a well-formed CSV, a CSV with quoted fields containing commas, a CSV with the wrong header, an empty file. `validateImportRow()` covering each required field's missing/invalid case, the conditional `venue_subtype` requirement, and a row that's valid without `lat`/`lng` (geocoding candidate) vs. invalid (no address at all). `buildScreenInsertPayload()` asserting parity with `StepRegister`'s own payload shape/defaults.
- `BulkImportModal.test.jsx`: renders row-level validation results from a mocked file upload; confirms the import button is disabled until geocoding resolves; confirms a batch insert call is scoped to only the valid rows; confirms per-row errors stay visible and don't block importing the valid subset.

Follows this repo's existing per-file `*.test.jsx`/`*.test.ts` convention alongside the files each test covers.

## Open questions for follow-up (not blocking this spec)

- Whether to eventually support CSV *update* of existing screens (matched by name+operator, or a stable external ID column) — deferred; v1 is create-only per Non-goals.
- The REST campaign API half of G21 is intentionally out of scope here and needs its own design spec (auth model for scoped API keys, rate limiting, which endpoints) before implementation.
