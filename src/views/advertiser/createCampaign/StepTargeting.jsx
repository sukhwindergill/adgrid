// src/views/advertiser/createCampaign/StepTargeting.jsx
import { useMemo, useEffect } from 'react';
import { C, F } from '../../../design/tokens.js';
import { Card } from '../../../components/primitives/Card.jsx';
import { Inp } from '../../../components/primitives/Inp.jsx';
import { SelInput } from '../../../components/primitives/SelInput.jsx';
import { VENUE_TAXONOMY, COUNTRIES } from '../../../lib/venueTypes.js';
import { buildLocationIndex, distinctCountries, distinctStates } from '../../../lib/locationIndex.js';
import { PillGroup } from './PillGroup.jsx';
import { LocationSearch } from './LocationSearch.jsx';
import { ScreenMap } from './ScreenMap.jsx';

const countryLabel = code => COUNTRIES.find(c => c.code === code)?.label ?? code;

export function StepTargeting({ form, setForm, reachSummary, allScreens, screensLoading = false, onPrevCampaigns, existingCampaign = null }) {
  const setField = (k, v) => setForm(s => ({ ...s, [k]: v }));

  // allScreens.length === 0 is ambiguous by itself -- true both while the
  // initial fetch is still in flight AND once it resolves to "zero live
  // screens right now" (a real state for a young, thin marketplace, not a
  // hypothetical). screensLoading is App.jsx's actual dataLoading flag,
  // threaded down through CreateCampaign, so this can tell the two apart
  // instead of showing a "Loading…" placeholder that never resolves when
  // inventory is genuinely empty.
  const loading = screensLoading;
  const noInventory = !screensLoading && allScreens.length === 0;
  const locationIndex = useMemo(() => buildLocationIndex(allScreens), [allScreens]);
  const countryOptions = useMemo(() => distinctCountries(locationIndex), [locationIndex]);
  const stateOptions = useMemo(() => distinctStates(locationIndex, form.country), [locationIndex, form.country]);
  // Radius mode can only center on a city with at least one geocoded screen —
  // a city index entry with no coordinates has nothing to average into a
  // centroid, so it's excluded here rather than offered and then failing silently.
  const radiusLocations = useMemo(() => locationIndex.filter(e => e.hasCoords), [locationIndex]);

  // Memoized so ScreenMap's effect (which recreates the draggable center
  // marker and radius circle) only re-runs when these values actually
  // change, not on every StepTargeting re-render — an inline array literal
  // or unmemoized filter here would get a fresh reference every render and
  // interrupt an in-progress pin drag on an unrelated state update
  // elsewhere in this component (e.g. typing the campaign name).
  const radiusScreens = useMemo(() => allScreens.filter(s => s.lat != null && s.lon != null), [allScreens]);
  const radiusCenter = useMemo(
    () => [form.radius_center_lat, form.radius_center_lon],
    [form.radius_center_lat, form.radius_center_lon]
  );
  const radiusResolved = form.area_type === 'radius' && form.radius_center_lat != null && form.radius_center_lon != null;

  useEffect(() => {
    if (loading || countryOptions.length === 0) return;
    if (!countryOptions.includes(form.country)) {
      setField('country', countryOptions[0]);
    }
    // Only re-check when the available options actually change (inventory
    // loads / changes) or when country itself changes — not on every
    // keystroke elsewhere in the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, countryOptions, form.country]);

  return (
    <div style={{ maxWidth: 620, margin: '0 auto' }}>
      <Card style={{ padding: 32 }}>
        {existingCampaign ? (
          <div style={{ marginBottom: 24, padding: '10px 14px', background: C.purpleSoft, borderRadius: 8, fontSize: 13, color: C.purple, fontFamily: F.sans }}>
            Adding a new targeting group to <strong>{existingCampaign.name}</strong>
          </div>
        ) : (
          <div style={{ marginBottom: 24 }}>
            <Inp
              label="Campaign name"
              placeholder="e.g. Summer Promo 2026"
              value={form.name}
              onChange={e => setField('name', e.target.value)}
            />
          </div>
        )}

        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: '0 0 4px' }}>Where do you want to advertise?</h2>
        <p style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, margin: '0 0 20px' }}>Choose an area and, optionally, the kind of screens you're after — we'll find matching screens for you.</p>

        {noInventory && (
          <div style={{ marginBottom: 20, padding: '10px 14px', background: C.amberSoft, border: `1px solid ${C.amberBorder ?? '#fde68a'}`, borderRadius: 8, fontSize: 13, color: '#92400e', fontFamily: F.sans }}>
            No screens are live on the network yet — check back soon.
          </div>
        )}

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
          <SelInput label="Country" value={form.country} disabled={loading} onChange={e => setForm(s => ({ ...s, country: e.target.value, radius_center_lat: null, radius_center_lon: null }))}>
            {countryOptions.length > 0
              ? countryOptions.map(code => <option key={code} value={code}>{countryLabel(code)}</option>)
              : <option value={form.country}>{loading ? 'Loading…' : noInventory ? 'No screens yet' : countryLabel(form.country)}</option>}
          </SelInput>

          {(form.area_type === 'state' || form.area_type === 'city' || form.area_type === 'radius') && (
            <SelInput label="State / Province" value={form.state} disabled={loading} onChange={e => setForm(s => ({ ...s, state: e.target.value, radius_center_lat: null, radius_center_lon: null }))}>
              <option value="">Select…</option>
              {stateOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </SelInput>
          )}

          {form.area_type === 'city' && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 5 }}>City</div>
              <LocationSearch
                locations={locationIndex}
                scopeCountry={form.country}
                scopeState={form.state || undefined}
                value={form.city}
                loading={loading}
                placeholder="Search a city…"
                onSelect={entry => setForm(s => ({ ...s, country: entry.country, state: entry.state, city: entry.city, radius_center_lat: null, radius_center_lon: null }))}
              />
            </div>
          )}

          {form.area_type === 'radius' && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 5 }}>City</div>
              <LocationSearch
                locations={radiusLocations}
                value={form.city}
                loading={loading}
                placeholder="Search a city to center the radius on…"
                onSelect={entry => setForm(s => ({
                  ...s,
                  country: entry.country,
                  state: entry.state,
                  city: entry.city,
                  radius_center_lat: entry.centroidLat,
                  radius_center_lon: entry.centroidLon,
                }))}
              />
              {radiusResolved && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 8 }}>
                    Radius: {form.radius_km} km — drag the pin to narrow to a specific part of {form.city}
                  </div>
                  <PillGroup
                    options={[5, 10, 25, 50, 100].map(v => ({ value: v, label: `${v}km` }))}
                    value={form.radius_km}
                    onChange={v => setField('radius_km', v)}
                  />
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
                      draggableCenter
                      onCenterChange={({ lat, lon }) => setForm(s => ({ ...s, radius_center_lat: lat, radius_center_lon: lon }))}
                    />
                  </div>
                </div>
              )}
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
