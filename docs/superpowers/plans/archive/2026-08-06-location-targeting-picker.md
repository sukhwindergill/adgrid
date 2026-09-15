# Location Targeting Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace free-text Country/State/City inputs and the Mapbox-geocoded radius center field in the advertiser campaign wizard's targeting step with autocomplete drawn entirely from real screen inventory, plus a draggable-pin map for narrowing a radius to a specific part of a city.

**Architecture:** A pure client-side `locationIndex.js` derives distinct (country, state, city) suggestions — with screen counts and coordinate centroids — from the `allScreens` array `StepTargeting` already receives. A new `LocationSearch.jsx` combobox renders those suggestions. `ScreenMap.jsx` gains an optional draggable center marker. `StepTargeting.jsx` is rewired to use both, dropping `CITY_CENTERS` and the Mapbox `geocodeCenter()` fetch entirely.

**Tech Stack:** React (function components + hooks), Vitest + React Testing Library, existing Leaflet integration (unchanged library, extended usage).

**Spec:** [docs/superpowers/specs/2026-08-06-location-targeting-picker-design.md](../specs/2026-08-06-location-targeting-picker-design.md)

---

## File Structure

- Create: `src/lib/locationIndex.js` — pure functions: `buildLocationIndex`, `distinctCountries`, `distinctStates`
- Create: `src/lib/locationIndex.test.js`
- Create: `src/views/advertiser/createCampaign/LocationSearch.jsx` — typeahead combobox component
- Create: `src/views/advertiser/createCampaign/LocationSearch.test.jsx`
- Modify: `src/views/advertiser/createCampaign/ScreenMap.jsx` — add `draggableCenter`/`onCenterChange` props
- Modify: `src/views/advertiser/createCampaign/StepTargeting.jsx` — full rewrite of the Country/State/City/Radius section
- Modify: `src/views/advertiser/CreateCampaign.jsx:88` — drop the now-unused `radius_center` form field
- Modify: `src/views/advertiser/createCampaign/StepTargeting.smoke.test.jsx` — drop `radius_center` from `baseForm`, add a location-search interaction test

No changes to `src/lib/geo.js` (haversine, untouched), `src/lib/geocodeAddress.js` / `src/components/ScreenLocationPicker.jsx` (operator screen registration — different problem, keeps Mapbox), or the screen-matching logic in `CreateCampaign.jsx:110-134` (unchanged — it already reads `form.country`/`state`/`city`/`radius_center_lat`/`radius_center_lon`/`radius_km`, which this plan continues to populate the same way).

---

### Task 1: `locationIndex.js` — pure location index

**Files:**
- Create: `src/lib/locationIndex.js`
- Test: `src/lib/locationIndex.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/lib/locationIndex.test.js
import { describe, it, expect } from 'vitest';
import { buildLocationIndex, distinctCountries, distinctStates } from './locationIndex.js';

const SCREENS = [
  { id: '1', country: 'CA', state: 'Ontario', city: 'Toronto', lat: 43.65, lon: -79.38 },
  { id: '2', country: 'CA', state: 'Ontario', city: 'Toronto', lat: 43.66, lon: -79.40 },
  { id: '3', country: 'CA', state: 'Ontario', city: 'Hamilton', lat: null, lon: null },
  { id: '4', country: 'CA', state: 'British Columbia', city: 'Vancouver', lat: 49.28, lon: -123.12 },
  { id: '5', country: 'US', state: 'New York', city: 'New York', lat: 40.71, lon: -74.00 },
  { id: '6', country: 'CA', state: 'Ontario', city: '', lat: 43.0, lon: -79.0 }, // no city — excluded
];

describe('buildLocationIndex', () => {
  it('groups screens by country+state+city and counts them', () => {
    const index = buildLocationIndex(SCREENS);
    const toronto = index.find(e => e.city === 'Toronto');
    expect(toronto.count).toBe(2);
    expect(toronto.country).toBe('CA');
    expect(toronto.state).toBe('Ontario');
  });

  it('excludes screens with no city', () => {
    const index = buildLocationIndex(SCREENS);
    expect(index.some(e => e.city === '')).toBe(false);
    expect(index).toHaveLength(4); // Toronto, Hamilton, Vancouver, New York
  });

  it('averages lat/lon into a centroid across the group', () => {
    const index = buildLocationIndex(SCREENS);
    const toronto = index.find(e => e.city === 'Toronto');
    expect(toronto.hasCoords).toBe(true);
    expect(toronto.centroidLat).toBeCloseTo((43.65 + 43.66) / 2, 5);
    expect(toronto.centroidLon).toBeCloseTo((-79.38 + -79.40) / 2, 5);
  });

  it('reports hasCoords false and null centroid when no screen in the group has coordinates', () => {
    const index = buildLocationIndex(SCREENS);
    const hamilton = index.find(e => e.city === 'Hamilton');
    expect(hamilton.hasCoords).toBe(false);
    expect(hamilton.centroidLat).toBeNull();
    expect(hamilton.centroidLon).toBeNull();
  });

  it('returns an empty index for no screens', () => {
    expect(buildLocationIndex([])).toEqual([]);
  });
});

describe('distinctCountries', () => {
  it('returns each country once, sorted', () => {
    const index = buildLocationIndex(SCREENS);
    expect(distinctCountries(index)).toEqual(['CA', 'US']);
  });
});

describe('distinctStates', () => {
  it('returns states for all countries when no scope given', () => {
    const index = buildLocationIndex(SCREENS);
    expect(distinctStates(index)).toEqual(['British Columbia', 'New York', 'Ontario']);
  });

  it('scopes to a single country when given', () => {
    const index = buildLocationIndex(SCREENS);
    expect(distinctStates(index, 'CA')).toEqual(['British Columbia', 'Ontario']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/locationIndex.test.js`
Expected: FAIL — `Cannot find module './locationIndex.js'`

- [ ] **Step 3: Write the implementation**

```js
// src/lib/locationIndex.js
//
// Builds a client-side location suggestion index from already-fetched screen
// rows. Every suggestion is guaranteed to match at least one real screen —
// there is no separate geocoding call or network round-trip. StepTargeting
// already fetches `allScreens` for the radius map, so this is a pure
// derivation, not a new data source.

export function buildLocationIndex(screens) {
  const byKey = new Map();
  for (const s of screens) {
    if (!s.city) continue;
    const country = s.country ?? '';
    const state = s.state ?? '';
    const key = `${country}|${state}|${s.city}`;
    let entry = byKey.get(key);
    if (!entry) {
      entry = { country, state, city: s.city, count: 0, coordSumLat: 0, coordSumLon: 0, coordCount: 0 };
      byKey.set(key, entry);
    }
    entry.count += 1;
    const lat = Number(s.lat), lon = Number(s.lon);
    if (s.lat != null && s.lon != null && Number.isFinite(lat) && Number.isFinite(lon)) {
      entry.coordSumLat += lat;
      entry.coordSumLon += lon;
      entry.coordCount += 1;
    }
  }
  return [...byKey.values()].map(e => ({
    country: e.country,
    state: e.state,
    city: e.city,
    count: e.count,
    hasCoords: e.coordCount > 0,
    centroidLat: e.coordCount > 0 ? e.coordSumLat / e.coordCount : null,
    centroidLon: e.coordCount > 0 ? e.coordSumLon / e.coordCount : null,
  }));
}

export function distinctCountries(index) {
  const seen = new Set();
  const out = [];
  for (const e of index) {
    if (e.country && !seen.has(e.country)) { seen.add(e.country); out.push(e.country); }
  }
  return out.sort();
}

export function distinctStates(index, country) {
  const seen = new Set();
  const out = [];
  for (const e of index) {
    if (!e.state || (country && e.country !== country) || seen.has(e.state)) continue;
    seen.add(e.state);
    out.push(e.state);
  }
  return out.sort();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/locationIndex.test.js`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/locationIndex.js src/lib/locationIndex.test.js
git commit -m "feat: add client-side location index for targeting picker

Derives distinct country/state/city suggestions and coordinate
centroids from allScreens — no new geocoding call.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `LocationSearch.jsx` — typeahead combobox

**Files:**
- Create: `src/views/advertiser/createCampaign/LocationSearch.jsx`
- Test: `src/views/advertiser/createCampaign/LocationSearch.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// src/views/advertiser/createCampaign/LocationSearch.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocationSearch } from './LocationSearch.jsx';

const LOCATIONS = [
  { country: 'CA', state: 'Ontario', city: 'Toronto', count: 12, hasCoords: true, centroidLat: 43.65, centroidLon: -79.38 },
  { country: 'CA', state: 'Ontario', city: 'Hamilton', count: 2, hasCoords: false, centroidLat: null, centroidLon: null },
  { country: 'CA', state: 'British Columbia', city: 'Vancouver', count: 5, hasCoords: true, centroidLat: 49.28, centroidLon: -123.12 },
];

describe('LocationSearch', () => {
  it('shows matching suggestions as the user types', () => {
    render(<LocationSearch locations={LOCATIONS} value="" onSelect={() => {}} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'tor' } });
    expect(screen.getByText('Toronto')).toBeInTheDocument();
    expect(screen.queryByText('Vancouver')).not.toBeInTheDocument();
  });

  it('calls onSelect with the full location entry when a suggestion is clicked', () => {
    const onSelect = vi.fn();
    render(<LocationSearch locations={LOCATIONS} value="" onSelect={onSelect} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'tor' } });
    fireEvent.click(screen.getByText('Toronto'));
    expect(onSelect).toHaveBeenCalledWith(LOCATIONS[0]);
  });

  it('scopes suggestions to scopeCountry and scopeState when provided', () => {
    render(<LocationSearch locations={LOCATIONS} value="" onSelect={() => {}} scopeCountry="CA" scopeState="British Columbia" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'o' } }); // matches Toronto, Hamilton and Vancouver by substring
    expect(screen.getByText('Vancouver')).toBeInTheDocument();
    expect(screen.queryByText('Toronto')).not.toBeInTheDocument();
  });

  it('shows a no-matches row when the query matches nothing', () => {
    render(<LocationSearch locations={LOCATIONS} value="" onSelect={() => {}} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'zzz' } });
    expect(screen.getByText('No screens in that area yet')).toBeInTheDocument();
  });

  it('disables the input and shows a loading placeholder when loading', () => {
    render(<LocationSearch locations={[]} value="" onSelect={() => {}} loading />);
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByPlaceholderText('Loading locations…')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/views/advertiser/createCampaign/LocationSearch.test.jsx`
Expected: FAIL — `Cannot find module './LocationSearch.jsx'`

- [ ] **Step 3: Write the implementation**

```jsx
// src/views/advertiser/createCampaign/LocationSearch.jsx
import { useState, useRef, useEffect } from 'react';
import { C, F } from '../../../design/tokens.js';

// Typeahead combobox over the client-side location index (see
// src/lib/locationIndex.js). Every suggestion matches at least one real
// screen — there is no network call here, filtering is instant.
export function LocationSearch({ locations, value, onSelect, placeholder = 'Search a city…', scopeCountry, scopeState, loading = false }) {
  const [query, setQuery] = useState(value ?? '');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef(null);

  useEffect(() => { setQuery(value ?? ''); }, [value]);

  useEffect(() => {
    function onDocMouseDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  const scoped = locations.filter(l =>
    (!scopeCountry || l.country === scopeCountry) &&
    (!scopeState || l.state === scopeState)
  );

  const q = query.trim().toLowerCase();
  const matches = q
    ? scoped
        .filter(l => l.city.toLowerCase().includes(q))
        .sort((a, b) => {
          const aStarts = a.city.toLowerCase().startsWith(q) ? 0 : 1;
          const bStarts = b.city.toLowerCase().startsWith(q) ? 0 : 1;
          return aStarts !== bStarts ? aStarts - bStarts : b.count - a.count;
        })
        .slice(0, 8)
    : [];

  const selectEntry = (entry) => {
    setQuery(entry.city);
    setOpen(false);
    onSelect(entry);
  };

  const onKeyDown = (e) => {
    if (!open || matches.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); selectEntry(matches[highlight]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={query}
        disabled={loading}
        placeholder={loading ? 'Loading locations…' : placeholder}
        onChange={e => { setQuery(e.target.value); setOpen(true); setHighlight(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        style={{
          padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 8,
          fontSize: 13, fontFamily: F.sans, color: C.text, background: C.surface,
          outline: 'none', width: '100%', boxSizing: 'border-box',
        }}
      />
      {open && q && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)', zIndex: 10, maxHeight: 220, overflowY: 'auto',
        }}>
          {matches.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 12, color: C.textMuted, fontFamily: F.sans }}>
              No screens in that area yet
            </div>
          ) : matches.map((m, i) => (
            <div
              key={`${m.country}|${m.state}|${m.city}`}
              onClick={() => selectEntry(m)}
              onMouseEnter={() => setHighlight(i)}
              style={{
                padding: '8px 12px', fontSize: 13, fontFamily: F.sans, cursor: 'pointer',
                background: i === highlight ? C.surfaceAlt : C.surface, color: C.text,
              }}
            >
              {m.city} <span style={{ color: C.textMuted, fontSize: 12 }}>— {m.state ? `${m.state}, ` : ''}{m.country} · {m.count} screen{m.count !== 1 ? 's' : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/views/advertiser/createCampaign/LocationSearch.test.jsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/views/advertiser/createCampaign/LocationSearch.jsx src/views/advertiser/createCampaign/LocationSearch.test.jsx
git commit -m "feat: add LocationSearch typeahead combobox

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `ScreenMap.jsx` — draggable center marker

**Files:**
- Modify: `src/views/advertiser/createCampaign/ScreenMap.jsx`

No automated test for this step: `ScreenMap.jsx` already has no unit test coverage because Leaflet throws "Map container not found" under jsdom (documented in `StepTargeting.smoke.test.jsx:51-56`). This task is verified manually in Task 7's QA checklist instead.

- [ ] **Step 1: Add the `draggableCenter`/`onCenterChange` props and a center-marker ref**

Modify `src/views/advertiser/createCampaign/ScreenMap.jsx:6`:

```jsx
export function ScreenMap({ center, radius, screens, selected, onToggle, draggableCenter = false, onCenterChange }) {
  const mapRef    = useRef(null);
  const leafletRef = useRef(null);
  const markersRef = useRef([]);
  const circleRef  = useRef(null);
  const centerMarkerRef = useRef(null);
```

- [ ] **Step 2: Render/update the draggable center marker inside the existing `init().then(...)` block**

Modify `src/views/advertiser/createCampaign/ScreenMap.jsx:32-37` (right after the circle is (re)drawn):

```jsx
    init().then(() => {
      if (!leafletRef.current) return;
      const { L: Lf, map: m } = leafletRef.current;
      if (circleRef.current) circleRef.current.remove();
      circleRef.current = Lf.circle(center, { radius: radius * 1000, color: '#7c3aed', fillColor: '#7c3aed', fillOpacity: 0.06, weight: 2, dashArray: '6 4' }).addTo(m);
      m.setView(center, 12);

      if (centerMarkerRef.current) centerMarkerRef.current.remove();
      if (draggableCenter) {
        centerMarkerRef.current = Lf.marker(center, { draggable: true }).addTo(m);
        centerMarkerRef.current.on('dragend', () => {
          const { lat, lng } = centerMarkerRef.current.getLatLng();
          onCenterChange?.({ lat, lon: lng });
        });
      }
```

(The rest of the block — `markersRef.current.forEach(...)` through the closing of `init().then(...)` — is unchanged.)

- [ ] **Step 3: Add `draggableCenter` to the effect's dependency array**

Modify `src/views/advertiser/createCampaign/ScreenMap.jsx:56` (the `}, [center, radius, screens, selected]);` line):

```jsx
  }, [center, radius, screens, selected, draggableCenter]);
```

- [ ] **Step 4: Run the existing test suite to confirm nothing else broke**

Run: `npx vitest run src/views/advertiser/createCampaign`
Expected: PASS — `StepTargeting.smoke.test.jsx` still passes (it never mounts radius mode, per its own comment); no `ScreenMap`-specific test exists to break.

- [ ] **Step 5: Commit**

```bash
git add src/views/advertiser/createCampaign/ScreenMap.jsx
git commit -m "feat: add optional draggable center marker to ScreenMap

Lets radius targeting narrow to a specific part of a city instead of
only the picked city's centroid. Off by default — existing callers
unaffected.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Rewire `StepTargeting.jsx`

**Files:**
- Modify: `src/views/advertiser/createCampaign/StepTargeting.jsx` (full rewrite)

- [ ] **Step 1: Replace the file contents**

```jsx
// src/views/advertiser/createCampaign/StepTargeting.jsx
import { useMemo } from 'react';
import { C, F } from '../../../design/tokens.js';
import { Card } from '../../../components/primitives/Card.jsx';
import { Inp } from '../../../components/primitives/Inp.jsx';
import { SelInput } from '../../../components/primitives/SelInput.jsx';
import { VENUE_TAXONOMY, COUNTRIES } from '../../../lib/venueTypes.js';
import { buildLocationIndex, distinctCountries, distinctStates } from '../../../lib/locationIndex.js';
import { PillGroup } from './PillGroup.jsx';
import { LocationSearch } from './LocationSearch.jsx';
import { ScreenMap } from './ScreenMap.jsx';

const countryLabel = code => COUNTRIES.find(c => c.code === code)?.label ?? code;

export function StepTargeting({ form, setForm, reachSummary, allScreens, onPrevCampaigns, existingCampaign = null }) {
  const setField = (k, v) => setForm(s => ({ ...s, [k]: v }));

  const loading = allScreens.length === 0;
  const locationIndex = useMemo(() => buildLocationIndex(allScreens), [allScreens]);
  const countryOptions = useMemo(() => distinctCountries(locationIndex), [locationIndex]);
  const stateOptions = useMemo(() => distinctStates(locationIndex, form.country), [locationIndex, form.country]);
  // Radius mode can only center on a city with at least one geocoded screen —
  // a city index entry with no coordinates has nothing to average into a
  // centroid, so it's excluded here rather than offered and then failing silently.
  const radiusLocations = useMemo(() => locationIndex.filter(e => e.hasCoords), [locationIndex]);

  const radiusScreens = allScreens.filter(s => s.lat != null && s.lon != null);
  const radiusResolved = form.area_type === 'radius' && form.radius_center_lat != null && form.radius_center_lon != null;

  return (
    <div style={{ maxWidth: 620, margin: '0 auto' }}>
      <Card style={{ padding: 32 }}>
        {existingCampaign ? (
          <div style={{ marginBottom: 24, padding: '10px 14px', background: C.purpleSoft, borderRadius: 8, fontSize: 13, color: C.purple, fontFamily: F.sans }}>
            Adding a new targeting group to <strong>{existingCampaign.name}</strong>
          </div>
        ) : (
          <div style={{ marginBottom: 24 }}>
            <Inp
              label="Campaign name"
              placeholder="e.g. Summer Promo 2026"
              value={form.name}
              onChange={e => setField('name', e.target.value)}
            />
          </div>
        )}

        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: '0 0 4px' }}>Where do you want to advertise?</h2>
        <p style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, margin: '0 0 20px' }}>Choose an area and, optionally, the kind of screens you're after — we'll find matching screens for you.</p>

        {onPrevCampaigns && (
          <div style={{ marginBottom: 20 }}>
            <button onClick={onPrevCampaigns} style={{ background: 'none', border: 'none', fontSize: 12, color: C.purple, cursor: 'pointer', fontFamily: F.sans, padding: 0 }}>
              ↩ Start from a previous campaign →
            </button>
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 8 }}>Area type</div>
          <PillGroup
            options={[
              { value: 'country', label: 'Country' },
              { value: 'state',   label: 'State / Province' },
              { value: 'city',    label: 'City' },
              { value: 'radius',  label: 'Radius' },
            ]}
            value={form.area_type}
            onChange={v => setField('area_type', v)}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SelInput label="Country" value={form.country} disabled={loading} onChange={e => setField('country', e.target.value)}>
            {countryOptions.length > 0
              ? countryOptions.map(code => <option key={code} value={code}>{countryLabel(code)}</option>)
              : <option value={form.country}>{loading ? 'Loading…' : countryLabel(form.country)}</option>}
          </SelInput>

          {(form.area_type === 'state' || form.area_type === 'city' || form.area_type === 'radius') && (
            <SelInput label="State / Province" value={form.state} disabled={loading} onChange={e => setField('state', e.target.value)}>
              <option value="">Select…</option>
              {stateOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </SelInput>
          )}

          {form.area_type === 'city' && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 5 }}>City</div>
              <LocationSearch
                locations={locationIndex}
                scopeCountry={form.country}
                scopeState={form.state || undefined}
                value={form.city}
                loading={loading}
                placeholder="Search a city…"
                onSelect={entry => setForm(s => ({ ...s, country: entry.country, state: entry.state, city: entry.city }))}
              />
            </div>
          )}

          {form.area_type === 'radius' && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 5 }}>City</div>
              <LocationSearch
                locations={radiusLocations}
                value={form.city}
                loading={loading}
                placeholder="Search a city to center the radius on…"
                onSelect={entry => setForm(s => ({
                  ...s,
                  country: entry.country,
                  state: entry.state,
                  city: entry.city,
                  radius_center_lat: entry.centroidLat,
                  radius_center_lon: entry.centroidLon,
                }))}
              />
              {radiusResolved && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 8 }}>
                    Radius: {form.radius_km} km — drag the pin to narrow to a specific part of {form.city}
                  </div>
                  <PillGroup
                    options={[5, 10, 25, 50, 100].map(v => ({ value: v, label: `${v}km` }))}
                    value={form.radius_km}
                    onChange={v => setField('radius_km', v)}
                  />
                  <div style={{ marginTop: 16 }}>
                    <ScreenMap
                      center={[form.radius_center_lat, form.radius_center_lon]}
                      radius={form.radius_km}
                      screens={radiusScreens}
                      selected={form.selected_screen_ids}
                      onToggle={id => setForm(s => ({
                        ...s,
                        selected_screen_ids: s.selected_screen_ids.includes(id)
                          ? s.selected_screen_ids.filter(x => x !== id)
                          : [...s.selected_screen_ids, id],
                      }))}
                      draggableCenter
                      onCenterChange={({ lat, lon }) => setForm(s => ({ ...s, radius_center_lat: lat, radius_center_lon: lon }))}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.textMid, fontFamily: F.sans, marginBottom: 12 }}>
            Screen type <span style={{ color: C.textMuted, fontWeight: 400 }}>(optional)</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, fontFamily: F.sans, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Environment</div>
              <PillGroup
                options={[{ value: 'any', label: 'Any' }, { value: 'indoor', label: 'Indoor' }, { value: 'outdoor', label: 'Outdoor' }]}
                value={form.env_filter}
                onChange={v => setForm(s => ({ ...s, env_filter: v }))}
              />
            </div>
            <SelInput label="Venue Category" value={form.venue_filter} onChange={e => setForm(s => ({ ...s, venue_filter: e.target.value }))}>
              <option value="">Any venue type</option>
              {Object.entries(VENUE_TAXONOMY).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </SelInput>
          </div>
        </div>

        {reachSummary && (
          <div style={{ marginTop: 16, padding: '10px 14px', background: C.purpleSoft, borderRadius: 8, fontSize: 13, color: C.purple, fontFamily: F.sans }}>
            {reachSummary}
          </div>
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Run the existing smoke test to confirm it still passes (before Task 6's updates)**

Run: `npx vitest run src/views/advertiser/createCampaign/StepTargeting.smoke.test.jsx`
Expected: FAIL on the `radius_center` field only if `Inp`/`SelInput` complain about an unrecognized `disabled` prop passthrough — it won't (both spread `...p`). The actual expected failure is none; if `baseForm` still includes `radius_center: ''`, it's simply an unused extra key and harmless. Confirm PASS here; Task 6 removes the now-dead field for cleanliness, not because it breaks anything.

- [ ] **Step 3: Commit**

```bash
git add src/views/advertiser/createCampaign/StepTargeting.jsx
git commit -m "feat: wire LocationSearch and draggable radius map into StepTargeting

Country/State are now selects populated from real inventory. City and
Radius use the new LocationSearch combobox instead of free text.
Radius mode reveals a draggable-pin map only after a city with
coordinates is picked, replacing the Mapbox geocode-on-blur flow and
CITY_CENTERS fallback table.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Drop the unused `radius_center` field

**Files:**
- Modify: `src/views/advertiser/CreateCampaign.jsx:88`

`radius_center` was only ever a free-text label for the old Mapbox search box (`StepTargeting.jsx` no longer reads or writes it — Task 4 replaced it with `form.city`/`form.state` for display, and `radius_center_lat`/`radius_center_lon`/`radius_km` continue to drive matching, unchanged). No other file reads it.

- [ ] **Step 1: Remove the field from the initial form state**

Modify `src/views/advertiser/CreateCampaign.jsx:88` — delete this line:

```jsx
    radius_center: '',
```

so the surrounding block reads:

```jsx
    area_type: 'city',
    country: 'CA',
    state: '',
    city: '',
    radius_center_lat: null,
    radius_center_lon: null,
    radius_km: 10,
```

- [ ] **Step 2: Run the full advertiser test suite**

Run: `npx vitest run src/views/advertiser`
Expected: PASS — no test reads `form.radius_center` (confirmed by grep before writing this plan; only `StepTargeting.smoke.test.jsx`'s `baseForm` sets it, and Task 6 removes that too).

- [ ] **Step 3: Commit**

```bash
git add src/views/advertiser/CreateCampaign.jsx
git commit -m "chore: drop unused radius_center form field

Dead since StepTargeting stopped using free-text radius center search;
city/state now shown for display, lat/lon/radius_km unchanged.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Update `StepTargeting.smoke.test.jsx`

**Files:**
- Modify: `src/views/advertiser/createCampaign/StepTargeting.smoke.test.jsx`

- [ ] **Step 1: Remove `radius_center` from `baseForm` and add a location-search interaction test**

Replace the full file:

```jsx
// src/views/advertiser/createCampaign/StepTargeting.smoke.test.jsx
// Throwaway smoke test — confirms StepTargeting.jsx is syntactically valid and
// resolvable (imports exist, renders without throwing) before it is wired
// into CreateCampaign.jsx's render switch in a later task.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StepTargeting } from './StepTargeting.jsx';

const baseForm = {
  name: '',
  area_type: 'city',
  country: 'CA',
  state: '',
  city: '',
  radius_center_lat: null,
  radius_center_lon: null,
  radius_km: 10,
  env_filter: 'any',
  venue_filter: '',
  selected_screen_ids: [],
};

const SCREENS = [
  { id: 's1', country: 'CA', state: 'Ontario', city: 'Toronto', lat: 43.65, lon: -79.38 },
];

describe('StepTargeting', () => {
  it('renders without throwing for the default (city) area type', () => {
    render(
      <StepTargeting
        form={baseForm}
        setForm={() => {}}
        reachSummary="~3 screens · ~12K impressions/mo estimated"
        allScreens={[]}
        onPrevCampaigns={null}
      />
    );
    expect(screen.getByText('Where do you want to advertise?')).toBeInTheDocument();
    expect(screen.getByText('Screen type')).toBeInTheDocument();
  });

  it('renders the "start from a previous campaign" link when provided', () => {
    render(
      <StepTargeting
        form={baseForm}
        setForm={() => {}}
        reachSummary={null}
        allScreens={[]}
        onPrevCampaigns={() => {}}
      />
    );
    expect(screen.getByText('↩ Start from a previous campaign →')).toBeInTheDocument();
  });

  it('fills country/state/city when a city search result is selected', () => {
    const setForm = vi.fn();
    render(
      <StepTargeting
        form={baseForm}
        setForm={setForm}
        reachSummary={null}
        allScreens={SCREENS}
        onPrevCampaigns={null}
      />
    );
    const [, cityInput] = screen.getAllByRole('textbox'); // [campaign name, city search]
    fireEvent.change(cityInput, { target: { value: 'tor' } });
    fireEvent.click(screen.getByText('Toronto'));
    expect(setForm).toHaveBeenCalled();
    const updater = setForm.mock.calls[0][0];
    expect(updater(baseForm)).toMatchObject({ country: 'CA', state: 'Ontario', city: 'Toronto' });
  });

  // Note: area_type === 'radius' is intentionally not exercised here — it
  // mounts ScreenMap.jsx (extracted in a prior commit), which initializes a
  // real Leaflet map and throws an unhandled "Map container not found"
  // rejection under jsdom. That is a pre-existing quirk of ScreenMap in this
  // test environment, unrelated to StepTargeting's own correctness (its
  // imports, including ScreenMap, already resolve fine per the tests above).

  it('renders the campaign name input when no existingCampaign is passed', () => {
    render(
      <StepTargeting
        form={baseForm}
        setForm={() => {}}
        reachSummary={null}
        allScreens={[]}
        onPrevCampaigns={null}
      />
    );
    expect(screen.getByPlaceholderText('e.g. Summer Promo 2026')).toBeInTheDocument();
    expect(screen.queryByText('Adding a new targeting group to')).not.toBeInTheDocument();
  });

  it('renders a banner instead of the name input when existingCampaign is passed', () => {
    render(
      <StepTargeting
        form={baseForm}
        setForm={() => {}}
        reachSummary={null}
        allScreens={[]}
        onPrevCampaigns={null}
        existingCampaign={{ id: 'abc123', name: 'Summer Promo 2026' }}
      />
    );
    expect(screen.queryByPlaceholderText('e.g. Summer Promo 2026')).not.toBeInTheDocument();
    expect(screen.getByText('Adding a new targeting group to')).toBeInTheDocument();
    expect(screen.getByText('Summer Promo 2026')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test file**

Run: `npx vitest run src/views/advertiser/createCampaign/StepTargeting.smoke.test.jsx`
Expected: PASS (5 tests)

- [ ] **Step 3: Commit**

```bash
git add src/views/advertiser/createCampaign/StepTargeting.smoke.test.jsx
git commit -m "test: cover LocationSearch selection in StepTargeting smoke test

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Full suite run + manual QA

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — all suites green, including `src/lib/locationIndex.test.js`, `src/views/advertiser/createCampaign/LocationSearch.test.jsx`, and the updated `StepTargeting.smoke.test.jsx`.

- [ ] **Step 2: Run lint**

Run: `npx eslint src/lib/locationIndex.js src/views/advertiser/createCampaign/LocationSearch.jsx src/views/advertiser/createCampaign/ScreenMap.jsx src/views/advertiser/createCampaign/StepTargeting.jsx src/views/advertiser/CreateCampaign.jsx`
Expected: no errors

- [ ] **Step 3: Manual QA in the running app** (Leaflet/drag interaction isn't covered by the automated suite — see Task 3)

Start the dev server and, in the advertiser Create Campaign flow's targeting step:

1. **Country** — confirm the dropdown lists only countries with real screens (not the old static 4-country list unless all 4 have inventory).
2. **State** — confirm it re-filters when Country changes.
3. **City** — type a partial city name (e.g. "tor"), confirm a matching suggestion with screen count appears, click it, confirm Country/State/City all update.
4. **Radius** — search and pick a city with screens that have coordinates; confirm the map appears centered on that city with the radius circle and km chips. Drag the pin to a nearby spot; confirm the radius circle follows and the screen-count reach summary updates.
5. **Radius, no-coords city** (if any exist in the current dataset) — confirm it does not appear in the Radius search results, but does appear under City search.
6. Submit a campaign through this step to confirm `matchedScreens` in `CreateCampaign.jsx` still resolves correctly end-to-end (unchanged filter logic, but worth one live check).

- [ ] **Step 4: Final commit if QA turned up fixes; otherwise no commit needed for this task**

```bash
git status
```

If QA required no code changes, this task ends here — Task 4/5/6 commits already cover the shippable change.
