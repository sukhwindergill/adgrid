import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import '../marketing/marketing.css';
import { supabase } from '../../lib/supabase.js';
import { usePageMeta } from '../../lib/usePageMeta.js';
import { fetchPublicScreens, summarizePublicScreens, PUBLIC_MAP_MIN_SCREENS } from '../../lib/publicScreens.js';
import { VENUE_TAXONOMY } from '../../lib/venueTypes.js';

const LAUNCH_CITIES = ['Toronto', 'Vancouver'];
const DEFAULT_CENTER = [49.5, -101]; // fits Toronto and Vancouver
const money = n => `$${Number(n).toFixed(n % 1 ? 2 : 0)}`;

// Approximate screen areas. Rows are already rounded to ~1 km server-side;
// fixed-size circles (not pins) read as areas, not addresses, and stay
// visible at the country-wide zoom that fits both launch cities.
function ScreenMap({ rows }) {
  const el = useRef(null);

  useEffect(() => {
    let map;
    let cancelled = false;
    (async () => {
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css'; link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
      const L = (await import('leaflet')).default;
      if (cancelled || !el.current) return;
      map = L.map(el.current, { scrollWheelZoom: false }).setView(DEFAULT_CENTER, 4);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 16 }).addTo(map);
      const layer = L.featureGroup();
      for (const r of rows) {
        // city is operator-entered free text: build the popup from text
        // nodes, never an HTML string, so it can't inject markup.
        const popup = document.createElement('div');
        const venue = document.createElement('strong');
        venue.textContent = VENUE_TAXONOMY[r.venue_category]?.label ?? 'Venue';
        popup.append(venue);
        for (const line of [r.city, Number(r.cpm_floor) > 0 && `From ${money(r.cpm_floor)} per 1,000 views`]) {
          if (line) popup.append(document.createElement('br'), document.createTextNode(line));
        }
        L.circleMarker([r.lat, r.lon], { radius: 9, color: '#7B2FFF', weight: 1.5, fillOpacity: 0.35 })
          .bindPopup(popup)
          .addTo(layer);
      }
      layer.addTo(map);
      if (rows.length) map.fitBounds(layer.getBounds(), { padding: [32, 32], maxZoom: 12 });
    })();
    return () => { cancelled = true; if (map) map.remove(); };
  }, [rows]);

  return <div ref={el} className="pscreens-map" role="region" aria-label="Map of approximate screen locations" />;
}

export function PublicScreens() {
  usePageMeta({
    title: 'Advertise on Screens in Toronto & Vancouver | AdGrid',
    description: 'Digital screens in gyms, cafés, salons and more across Toronto and Vancouver. See where they are and what they cost, then book with no minimum spend.',
  });
  const [state, setState] = useState({ status: 'loading', count: 0, rows: [] });

  useEffect(() => {
    let cancelled = false;
    fetchPublicScreens(supabase)
      .then(({ count, rows }) => { if (!cancelled) setState({ status: 'ready', count, rows }); })
      .catch(() => { if (!cancelled) setState({ status: 'error', count: 0, rows: [] }); });
    return () => { cancelled = true; };
  }, []);

  const showMap = state.status === 'ready' && state.count >= PUBLIC_MAP_MIN_SCREENS && state.rows.length > 0;
  const summary = summarizePublicScreens(state.rows);
  const venueTypes = Object.entries(VENUE_TAXONOMY).filter(([k]) => k !== 'other').map(([, v]) => v.label);

  return (
    <div id="main-content" className="mktg" style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <nav className="mnav">
        <div className="inner">
          <Link to="/" className="logo" style={{ textDecoration: 'none' }}>AdGrid</Link>
          <div className="nav-spacer" />
          <Link to="/?role=advertiser#waitlist-form" className="btn-p">Get early access</Link>
        </div>
      </nav>

      <section className="sec dark" style={{ paddingTop: 128 }}>
        <div className="inner">
          <div className="eyebrow">The AdGrid network</div>
          <h1 className="sec-h" style={{ fontSize: 'clamp(34px, 5vw, 52px)' }}>
            Screens where your customers already are
          </h1>
          <p className="sec-sub">
            Digital screens in gyms, cafés, salons and other local venues. Venue owners approve
            every ad, and every campaign gets a QR code so you can see what it brought in.
          </p>

          {state.status === 'loading' && <p className="pscreens-note">Loading screens…</p>}

          {showMap && (
            <>
              <div className="pscreens-stats">
                <div><strong>{state.count}</strong><span>screens live</span></div>
                <div><strong>{summary.cities.length}</strong><span>{summary.cities.length === 1 ? 'city' : 'cities'}</span></div>
                {summary.cpmRange && (
                  <div>
                    <strong>{money(summary.cpmRange.min)}–{money(summary.cpmRange.max)}</strong>
                    <span>per 1,000 views</span>
                  </div>
                )}
              </div>
              <ScreenMap rows={state.rows} />
              <p className="pscreens-note">Circles show approximate areas. Exact venues are shown after you sign up.</p>
              <div className="pscreens-chips" aria-label="Venue types">
                {summary.venues.map(v => <span key={v.name} className="venue-chip">{v.name} · {v.count}</span>)}
              </div>
            </>
          )}

          {(state.status === 'error' || (state.status === 'ready' && !showMap)) && (
            <div className="pscreens-soon">
              <h2>Launching in {LAUNCH_CITIES.join(' & ')}</h2>
              <p>
                We're onboarding venues now. Join the waitlist and we'll show you the screens
                near your business, with prices, as soon as they're bookable.
              </p>
              <div className="pscreens-chips" aria-label="Venue types">
                {venueTypes.map(v => <span key={v} className="venue-chip">{v}</span>)}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 36 }}>
            <Link to="/?role=advertiser#waitlist-form" className="btn-p">Get early access</Link>
            <Link to="/?role=operator#waitlist-form" className="btn-s">List your screen</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
