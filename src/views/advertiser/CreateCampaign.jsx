// src/views/advertiser/CreateCampaign.jsx
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F } from '../../design/tokens.js';
import { Card } from '../../components/primitives/Card.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { Inp } from '../../components/primitives/Inp.jsx';
import { SelInput } from '../../components/primitives/SelInput.jsx';
import { ErrorBanner } from '../../components/primitives/ErrorBanner.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { CreativePreview } from '../../components/shared/CreativePreview.jsx';
import { CATEGORIES } from '../../lib/data.js';
import { VENUE_TAXONOMY, COUNTRIES } from '../../lib/venueTypes.js';
import { useBreakpoint } from '../../lib/useBreakpoint.js';
import { useAuth } from '../../context/AuthContext.jsx';

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const STEP_LABELS = ['Area', 'Filters', 'Screens', 'Creative', 'Budget', 'Launch', 'Review'];

const CITY_CENTERS = {
  'Toronto':    [43.6532, -79.3832],
  'London':     [51.5074, -0.1278],
  'Manchester': [53.4808, -2.2426],
  'Birmingham': [52.4862, -1.8904],
  'Vancouver':  [49.2827, -123.1207],
  'Edinburgh':  [55.9533, -3.1883],
};

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Stepper ─────────────────────────────────────────────────────────────────

function Stepper({ step, onCancel }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: C.textMuted, fontFamily: F.sans }}>Step {step + 1} of {STEP_LABELS.length}</div>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: 12, color: C.textMuted, cursor: 'pointer', fontFamily: F.sans }}>Cancel</button>
      </div>
      <div style={{ height: 4, background: C.border, borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${(step / (STEP_LABELS.length - 1)) * 100}%`, background: C.purple, borderRadius: 2, transition: 'width 0.3s' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        {STEP_LABELS.map((l, i) => (
          <div key={l} style={{ fontSize: 10, fontFamily: F.sans, color: i <= step ? C.purple : C.textMuted, fontWeight: i === step ? 600 : 400 }}>{l}</div>
        ))}
      </div>
    </div>
  );
}

// ─── PillGroup ────────────────────────────────────────────────────────────────

function PillGroup({ options, value, onChange, multi = false }) {
  const vals = multi ? (value || []) : null;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {options.map(opt => {
        const v = typeof opt === 'string' ? opt : opt.value;
        const l = typeof opt === 'string' ? opt : opt.label;
        const active = multi ? vals.includes(v) : value === v;
        return (
          <button key={v} type="button" onClick={() => {
            if (multi) {
              onChange(active ? vals.filter(x => x !== v) : [...vals, v]);
            } else {
              onChange(v);
            }
          }} style={{
            padding: '7px 14px', borderRadius: 20, cursor: 'pointer',
            border: `1px solid ${active ? C.purple : C.border}`,
            background: active ? C.purpleSoft : C.surface,
            color: active ? C.purple : C.textSub,
            fontSize: 12, fontWeight: 500, fontFamily: F.sans, transition: 'all 0.15s',
          }}>{l}</button>
        );
      })}
    </div>
  );
}

// ─── Leaflet map (radius mode only) ──────────────────────────────────────────

function ScreenMap({ center, radius, screens, selected, onToggle }) {
  const mapRef    = useRef(null);
  const leafletRef = useRef(null);
  const markersRef = useRef([]);
  const circleRef  = useRef(null);

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
      markersRef.current.forEach(mk => mk.remove());
      markersRef.current = screens.filter(s => s.lat != null && s.lon != null).map(s => {
        const d = haversine(center[0], center[1], s.lat, s.lon);
        const inRadius = d <= radius;
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
  }, [center, radius, screens, selected]);

  useEffect(() => () => {
    if (leafletRef.current?.map) { leafletRef.current.map.remove(); leafletRef.current = null; }
  }, []);

  return <div ref={mapRef} style={{ height: 260, borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.border}`, marginBottom: 16 }} />;
}

// ─── Step 1: Area ─────────────────────────────────────────────────────────────

function StepArea({ form, setForm, reachSummary, allScreens, onPrevCampaigns }) {
  const [geocoding, setGeocoding] = useState(false);

  const setField = (k, v) => setForm(s => ({ ...s, [k]: v }));

  const geocodeCenter = async (query) => {
    if (!query.trim()) return;
    if (CITY_CENTERS[query]) {
      setForm(s => ({ ...s, radius_center_lat: CITY_CENTERS[query][0], radius_center_lon: CITY_CENTERS[query][1] }));
      return;
    }
    setGeocoding(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`);
      const data = await res.json();
      if (data[0]) {
        setForm(s => ({ ...s, radius_center_lat: parseFloat(data[0].lat), radius_center_lon: parseFloat(data[0].lon) }));
      }
    } catch (_) {}
    setGeocoding(false);
  };

  const radiusCenter = form.radius_center_lat && form.radius_center_lon
    ? [form.radius_center_lat, form.radius_center_lon]
    : CITY_CENTERS['Toronto'];

  const radiusScreens = allScreens.filter(s => s.lat != null && s.lon != null);

  return (
    <div style={{ maxWidth: 620, margin: '0 auto' }}>
      <Card style={{ padding: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: '0 0 4px' }}>Where do you want to advertise?</h2>
        <p style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, margin: '0 0 20px' }}>Choose an area and we'll find matching screens for you.</p>

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
          <SelInput label="Country" value={form.country} onChange={e => setField('country', e.target.value)}>
            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
          </SelInput>

          {(form.area_type === 'state' || form.area_type === 'city' || form.area_type === 'radius') && (
            <Inp label="State / Province" placeholder="e.g. Ontario" value={form.state} onChange={e => setField('state', e.target.value)} />
          )}

          {(form.area_type === 'city' || form.area_type === 'radius') && (
            <Inp label="City" placeholder="e.g. Toronto" value={form.city} onChange={e => setField('city', e.target.value)} />
          )}

          {form.area_type === 'radius' && (
            <div>
              <Inp
                label="Center location"
                placeholder="e.g. King St W, Toronto"
                value={form.radius_center}
                onChange={e => setField('radius_center', e.target.value)}
                onBlur={e => geocodeCenter(e.target.value)}
              />
              {geocoding && <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 4 }}>Locating…</div>}
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 8 }}>
                  Radius: {form.radius_km} km
                </div>
                <PillGroup
                  options={[5, 10, 25, 50, 100].map(v => ({ value: v, label: `${v}km` }))}
                  value={form.radius_km}
                  onChange={v => setField('radius_km', v)}
                />
              </div>
              <div style={{ marginTop: 16 }}>
                <ScreenMap
                  center={radiusCenter}
                  radius={form.radius_km}
                  screens={radiusScreens}
                  selected={form.selected_screen_ids}
                  onToggle={id => setForm(s => ({
                    ...s,
                    selected_screen_ids: s.selected_screen_ids.includes(id)
                      ? s.selected_screen_ids.filter(x => x !== id)
                      : [...s.selected_screen_ids, id],
                  }))}
                />
              </div>
            </div>
          )}
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

// ─── Step 2: Filters ──────────────────────────────────────────────────────────

function StepFilters({ form, setForm, reachSummary }) {
  const setField = (k, v) => setForm(s => ({ ...s, [k]: v }));
  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <Card style={{ padding: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: '0 0 4px' }}>Filter screens</h2>
        <p style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, margin: '0 0 24px' }}>Narrow down by type of venue. All optional.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 8 }}>Environment</div>
            <PillGroup
              options={[{ value: 'any', label: 'Any' }, { value: 'indoor', label: 'Indoor' }, { value: 'outdoor', label: 'Outdoor' }]}
              value={form.env_filter}
              onChange={v => setField('env_filter', v)}
            />
          </div>
          <div>
            <SelInput label="Venue Category" value={form.venue_filter} onChange={e => setField('venue_filter', e.target.value)}>
              <option value="">Any venue type</option>
              {Object.entries(VENUE_TAXONOMY).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </SelInput>
          </div>
        </div>

        {reachSummary && (
          <div style={{ marginTop: 20, padding: '10px 14px', background: C.purpleSoft, borderRadius: 8, fontSize: 13, color: C.purple, fontFamily: F.sans }}>
            {reachSummary}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Steps 3-7: Placeholders ─────────────────────────────────────────────────

function ScreenPickerCard({ screen, selected, onToggle }) {
  const firstPhoto = screen.screen_photos?.[0];
  const venueLabel = screen.venue_subtype || screen.venue_category;
  const isSelected = selected.includes(screen.id);

  return (
    <div
      onClick={() => onToggle(screen.id)}
      style={{
        border: `2px solid ${isSelected ? C.purple : C.border}`,
        borderRadius: 10, overflow: 'hidden', cursor: 'pointer',
        background: isSelected ? C.purpleSoft : C.surface,
        transition: 'all 0.15s', position: 'relative',
      }}
    >
      {firstPhoto && (
        <img src={firstPhoto} alt={screen.name} style={{ width: '100%', height: 72, objectFit: 'cover', display: 'block' }} />
      )}
      <div style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.sans, lineHeight: 1.3 }}>{screen.name}</div>
          <div style={{
            width: 18, height: 18, borderRadius: 4, border: `2px solid ${isSelected ? C.purple : C.border}`,
            background: isSelected ? C.purple : 'transparent', flexShrink: 0, marginLeft: 8, marginTop: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {isSelected && <span style={{ color: '#fff', fontSize: 11, lineHeight: 1 }}>✓</span>}
          </div>
        </div>
        <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 2 }}>
          {screen.city}{screen.environment ? ` · ${screen.environment === 'indoor' ? 'Indoor' : 'Outdoor'}` : ''}
        </div>
        {venueLabel && (
          <span style={{ display: 'inline-block', marginTop: 6, fontSize: 10, fontWeight: 600, background: C.blueSoft, color: C.blue, padding: '1px 7px', borderRadius: 10, fontFamily: F.sans }}>
            {venueLabel}
          </span>
        )}
        <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 4 }}>
          ~{screen.impressions > 0 ? `${(screen.impressions / 1000).toFixed(0)}K impr/mo` : 'No data yet'}
        </div>
      </div>
    </div>
  );
}

function StepScreens({ form, setForm, matchedScreens }) {
  const toggleScreen = (id) => setForm(s => ({
    ...s,
    selected_screen_ids: s.selected_screen_ids.includes(id)
      ? s.selected_screen_ids.filter(x => x !== id)
      : [...s.selected_screen_ids, id],
  }));

  const selectAll = () => setForm(s => ({ ...s, selected_screen_ids: matchedScreens.map(sc => sc.id) }));
  const deselectAll = () => setForm(s => ({ ...s, selected_screen_ids: [] }));

  const selectedCount = form.selected_screen_ids.length;
  const totalImpr = matchedScreens.filter(s => form.selected_screen_ids.includes(s.id)).reduce((a, s) => a + (s.impressions || 0), 0);

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <Card style={{ padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: 0 }}>Select screens</h2>
            <div style={{ fontSize: 12, color: C.purple, fontFamily: F.sans, marginTop: 4 }}>
              {selectedCount} of {matchedScreens.length} selected · ~{(totalImpr / 1000).toFixed(0)}K impressions/mo
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={selectAll} style={{ background: 'none', border: 'none', fontSize: 12, color: C.purple, cursor: 'pointer', fontFamily: F.sans }}>Select all</button>
            <button onClick={deselectAll} style={{ background: 'none', border: 'none', fontSize: 12, color: C.textMuted, cursor: 'pointer', fontFamily: F.sans }}>Deselect all</button>
          </div>
        </div>

        {matchedScreens.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 24px', color: C.textSub, fontFamily: F.sans, fontSize: 13 }}>
            No screens match your filters. Try widening your area or removing filters.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {matchedScreens.map(s => (
              <ScreenPickerCard key={s.id} screen={s} selected={form.selected_screen_ids} onToggle={toggleScreen} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function StepCreative({ form, setForm }) {
  const setField = (k, v) => setForm(s => ({ ...s, [k]: v }));
  const setOverride = (screenId, k, v) => setForm(s => ({
    ...s,
    per_screen_overrides: {
      ...s.per_screen_overrides,
      [screenId]: { ...(s.per_screen_overrides[screenId] || {}), [k]: v },
    },
  }));

  const previewCampaign = {
    headline: form.headline,
    cta_text: form.cta_text,
    accent_color: form.accent_color,
    destination_url: form.destination_url,
    category: form.category,
  };

  const selectedScreenIds = form.selected_screen_ids;

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <Card style={{ padding: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: '0 0 24px' }}>Create your ad</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 28 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Inp label="Headline" placeholder="e.g. Start Your Morning Right"
              value={form.headline} onChange={e => setField('headline', e.target.value)} />
            <Inp label="CTA Text" placeholder="e.g. Learn More"
              value={form.cta_text} onChange={e => setField('cta_text', e.target.value)} />
            <Inp label="Destination URL" placeholder="https://example.com" type="url"
              value={form.destination_url} onChange={e => setField('destination_url', e.target.value)} />
            <SelInput label="Category" value={form.category} onChange={e => setField('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </SelInput>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 6 }}>Accent Colour</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="color" value={form.accent_color} onChange={e => setField('accent_color', e.target.value)}
                  style={{ width: 40, height: 36, border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', padding: 2 }} />
                <span style={{ fontSize: 12, color: C.textSub, fontFamily: F.mono }}>{form.accent_color}</span>
              </div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textMid, fontFamily: F.sans, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Preview</div>
            <CreativePreview campaign={previewCampaign} />
          </div>
        </div>

        {selectedScreenIds.length > 0 && (
          <div style={{ marginTop: 24, borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>
            <button
              type="button"
              onClick={() => setField('show_overrides', !form.show_overrides)}
              style={{ background: 'none', border: 'none', fontSize: 13, color: C.purple, cursor: 'pointer', fontFamily: F.sans, padding: 0 }}
            >
              {form.show_overrides ? '▾' : '▸'} Customise creative per screen ({selectedScreenIds.length} screens)
            </button>
            {form.show_overrides && (
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans }}>Leave blank to use the campaign creative above.</div>
                {selectedScreenIds.map(screenId => {
                  const ov = form.per_screen_overrides[screenId] || {};
                  return (
                    <div key={screenId} style={{ padding: 16, background: C.surfaceAlt, borderRadius: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 12 }}>
                        Screen {screenId.slice(0, 8)}…
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <Inp label="Headline override" placeholder="Leave blank for default"
                          value={ov.headline || ''} onChange={e => setOverride(screenId, 'headline', e.target.value)} />
                        <Inp label="CTA override" placeholder="Leave blank for default"
                          value={ov.cta_text || ''} onChange={e => setOverride(screenId, 'cta_text', e.target.value)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function StepBudget({ form, setForm, matchedScreens }) {
  const setField = (k, v) => setForm(s => ({ ...s, [k]: v }));

  const days = form.start_date && form.end_date
    ? Math.max(1, Math.round((new Date(form.end_date) - new Date(form.start_date)) / (1000 * 60 * 60 * 24)))
    : 30;
  const totalImpr = matchedScreens.reduce((a, s) => a + (s.impressions || 0), 0);
  const budgetMin = Math.round((totalImpr / 1000) * 3 * (days / 30));
  const budgetMax = Math.round((totalImpr / 1000) * 8 * (days / 30));
  const budget = parseFloat(form.budget) || 0;
  const tooLow = budget > 0 && matchedScreens.length > 0 && days > 0
    && (budget / matchedScreens.length / days) < 0.50;

  return (
    <div style={{ maxWidth: 580, margin: '0 auto' }}>
      <Card style={{ padding: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: '0 0 24px' }}>Budget & Schedule</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 8 }}>Budget type</div>
            <PillGroup
              options={[{ value: 'total', label: 'Total budget' }, { value: 'daily', label: 'Daily limit' }]}
              value={form.budget_mode}
              onChange={v => setField('budget_mode', v)}
            />
          </div>

          <Inp
            label={form.budget_mode === 'daily' ? 'Daily limit (£)' : 'Total budget (£)'}
            type="number" step="1" placeholder="e.g. 200"
            value={form.budget} onChange={e => setField('budget', e.target.value)}
            hint={totalImpr > 0 && days > 0 ? `Suggested for ${matchedScreens.length} screens over ${days} days: £${budgetMin}–£${budgetMax}` : undefined}
          />

          {tooLow && (
            <div style={{ padding: '10px 14px', background: C.amberSoft, border: `1px solid ${C.amberBorder}`, borderRadius: 8, fontSize: 12, color: C.amber, fontFamily: F.sans }}>
              ⚠ Budget may be too low to run consistently across all selected screens. Consider increasing your budget or reducing screen count.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label="Start date" type="date" value={form.start_date} onChange={e => setField('start_date', e.target.value)} />
            <Inp label="End date" type="date" value={form.end_date} onChange={e => setField('end_date', e.target.value)} />
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 8 }}>Days of week</div>
            <PillGroup
              options={DAYS}
              value={form.schedule_days}
              onChange={v => setField('schedule_days', v)}
              multi={true}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label="From" type="time" value={form.time_start} onChange={e => setField('time_start', e.target.value)} />
            <Inp label="Until" type="time" value={form.time_end} onChange={e => setField('time_end', e.target.value)} />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <input type="checkbox" id="peak_hours" checked={form.peak_hours_preferred}
              onChange={e => setField('peak_hours_preferred', e.target.checked)}
              style={{ marginTop: 2, cursor: 'pointer' }}
            />
            <label htmlFor="peak_hours" style={{ fontSize: 13, color: C.text, fontFamily: F.sans, cursor: 'pointer' }}>
              <span style={{ fontWeight: 500 }}>Prioritise peak footfall periods</span>
              <span style={{ display: 'block', fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                Ad system will favour slots when screen CV data shows highest foot traffic.
              </span>
            </label>
          </div>
        </div>
      </Card>
    </div>
  );
}

function StepLaunch({ form, setForm }) {
  return <div style={{ padding: 32, textAlign: 'center', color: C.textSub, fontFamily: F.sans }}>Step 6 — Launch Preference (coming soon)</div>;
}

function StepReview({ form, matchedScreens, onSubmit, submitting, err }) {
  return <div style={{ padding: 32, textAlign: 'center', color: C.textSub, fontFamily: F.sans }}>Step 7 — Review & Submit (coming soon)</div>;
}

// ─── Main Wizard ─────────────────────────────────────────────────────────────

export function CreateCampaign({ onSave, onCancel, dbScreens = [], campaigns = [] }) {
  const { user, profile } = useAuth();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState(null);
  const [showDupModal, setShowDupModal] = useState(false);

  const [form, setForm] = useState({
    area_type: 'city',
    country: 'CA',
    state: '',
    city: '',
    radius_center: '',
    radius_center_lat: null,
    radius_center_lon: null,
    radius_km: 10,
    env_filter: 'any',
    venue_filter: '',
    selected_screen_ids: [],
    headline: '',
    cta_text: '',
    destination_url: '',
    accent_color: '#7c3aed',
    category: 'Food & Beverage',
    per_screen_overrides: {},
    show_overrides: false,
    budget_mode: 'total',
    budget: '',
    start_date: '',
    end_date: '',
    schedule_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    time_start: '07:00',
    time_end: '22:00',
    peak_hours_preferred: false,
    start_when: 'partial',
  });

  // Screen matching
  const matchedScreens = (() => {
    let screens = dbScreens.filter(s => s.status !== 'inactive');
    if (form.area_type === 'country') {
      screens = screens.filter(s => s.country === form.country);
    } else if (form.area_type === 'state') {
      screens = screens.filter(s => s.country === form.country && s.state?.toLowerCase() === form.state.toLowerCase());
    } else if (form.area_type === 'city') {
      screens = screens.filter(s => s.city?.toLowerCase() === form.city.toLowerCase());
    } else if (form.area_type === 'radius') {
      const lat = form.radius_center_lat;
      const lon = form.radius_center_lon;
      if (lat && lon) {
        screens = screens.filter(s => {
          if (s.lat == null || s.lon == null) return false;
          return haversine(lat, lon, s.lat, s.lon) <= form.radius_km;
        });
      }
    }
    if (form.env_filter !== 'any') screens = screens.filter(s => s.environment === form.env_filter);
    if (form.venue_filter) screens = screens.filter(s => s.venue_category === form.venue_filter);
    return screens;
  })();

  // Auto-select all matched screens when the matched set changes
  const matchedKey = matchedScreens.map(s => s.id).join(',');
  useEffect(() => {
    setForm(s => ({ ...s, selected_screen_ids: matchedScreens.map(sc => sc.id) }));
  }, [matchedKey]);

  const selectedScreens = matchedScreens.filter(s => form.selected_screen_ids.includes(s.id));
  const totalImpressions = selectedScreens.reduce((a, s) => a + (s.impressions || 0), 0);

  const reachSummary = matchedScreens.length > 0
    ? `~${matchedScreens.length} screen${matchedScreens.length !== 1 ? 's' : ''} · ~${(totalImpressions / 1000).toFixed(0)}K impressions/mo estimated`
    : form.area_type === 'radius' && !form.radius_center_lat
    ? 'Enter a center location to see matching screens'
    : 'No screens match — try widening your area or removing filters';

  const next = () => setStep(s => Math.min(s + 1, STEP_LABELS.length - 1));
  const back = () => setStep(s => Math.max(s - 1, 0));

  const loadDuplicate = (c) => {
    setForm(s => ({
      ...s,
      headline: c.headline || '',
      cta_text: c.cta_text || c.cta || '',
      destination_url: c.destination_url || c.destination || '',
      accent_color: c.accent_color || c.color || '#7c3aed',
      category: c.category || 'Food & Beverage',
      budget: String(c.budget || ''),
      budget_mode: c.budget_mode || 'total',
      start_date: '',
      end_date: '',
      schedule_days: c.schedule_days || c.days || ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
      time_start: c.time_start || c.timeStart || '07:00',
      time_end: c.time_end || c.timeEnd || '22:00',
      peak_hours_preferred: c.peak_hours_preferred || false,
      start_when: c.start_when || 'partial',
    }));
    setShowDupModal(false);
  };

  const handleSubmit = async () => {
    setSubmitErr('Submit not yet implemented — coming in Task 7');
  };

  return (
    <div>
      <PageHeader title="New Campaign" back="Overview" onBack={onCancel} />
      <Stepper step={step} onCancel={onCancel} />

      {showDupModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <Card style={{ padding: 28, width: '100%', maxWidth: 480, maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: F.sans, marginBottom: 16 }}>Start from a previous campaign</div>
            {campaigns.length === 0 ? (
              <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans }}>No previous campaigns found.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {campaigns.map(c => (
                  <button key={c.id} onClick={() => loadDuplicate(c)} style={{
                    background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8,
                    padding: '12px 16px', cursor: 'pointer', textAlign: 'left',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.sans }}>{c.headline || c.advertiser}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 2 }}>{c.city} · £{c.budget}</div>
                  </button>
                ))}
              </div>
            )}
            <Btn variant="secondary" onClick={() => setShowDupModal(false)} style={{ width: '100%', marginTop: 16 }}>Cancel</Btn>
          </Card>
        </div>
      )}

      {step === 0 && <StepArea form={form} setForm={setForm} reachSummary={reachSummary} allScreens={dbScreens} onPrevCampaigns={campaigns.length > 0 ? () => setShowDupModal(true) : null} />}
      {step === 1 && <StepFilters form={form} setForm={setForm} reachSummary={reachSummary} />}
      {step === 2 && <StepScreens form={form} setForm={setForm} matchedScreens={matchedScreens} />}
      {step === 3 && <StepCreative form={form} setForm={setForm} />}
      {step === 4 && <StepBudget form={form} setForm={setForm} matchedScreens={selectedScreens} />}
      {step === 5 && <StepLaunch form={form} setForm={setForm} />}
      {step === 6 && <StepReview form={form} matchedScreens={selectedScreens} onSubmit={handleSubmit} submitting={submitting} err={submitErr} />}

      {step < 6 && (
        <div style={{ maxWidth: 620, margin: '20px auto 0', display: 'flex', gap: 10 }}>
          {step > 0 && <Btn variant="secondary" onClick={back} style={{ flex: 1 }}>← Back</Btn>}
          <Btn onClick={next} style={{ flex: 1 }}
            disabled={
              (step === 0 && form.area_type === 'radius' && !form.radius_center_lat) ||
              (step === 2 && form.selected_screen_ids.length === 0)
            }
          >
            {step === 1 ? 'See screens →' : step === 5 ? 'Review →' : 'Next →'}
          </Btn>
        </div>
      )}
    </div>
  );
}
