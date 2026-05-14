# Screen Location Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace optional lat/lng text inputs in screen registration with a map picker (address search + GPS), making coordinates required before save.

**Architecture:** New `ScreenLocationPicker` component extracted to its own file — Leaflet map with draggable pin, Nominatim geocoding, browser GPS. `AddScreenModal` in `Screens.jsx` replaces lat/lng `Inp` fields with this component and adds a save guard.

**Tech Stack:** React, Leaflet (dynamic import — already used in CreateCampaign), Nominatim OSM geocoding API (free, no key)

---

## File Map

| File | Change |
|---|---|
| `src/components/ScreenLocationPicker.jsx` | Create — map picker component |
| `src/views/operator/Screens.jsx` | Modify — replace lat/lng inputs, add save guard |

---

## Task 1: ScreenLocationPicker component

**Files:**
- Create: `src/components/ScreenLocationPicker.jsx`

The component renders: address search input + Search button, "Use my location" GPS button, 280px Leaflet map with draggable pin, live coordinate display. Calls `onChange({ lat, lng })` whenever pin moves.

- [ ] **Step 1: Create the file with map init**

```jsx
// src/components/ScreenLocationPicker.jsx
import { useEffect, useRef, useState } from 'react';
import { C, F } from '../design/tokens.js';
import { Inp } from './primitives/Inp.jsx';
import { Btn } from './primitives/Btn.jsx';

export function ScreenLocationPicker({ value, onChange }) {
  const mapRef    = useRef(null);
  const leafletRef = useRef(null);  // { L, map, marker }
  const [query,   setQuery]   = useState('');
  const [geoErr,  setGeoErr]  = useState('');
  const [searching, setSearching] = useState(false);

  // ── Init Leaflet ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (leafletRef.current) return;

      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      const L = (await import('leaflet')).default;
      if (cancelled) return;

      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: false })
        .setView([51.505, -0.09], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(map);

      leafletRef.current = { L, map, marker: null };

      // If value already set (edit mode), place pin
      if (value?.lat != null && value?.lng != null) {
        placePin(value.lat, value.lng, false);
      }
    }

    init();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Place / move pin ────────────────────────────────────────────────────────
  function placePin(lat, lng, pan = true) {
    const { L, map, marker } = leafletRef.current;
    if (marker) marker.remove();
    const m = L.marker([lat, lng], { draggable: true }).addTo(map);
    m.on('dragend', () => {
      const p = m.getLatLng();
      onChange({ lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) });
    });
    leafletRef.current.marker = m;
    if (pan) map.setView([lat, lng], 16);
    onChange({ lat: +lat.toFixed(6), lng: +lng.toFixed(6) });
  }

  // ── Nominatim search ────────────────────────────────────────────────────────
  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim() || !leafletRef.current) return;
    setSearching(true);
    setGeoErr('');
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
        { headers: { 'User-Agent': 'AdGrid/1.0' } }
      );
      const data = await res.json();
      if (!data.length) { setGeoErr('Address not found. Try a different search.'); return; }
      placePin(parseFloat(data[0].lat), parseFloat(data[0].lon));
    } catch {
      setGeoErr('Search failed. Check your connection.');
    } finally {
      setSearching(false);
    }
  }

  // ── GPS ─────────────────────────────────────────────────────────────────────
  function handleGPS() {
    setGeoErr('');
    if (!navigator.geolocation) { setGeoErr('Geolocation not supported by your browser.'); return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        if (!leafletRef.current) return;
        placePin(pos.coords.latitude, pos.coords.longitude);
      },
      () => setGeoErr('Location access denied. Enable location in your browser settings.'),
    );
  }

  return (
    <div>
      {/* Address search */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <Inp
            label="Search address or postcode"
            placeholder="e.g. Oxford Street, London"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <Btn type="submit" variant="secondary" size="sm" disabled={searching} style={{ marginTop: 20, flexShrink: 0 }}>
          {searching ? '…' : 'Search'}
        </Btn>
      </form>

      {/* GPS button */}
      <button
        type="button"
        onClick={handleGPS}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: `1px solid ${C.border}`, borderRadius: 8,
          padding: '7px 12px', cursor: 'pointer', fontSize: 13,
          color: C.textSub, fontFamily: F.sans, marginBottom: 8,
        }}
      >
        📍 Use my location
      </button>

      {/* Error */}
      {geoErr && (
        <div style={{ fontSize: 12, color: C.red, fontFamily: F.sans, marginBottom: 8 }}>{geoErr}</div>
      )}

      {/* Map */}
      <div
        ref={mapRef}
        style={{ height: 280, borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden', marginBottom: 6 }}
      />

      {/* Coordinate confirmation */}
      {value?.lat != null && (
        <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.mono }}>
          📍 {value.lat}, {value.lng} — drag pin to adjust
        </div>
      )}
      {value?.lat == null && (
        <div style={{ fontSize: 12, color: C.textMuted, fontFamily: F.sans }}>
          Search an address or use your location to place a pin
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify file created with no syntax errors**

```bash
cd C:\Users\corpo\adgrid\.claude\worktrees\focused-mcclintock-f21a7d && npm run build 2>&1 | tail -20
```

Expected: build succeeds (or fails only on unrelated issues — not on `ScreenLocationPicker.jsx`).

- [ ] **Step 3: Commit**

```bash
git add src/components/ScreenLocationPicker.jsx
git commit -m "feat: ScreenLocationPicker — map with address search and GPS"
```

---

## Task 2: Wire ScreenLocationPicker into AddScreenModal

**Files:**
- Modify: `src/views/operator/Screens.jsx`

Replace the two optional lat/lng `Inp` fields with `ScreenLocationPicker`. Add save guard.

- [ ] **Step 1: Add import at top of Screens.jsx**

Find the existing imports block at the top of `src/views/operator/Screens.jsx`. Add:

```jsx
import { ScreenLocationPicker } from '../../components/ScreenLocationPicker.jsx';
```

- [ ] **Step 2: Remove lat/lng from form initial state**

Find in `AddScreenModal`:

```jsx
const [form, setForm] = useState({
  name: '', owner: '', type: 'Business', city: 'Toronto', location: '',
  display_size: '', monthly_traffic_estimate: '', cpm_floor: '3.00',
  lat: '', lng: '',
});
```

Replace with:

```jsx
const [form, setForm] = useState({
  name: '', owner: '', type: 'Business', city: 'Toronto', location: '',
  display_size: '', monthly_traffic_estimate: '', cpm_floor: '3.00',
  lat: null, lng: null,
});
```

- [ ] **Step 3: Add save guard for missing coordinates**

Find the `save` function. After the existing early return for missing name/owner:

```jsx
if (!form.name.trim() || !form.owner.trim()) return;
```

Add immediately after:

```jsx
if (form.lat == null || form.lng == null) {
  setErr('Pin your screen location on the map to continue.');
  return;
}
```

- [ ] **Step 4: Replace lat/lng Inp fields with ScreenLocationPicker**

Find this block in the form JSX:

```jsx
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
  <Inp label="Latitude (optional)" type="number" step="any" placeholder="e.g. 51.5074" value={form.lat} onChange={e => setForm(s => ({ ...s, lat: e.target.value }))} hint="For map placement" />
  <Inp label="Longitude (optional)" type="number" step="any" placeholder="e.g. -0.1278" value={form.lng} onChange={e => setForm(s => ({ ...s, lng: e.target.value }))} hint="For map placement" />
</div>
```

Replace with:

```jsx
<div>
  <div style={{ fontSize: 12, fontWeight: 600, color: C.textMid, fontFamily: F.sans, marginBottom: 6 }}>
    Screen Location <span style={{ color: C.red }}>*</span>
  </div>
  <ScreenLocationPicker
    value={{ lat: form.lat, lng: form.lng }}
    onChange={({ lat, lng }) => setForm(s => ({ ...s, lat, lng }))}
  />
</div>
```

- [ ] **Step 5: Verify in dev server**

```bash
npm run dev
```

Open `http://localhost:5173` (or the assigned port), log in as operator, click "Register New Screen". Verify:
1. Map renders in the modal
2. Address search places a pin and shows coordinates below map
3. "Use my location" button triggers browser GPS prompt
4. Clicking Save without placing pin shows error: "Pin your screen location on the map to continue."
5. After placing pin, Save proceeds normally

- [ ] **Step 6: Commit**

```bash
git add src/views/operator/Screens.jsx
git commit -m "feat: require screen location via map picker, remove optional lat/lng inputs"
```

---

## Self-Review

**Spec coverage:**
- ✅ Address search → Nominatim geocoding: Task 1 (`handleSearch`)
- ✅ GPS button: Task 1 (`handleGPS`)
- ✅ Draggable pin with live coordinate display: Task 1 (`placePin`, `dragend` handler, coordinate display)
- ✅ `onChange` prop interface: Task 1 (prop signature + calls)
- ✅ Save blocked until pin placed: Task 2 (save guard)
- ✅ Lat/lng fields removed: Task 2 (Step 4)
- ✅ `User-Agent` header on Nominatim: Task 1 (fetch headers)

**Placeholder scan:** None found. All code blocks complete.

**Type consistency:** `value` prop is `{ lat, lng } | { lat: null, lng: null }` throughout. `onChange` receives `{ lat: number, lng: number }` in both `placePin` and `dragend`. `form.lat`/`form.lng` initialized to `null` (not `''`) so `== null` guard works correctly.
