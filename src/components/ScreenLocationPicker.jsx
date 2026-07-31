import { useState, useEffect, useRef } from 'react';
import { C, F } from '../design/tokens.js';
import { geocodeAddress } from '../lib/geocodeAddress.js';

const DEFAULT_CENTER = [43.6532, -79.3832]; // Toronto — same fallback as CreateCampaign's radius map

// Single-pin map picker for screen registration. Mirrors the raw-Leaflet
// dynamic-import pattern used by CreateCampaign's ScreenMap (no react-leaflet
// component tree — this app loads Leaflet imperatively and drives it via refs).
export function ScreenLocationPicker({ value, onChange }) {
  const mapRef = useRef(null);
  const leafletRef = useRef(null);
  const markerRef = useRef(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css'; link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
      const L = (await import('leaflet')).default;
      if (cancelled) return;
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const start = value ? [value.lat, value.lng] : DEFAULT_CENTER;
      const map = L.map(mapRef.current, { zoomControl: true }).setView(start, value ? 15 : 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 18 }).addTo(map);

      if (value) {
        markerRef.current = L.marker(start, { draggable: true }).addTo(map);
        markerRef.current.on('dragend', () => {
          const { lat, lng } = markerRef.current.getLatLng();
          onChangeRef.current({ lat, lng });
        });
      }

      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        if (markerRef.current) {
          markerRef.current.setLatLng(e.latlng);
        } else {
          markerRef.current = L.marker(e.latlng, { draggable: true }).addTo(map);
          markerRef.current.on('dragend', () => {
            const p = markerRef.current.getLatLng();
            onChangeRef.current({ lat: p.lat, lng: p.lng });
          });
        }
        onChangeRef.current({ lat, lng });
      });

      leafletRef.current = { L, map };
    }

    init();

    return () => {
      cancelled = true;
      if (leafletRef.current?.map) { leafletRef.current.map.remove(); leafletRef.current = null; }
    };
    // Map is created once; value changes after that are driven by user
    // interaction (click/drag/search), not by re-centering on prop updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const placeAt = (lat, lng, zoom = 15) => {
    const { map, L } = leafletRef.current ?? {};
    if (!map) return;
    map.setView([lat, lng], zoom);
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(map);
      markerRef.current.on('dragend', () => {
        const p = markerRef.current.getLatLng();
        onChangeRef.current({ lat: p.lat, lng: p.lng });
      });
    }
    onChangeRef.current({ lat, lng });
  };

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setErr(null);
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    const result = await geocodeAddress(query, token);
    setSearching(false);
    if (!result) { setErr('No match found — try a more specific address.'); return; }
    placeAt(result.lat, result.lng);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) { setErr('Geolocation is not available in this browser.'); return; }
    setLocating(true);
    setErr(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocating(false); placeAt(pos.coords.latitude, pos.coords.longitude, 16); },
      () => { setLocating(false); setErr('Could not get your location — check browser permissions.'); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), search())}
          placeholder="Search an address…"
          style={{
            flex: 1, padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`,
            fontFamily: F.sans, fontSize: 12, color: C.text, background: C.surface,
          }}
        />
        <button type="button" onClick={search} disabled={searching} style={{
          padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
          background: C.surface, color: C.textSub, fontFamily: F.sans, fontSize: 12,
          cursor: searching ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
        }}>
          {searching ? 'Searching…' : 'Search'}
        </button>
        <button type="button" onClick={useMyLocation} disabled={locating} style={{
          padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
          background: C.surface, color: C.textSub, fontFamily: F.sans, fontSize: 12,
          cursor: locating ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
        }}>
          {locating ? 'Locating…' : '📍 Use my location'}
        </button>
      </div>

      <div ref={mapRef} style={{ height: 240, borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.border}` }} />

      <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 6 }}>
        {value
          ? `Pinned at ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)} — click the map or drag the pin to adjust.`
          : 'Click the map to drop a pin, search an address, or use your current location.'}
      </div>
      {err && <div style={{ fontSize: 11, color: C.red, fontFamily: F.sans, marginTop: 4 }}>{err}</div>}
    </div>
  );
}
