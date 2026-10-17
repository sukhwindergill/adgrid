import { useState, useEffect, useRef } from 'react';
import { C, F, T } from '../design/tokens.js';
import { TX } from '../design/text.js';
import { geocodeAddress } from '../lib/geocodeAddress.js';
import { Btn } from './primitives/Btn.jsx';
import { Inp } from './primitives/Inp.jsx';
import { useT } from '../i18n/useT.js';

const toolBtn = { padding: '8px 12px', color: C.textSub };

const DEFAULT_CENTER = [43.6532, -79.3832]; // Toronto — same fallback as CreateCampaign's radius map

// Single-pin map picker for screen registration. Mirrors the raw-Leaflet
// dynamic-import pattern used by CreateCampaign's ScreenMap (no react-leaflet
// component tree — this app loads Leaflet imperatively and drives it via refs).
export function ScreenLocationPicker({ value, onChange }) {
  const { t } = useT();
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
    if (!result) { setErr(t('scr.location.noMatch')); return; }
    placeAt(result.lat, result.lng);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) { setErr(t('scr.location.noGeo')); return; }
    setLocating(true);
    setErr(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocating(false); placeAt(pos.coords.latitude, pos.coords.longitude, 16); },
      () => { setLocating(false); setErr(t('scr.location.geoFailed')); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <Inp
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), search())}
          placeholder={t('scr.location.placeholder')}
          aria-label={t('scr.location.label')}
          wrapperStyle={{ flex: 1 }}
          style={{ padding: '8px 10px', fontSize: T.sm }}
        />
        <Btn variant="secondary" size="sm" type="button" onClick={search} disabled={searching} style={toolBtn}>
          {searching ? t('scr.location.searching') : t('scr.location.search')}
        </Btn>
        <Btn variant="secondary" size="sm" type="button" onClick={useMyLocation} disabled={locating} style={toolBtn}>
          {locating ? t('scr.location.locating') : t('scr.location.useMine')}
        </Btn>
      </div>

      <div ref={mapRef} style={{ height: 240, borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.border}` }} />

      <div style={{ ...TX.caption, marginTop: 6 }}>
        {value
          ? t('scr.location.pinned', { lat: value.lat.toFixed(5), lng: value.lng.toFixed(5) })
          : t('scr.location.hint')}
      </div>
      {err && <div style={{ fontSize: T.xs, color: C.redText, fontFamily: F.sans, marginTop: 4 }}>{err}</div>}
    </div>
  );
}
