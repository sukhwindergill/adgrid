import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../marketing/marketing.css';
import { supabase } from '../../lib/supabase.js';
import { usePageMeta } from '../../lib/usePageMeta.js';
import { fetchPublicScreens, summarizePublicScreens, PUBLIC_MAP_MIN_SCREENS } from '../../lib/publicScreens.js';
import { VENUE_TAXONOMY } from '../../lib/venueTypes.js';
import { Nav } from '../marketing/sections/Nav.jsx';
import { useT } from '../../i18n/useT.js';

const DEFAULT_CENTER = [49.5, -101]; // fits Toronto and Vancouver
const money = (formatCurrency, n) => formatCurrency(n, { decimals: Number(n) % 1 ? 2 : 0 });

// summarizePublicScreens() groups by the English taxonomy label; map it back
// to the category key so the chip can be shown in the current language.
const LABEL_TO_CATEGORY = Object.fromEntries(Object.entries(VENUE_TAXONOMY).map(([k, v]) => [v.label, k]));

// Approximate screen areas. Rows are already rounded to ~1 km server-side;
// fixed-size circles (not pins) read as areas, not addresses, and stay
// visible at the country-wide zoom that fits both launch cities.
function ScreenMap({ rows }) {
  const { t, formatCurrency } = useT();
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
        venue.textContent = VENUE_TAXONOMY[r.venue_category] ? t(`venue.category.${r.venue_category}`) : t('venue.fallback');
        popup.append(venue);
        for (const line of [r.city, Number(r.cpm_floor) > 0 && t('public.screens.fromPerThousand', { price: money(formatCurrency, r.cpm_floor) })]) {
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
  }, [rows, t, formatCurrency]);

  return <div ref={el} className="pscreens-map" role="region" aria-label={t('public.screens.mapLabel')} />;
}

export function PublicScreens() {
  const { t, formatCurrency, formatNumber } = useT();
  usePageMeta({
    title: t('public.screens.metaTitle'),
    description: t('public.screens.metaDescription'),
  });
  const navigate = useNavigate();
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
  const venueTypes = Object.keys(VENUE_TAXONOMY).filter(k => k !== 'other').map(k => t(`venue.category.${k}`));

  return (
    <div id="main-content" className="mktg" style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Same nav as the home page; section links jump back to it by hash. */}
      <Nav
        onScrollTo={id => navigate(`/#${id}`)}
        onLogin={() => navigate('/login')}
        onSignup={() => navigate('/login?mode=signup&intent=advertiser')}
      />

      <section className="sec dark" style={{ paddingTop: 128 }}>
        <div className="inner">
          <div className="eyebrow">{t('public.screens.eyebrow')}</div>
          <h1 className="sec-h" style={{ fontSize: 'clamp(34px, 5vw, 52px)' }}>
            {t('public.screens.heading')}
          </h1>
          <p className="sec-sub">
            {t('public.screens.sub')}
          </p>

          {state.status === 'loading' && <p className="pscreens-note">{t('public.screens.loading')}</p>}

          {showMap && (
            <>
              <div className="pscreens-stats">
                <div><strong>{formatNumber(state.count)}</strong><span>{t('public.screens.screensLive', { count: state.count })}</span></div>
                <div><strong>{summary.cities.length}</strong><span>{t('public.screens.cities', { count: summary.cities.length })}</span></div>
                {summary.cpmRange && (
                  <div>
                    <strong>{money(formatCurrency, summary.cpmRange.min)}–{money(formatCurrency, summary.cpmRange.max)}</strong>
                    <span>{t('public.screens.perThousand')}</span>
                  </div>
                )}
              </div>
              <ScreenMap rows={state.rows} />
              <p className="pscreens-note">{t('public.screens.approxNote')}</p>
              <div className="pscreens-chips" aria-label={t('public.screens.venueTypes')}>
                {summary.venues.map(v => (
                  <span key={v.name} className="venue-chip">
                    {LABEL_TO_CATEGORY[v.name] ? t(`venue.category.${LABEL_TO_CATEGORY[v.name]}`) : v.name} · {formatNumber(v.count)}
                  </span>
                ))}
              </div>
            </>
          )}

          {(state.status === 'error' || (state.status === 'ready' && !showMap)) && (
            <div className="pscreens-soon">
              <h2>{t('public.screens.onboarding')}</h2>
              <p>
                {t('public.screens.soonBody')}
              </p>
              <div className="pscreens-chips" aria-label={t('public.screens.venueTypes')}>
                {venueTypes.map(v => <span key={v} className="venue-chip">{v}</span>)}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 36 }}>
            <Link to="/login?mode=signup&intent=advertiser" className="btn-p">{t('public.screens.book')}</Link>
            <Link to="/login?mode=signup&intent=operator" className="btn-s">{t('public.screens.list')}</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
