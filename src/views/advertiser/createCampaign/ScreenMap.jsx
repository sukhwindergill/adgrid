// src/views/advertiser/createCampaign/ScreenMap.jsx
import { useEffect, useRef } from 'react';
import { C } from '../../../design/tokens.js';
import { haversineKm } from '../../../lib/geo.js';

export function ScreenMap({ center, radius, screens, selected, onToggle, draggableCenter = false, onCenterChange }) {
  const mapRef    = useRef(null);
  const leafletRef = useRef(null);
  const markersRef = useRef([]);
  const circleRef  = useRef(null);
  const centerMarkerRef = useRef(null);

  useEffect(() => {
    async function init() {
      if (leafletRef.current) return;
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css'; link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
      const L = (await import('leaflet')).default;
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
      const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: false }).setView(center, 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 18 }).addTo(map);
      leafletRef.current = { L, map };
    }
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

      markersRef.current.forEach(mk => mk.remove());
      markersRef.current = screens.filter(s => s.lat != null && s.lon != null).map(s => {
        // A screen with unknown coordinates is excluded, not treated as
        // distance zero — haversineKm returns null rather than NaN for that.
        const d = haversineKm(center[0], center[1], s.lat, s.lon);
        const inRadius = d !== null && d <= radius;
        const isSel = selected.includes(s.id);
        const icon = Lf.divIcon({
          className: '',
          html: `<div style="width:14px;height:14px;border-radius:50%;background:${isSel ? '#7c3aed' : inRadius ? '#16a34a' : '#9ca3af'};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.3);cursor:${inRadius ? 'pointer' : 'default'}"></div>`,
          iconSize: [14, 14], iconAnchor: [7, 7],
        });
        const marker = Lf.marker([s.lat, s.lon], { icon });
        marker.bindTooltip(s.name, { permanent: false, direction: 'top', offset: [0, -8] });
        if (inRadius) marker.on('click', () => onToggle(s.id));
        return marker.addTo(m);
      });
    });
  }, [center, radius, screens, selected, draggableCenter]);

  useEffect(() => () => {
    if (leafletRef.current?.map) { leafletRef.current.map.remove(); leafletRef.current = null; }
  }, []);

  return <div ref={mapRef} style={{ height: 260, borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.border}`, marginBottom: 16 }} />;
}
