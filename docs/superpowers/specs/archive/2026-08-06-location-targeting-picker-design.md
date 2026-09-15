# Location Targeting Picker — Design Spec
**Date:** 2026-08-06
**Priority:** P1 — advertiser campaign creation UX

---

## Problem

`StepTargeting.jsx`'s Area targeting step uses raw text inputs for State and City, and a free-text "Center location" field for Radius mode that geocodes via Mapbox on blur. No autocomplete, no validation against real inventory, typos silently produce zero-match campaigns, and Radius mode has no visual map until after a valid address is typed and geocoded. AdGrid's screen inventory is finite and already loaded client-side (`allScreens`) — the picker should surface that real inventory instead of accepting arbitrary text or calling an external geocoding API for a decision that's really "pick from what we have."

---

## Solution

Replace free-text State/City/Radius-center inputs with a location picker built entirely from `allScreens` (no new network calls):

- **Country / State** — become `<select>` dropdowns populated from distinct values actually present in inventory (was: static `COUNTRIES` const + free text).
- **City** — becomes a typeahead search (`LocationSearch`) over distinct city names in inventory. Selecting fills country/state/city. No map (whole-city match is cheap, unaffected).
- **Radius** — same `LocationSearch` to pick the anchor city, then a map (`LocationMapPicker`) appears with a **draggable pin** + radius circle + km chips, so an advertiser can narrow to a specific part of the city or a custom radius, not just the city centroid.

This removes the `VITE_MAPBOX_TOKEN` dependency and `CITY_CENTERS` hardcoded table from `StepTargeting.jsx` entirely — every suggestion is guaranteed to match ≥1 real screen.

**Out of scope:** `ScreenLocationPicker.jsx` (operator screen registration) is untouched — that flow geocodes a real-world address for a *new* screen and correctly still needs Mapbox, since the address isn't in inventory yet.

---

## 1. Data: location index

New `useMemo` inside `StepTargeting.jsx` (or extracted to `src/lib/locationIndex.js` if reused elsewhere later — YAGNI for now, keep local):

```js
function buildLocationIndex(allScreens) {
  const byKey = new Map(); // key = `${country}|${state}|${city}`
  for (const s of allScreens) {
    if (!s.city) continue;
    const key = `${s.country ?? ''}|${s.state ?? ''}|${s.city}`;
    const entry = byKey.get(key) ?? {
      country: s.country ?? '', state: s.state ?? '', city: s.city,
      count: 0, coordSum: [0, 0], coordCount: 0,
    };
    entry.count += 1;
    if (s.lat != null && s.lon != null) {
      entry.coordSum = [entry.coordSum[0] + Number(s.lat), entry.coordSum[1] + Number(s.lon)];
      entry.coordCount += 1;
    }
    byKey.set(key, entry);
  }
  return [...byKey.values()].map(e => ({
    country: e.country, state: e.state, city: e.city, count: e.count,
    hasCoords: e.coordCount > 0,
    centroidLat: e.coordCount > 0 ? e.coordSum[0] / e.coordCount : null,
    centroidLon: e.coordCount > 0 ? e.coordSum[1] / e.coordCount : null,
  }));
}
```

Country and State dropdown options are derived from the same index (`distinct country`, `distinct state` scoped to selected country) rather than a static list.

Matching semantics for country/state/city filtering during campaign submission are unchanged (`screens.country = form.country`, etc., per the existing targeting-funnel spec) — this feature only changes how the advertiser *picks* the values, not how matching runs.

---

## 2. `LocationSearch.jsx` (new component)

**Location:** `src/views/advertiser/createCampaign/LocationSearch.jsx`

**Props:** `{ locations, value, onSelect, placeholder, scopeCountry, scopeState }`

- Text input + dropdown listbox of matches, filtered case-insensitive on `city` (substring match), sorted startsWith-first then by `count` desc.
- If `scopeCountry`/`scopeState` provided, filters to that scope first (used when City/Radius search happens after Country/State are already narrowed — though typically advertiser searches city directly and country/state backfill from the match).
- Each result row: `{city} — {state}, {country} · {count} screen{s}`.
- Keyboard: ArrowUp/Down to move highlight, Enter to select, Escape to close.
- Selecting calls `onSelect(locationEntry)` — caller decides what to fill.
- Empty index / still loading (`locations.length === 0` and `allScreens` not yet fetched) → input disabled, placeholder "Loading locations…".
- No matches for typed query → "No screens in that area yet" row, non-selectable.

---

## 3. `LocationMapPicker.jsx` (new component)

**Location:** `src/views/advertiser/createCampaign/LocationMapPicker.jsx`

No new component: extend `ScreenMap.jsx` in place with two optional props, `draggableCenter` (bool) and `onCenterChange({ lat, lon })`, rather than forking a second map component — one map component, not two.

Shown only in Radius mode, only after a city is selected **and** that city `hasCoords`.

- When `draggableCenter` is true, the center marker (drawn at `center` prop, same as today) becomes `L.marker(center, { draggable: true })` instead of the current circle-only rendering. On `dragend`, calls `onCenterChange({ lat, lon })`; `StepTargeting.jsx` writes that into `radius_center_lat`/`radius_center_lon`.
- Everything else — radius circle, in-range screen markers, click-to-toggle-selection — is unchanged from today's `ScreenMap.jsx` behavior.
- Km radius chips (5/10/25/50/100) render above the map, unchanged from current behavior.
- `StepTargeting.jsx` passes `draggableCenter` only when in Radius mode with a resolved city; `center` is seeded from the selected city's centroid on first select, then follows drags after that.

---

## 4. `StepTargeting.jsx` changes

- `locationIndex = useMemo(() => buildLocationIndex(allScreens), [allScreens])`
- **Country pill fields:** `<SelInput>` options = distinct `country` values from `locationIndex` (label via existing `COUNTRIES` map for display name if present, else raw code).
- **State pill fields:** `<SelInput>` options = distinct `state` values from `locationIndex` scoped to `form.country`.
- **City pill:** `<LocationSearch>` scoped to `form.country`/`form.state` if set. `onSelect` fills `country`, `state`, `city`.
- **Radius pill:** `<LocationSearch>` (unscoped — advertiser may not have picked country/state first) for the anchor city. `onSelect` fills `country`/`state`/`city` **and** seeds `radius_center_lat`/`radius_center_lon` from the entry's centroid, then reveals `<ScreenMap draggableCenter onCenterChange={...}>` + the existing km chip `PillGroup`, exactly where the map already renders today.
- Delete: `CITY_CENTERS`, `geocodeCenter()`, the `geocoding` state, the `Inp` for "Center location" (replaced by `LocationSearch`), and the `radius_center` form field's free-text role (kept only as a display label if useful — e.g. `"${city}, ${state}"` computed from selection, not user-typed).
- `radiusCenter` fallback (no city picked yet) can stay `CITY_CENTERS['Toronto']`-equivalent by picking `locationIndex[0]` with coords, or simply not render the map until a city is chosen (cleaner — matches "map appears after search box picks a City" from the approved mockup). **Going with: no map until a city with coords is selected.**

---

## 5. Edge cases

| Case | Behavior |
|---|---|
| `allScreens` empty/still loading | All pickers show disabled/loading state |
| City has zero screens with lat/lon | Selectable in City mode; excluded from Radius-mode's city search results (or selectable but shows "Radius narrowing unavailable for this city — showing whole-city match instead" and forces `area_type` back to `city` semantics for matching) |
| Pin dragged to a spot with 0 screens in radius | Existing `reachSummary` / map's own "0 screens" state already surfaces this — unchanged |
| Two screens same city, different casing (`"Toronto"` vs `"toronto"`) | Index groups by exact string match on `city` (existing data convention — screens are operator-entered once at onboarding via `ScreenLocationPicker`/`ScreenOnboard`, not user-typed per campaign). Out of scope to add fuzzy/case-insensitive grouping now; note as a follow-up if it proves to be a real data issue. |

---

## 6. Testing

- New unit test file for `buildLocationIndex` — grouping, centroid averaging, `hasCoords` false when no screen in a city has coords, dedup.
- Extend `StepTargeting.smoke.test.jsx`: typing in the City `LocationSearch` surfaces a matching seeded screen's city, selecting it fills `form.city`/`state`/`country` via the `setForm` spy.
- `ScreenMap.jsx`'s existing jsdom limitation (Leaflet "Map container not found") persists — drag-pin interaction is not unit-testable here; flag as manual QA step in the implementation plan.
- No changes needed to `geo.js` (`haversineKm`) — untouched.

---

## 7. Out of scope

- Multi-location stacking (Meta's Include/Exclude, multiple simultaneous areas) — AdGrid's model is one area per targeting group; this spec only improves how that one area is picked.
- Changing the underlying screen-matching SQL/filter logic — unchanged from the existing targeting-funnel design.
- `ScreenLocationPicker.jsx` / Mapbox-based address geocoding for operator screen registration — untouched, different problem.
- Server-side/DB-backed location autocomplete (e.g. a Postgres `DISTINCT city` RPC) — `allScreens` is already fetched client-side for the map; deriving locally avoids a second round trip. Revisit only if screen count grows large enough that shipping the full list client-side becomes the bottleneck.
