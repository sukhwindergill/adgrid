# Screen Location Picker Design

**Date:** 2026-05-14  
**Status:** Approved

## Problem

Lat/lng fields in screen registration are optional text inputs. Screens without coordinates are invisible to advertisers on the campaign map. Manual coordinate entry is error-prone and poor UX for non-technical operators.

## Goals

- Location required before screen can be saved
- Operator can find location via address/postcode search or GPS
- Draggable pin confirms exact placement
- No external API costs or keys required

## Component: ScreenLocationPicker

New component extracted to `src/components/ScreenLocationPicker.jsx`.

**Props:**
- `value: { lat, lng } | null` — current location
- `onChange: ({ lat, lng }) => void` — called on pin place/drag

**UI elements:**
1. Address search input + Search button (Enter key supported)
2. "📍 Use my location" button (browser GPS)
3. Leaflet map (Leaflet loaded via CDN same as CreateCampaign) — 280px tall, draggable marker
4. Confirmation text: "📍 51.5142, -0.1494" — updates live on drag

**Leaflet setup:** Same pattern as CreateCampaign — dynamic import via `useEffect`, OSM tile layer, default marker icons from unpkg CDN.

**Draggable pin:** Placed on search result or GPS fix. `marker.on('dragend', ...)` updates `lat/lng` and calls `onChange`.

## Geocoding (Nominatim)

- Endpoint: `https://nominatim.openstreetmap.org/search?q={query}&format=json&limit=1`
- Headers: `{ 'User-Agent': 'AdGrid/1.0' }` (required by Nominatim ToS)
- On result: pan map, place draggable pin at `[lat, lon]`
- On empty result: show inline "Address not found" below input
- Rate limit: 1 req/sec — manual submit, no debounce needed

## GPS

- `navigator.geolocation.getCurrentPosition` on button click
- On success: place draggable pin at user coords, pan map
- On deny/error: show inline "Location access denied" message

## AddScreenModal Integration

- Remove existing `Inp` lat/lng fields
- Replace with `<ScreenLocationPicker value={{ lat: form.lat, lng: form.lng }} onChange={({ lat, lng }) => setForm(s => ({ ...s, lat, lng }))} />`
- Save guard added:
  ```js
  if (!form.lat || !form.lng) {
    setErr('Pin your screen location on the map to continue.');
    return;
  }
  ```

## Out of Scope

- Showing other registered screens on the picker map
- Reverse geocoding (pin → address)
- Map in screen edit/detail view
