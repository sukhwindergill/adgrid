// src/views/advertiser/createCampaign/StepTargeting.jsx
import { useState } from 'react';
import { C, F } from '../../../design/tokens.js';
import { Card } from '../../../components/primitives/Card.jsx';
import { Inp } from '../../../components/primitives/Inp.jsx';
import { SelInput } from '../../../components/primitives/SelInput.jsx';
import { VENUE_TAXONOMY, COUNTRIES } from '../../../lib/venueTypes.js';
import { PillGroup } from './PillGroup.jsx';
import { ScreenMap } from './ScreenMap.jsx';

const CITY_CENTERS = {
  'Toronto':      [43.6532,  -79.3832],
  'Vancouver':    [49.2827, -123.1207],
  'Montreal':     [45.5017,  -73.5673],
  'Calgary':      [51.0447, -114.0719],
  'Ottawa':       [45.4215,  -75.6972],
  'Edmonton':     [53.5461, -113.4938],
  'Winnipeg':     [49.8951,  -97.1384],
  'Quebec City':  [46.8139,  -71.2080],
  'Hamilton':     [43.2557,  -79.8711],
  'Kitchener':    [43.4516,  -80.4925],
};

export function StepTargeting({ form, setForm, reachSummary, allScreens, onPrevCampaigns }) {
  const [geocoding, setGeocoding] = useState(false);

  const setField = (k, v) => setForm(s => ({ ...s, [k]: v }));

  const geocodeCenter = async (query) => {
    if (!query.trim()) return;
    // Fast path: known city
    if (CITY_CENTERS[query]) {
      setForm(s => ({ ...s, radius_center_lat: CITY_CENTERS[query][0], radius_center_lon: CITY_CENTERS[query][1] }));
      return;
    }
    setGeocoding(true);
    try {
      const token = import.meta.env.VITE_MAPBOX_TOKEN;
      if (!token) throw new Error('VITE_MAPBOX_TOKEN not set');
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?country=ca&limit=1&access_token=${token}`
      );
      const data = await res.json();
      const feature = data.features?.[0];
      if (feature) {
        // Mapbox returns [longitude, latitude] — reversed vs Nominatim
        const [lon, lat] = feature.center;
        setForm(s => ({ ...s, radius_center_lat: lat, radius_center_lon: lon }));
      }
    } catch {
      // leave center unchanged — CITY_CENTERS fast path already handles known cities
    }
    setGeocoding(false);
  };

  const radiusCenter = form.radius_center_lat && form.radius_center_lon
    ? [form.radius_center_lat, form.radius_center_lon]
    : CITY_CENTERS['Toronto'];

  const radiusScreens = allScreens.filter(s => s.lat != null && s.lon != null);

  return (
    <div style={{ maxWidth: 620, margin: '0 auto' }}>
      <Card style={{ padding: 32 }}>
        <div style={{ marginBottom: 24 }}>
          <Inp
            label="Campaign name"
            placeholder="e.g. Summer Promo 2026"
            value={form.name}
            onChange={e => setField('name', e.target.value)}
          />
        </div>

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
