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
