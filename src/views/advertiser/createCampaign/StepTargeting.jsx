// src/views/advertiser/createCampaign/StepTargeting.jsx
import { useEffect, useMemo, useRef } from 'react';
import { C, F } from '../../../design/tokens.js';
import { Card } from '../../../components/primitives/Card.jsx';
import { Inp } from '../../../components/primitives/Inp.jsx';
import { SelInput } from '../../../components/primitives/SelInput.jsx';
import { VENUE_TAXONOMY } from '../../../lib/venueTypes.js';
import { buildLocationIndex, buildFlatLocationOptions } from '../../../lib/locationIndex.js';
import { supabase } from '../../../lib/supabase.js';
import { logDemandSignal } from '../../../lib/demandSignal.js';
import { PillGroup } from './PillGroup.jsx';
import { LocationSearch } from './LocationSearch.jsx';
import { ScreenMap } from './ScreenMap.jsx';
import { TopScreensInsight } from './TopScreensInsight.jsx';
import { SavedAudiencesBar } from './SavedAudiencesBar.jsx';
import { useT } from '../../../i18n/useT.js';

export function StepTargeting({ form, setForm, reachSummary, matchedScreenCount, allScreens, screensLoading = false, onPrevCampaigns, existingCampaign = null, pastCampaignIds = [] }) {
  const { t, tx, regionName } = useT();
  const setField = (k, v) => setForm(s => ({ ...s, [k]: v }));

  // Log this search as a demand signal for the operator side's cold-start
  // widget (ScreenOnboard.jsx) once city + venue category both settle —
  // debounced so typing doesn't fire an insert per keystroke, and
  // deduplicated per combo so re-visiting this step without changing
  // anything doesn't inflate the count.
  const loggedCombosRef = useRef(new Set());
  const city = form.city || form.state;
  useEffect(() => {
    if (!city || !form.venue_filter) return;
    const combo = `${city}::${form.venue_filter}`;
    if (loggedCombosRef.current.has(combo)) return;
    const timer = setTimeout(() => {
      loggedCombosRef.current.add(combo);
      logDemandSignal(supabase, { city, venueCategory: form.venue_filter });
    }, 1500);
    return () => clearTimeout(timer);
  }, [city, form.venue_filter]);

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
  const flatLocationOptions = useMemo(() => buildFlatLocationOptions(locationIndex), [locationIndex]);
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

  return (
    <div style={{ maxWidth: 620, margin: '0 auto' }}>
      <Card style={{ padding: 32 }}>
        {existingCampaign ? (
          <div style={{ marginBottom: 24, padding: '10px 14px', background: C.purpleSoft, borderRadius: 8, fontSize: 13, color: C.purple, fontFamily: F.sans }}>
            {tx('create.targeting.addingGroup', { b: chunk => <strong>{chunk}</strong>, name: existingCampaign.name })}
          </div>
        ) : (
          <div style={{ marginBottom: 24 }}>
            <Inp
              label={t('create.targeting.campaignName')}
              placeholder={t('create.targeting.campaignNamePlaceholder')}
              value={form.name}
              onChange={e => setField('name', e.target.value)}
            />
          </div>
        )}

        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: F.display, margin: '0 0 4px' }}>{t('create.targeting.heading')}</h2>
        <p style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, margin: '0 0 20px' }}>{t('create.targeting.sub')}</p>

        {noInventory && (
          <div style={{ marginBottom: 20, padding: '10px 14px', background: C.amberSoft, border: `1px solid ${C.amberBorder ?? '#fde68a'}`, borderRadius: 8, fontSize: 13, color: C.amber, fontFamily: F.sans }}>
            {t('create.targeting.noInventory')}
          </div>
        )}

        {onPrevCampaigns && (
          <div style={{ marginBottom: 20 }}>
            <button onClick={onPrevCampaigns} style={{ background: 'none', border: 'none', fontSize: 12, color: C.purple, cursor: 'pointer', fontFamily: F.sans, padding: 0, transition: 'opacity 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.75'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
            >
              {t('create.targeting.fromPrevious')}
            </button>
          </div>
        )}

        <SavedAudiencesBar form={form} onApply={fields => setForm(s => ({ ...s, ...fields }))} />

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 8 }}>{t('create.targeting.areaType')}</div>
          <PillGroup
            options={[
              { value: 'location', label: t('create.targeting.areaLocation') },
              { value: 'radius',   label: t('create.targeting.areaRadius') },
            ]}
            value={form.area_type === 'radius' ? 'radius' : 'location'}
            onChange={v => setField('area_type', v === 'radius' ? 'radius' : (form.city ? 'city' : form.state ? 'state' : 'country'))}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {form.area_type !== 'radius' && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 5 }}>{t('create.targeting.where')}</div>
              <LocationSearch
                options={flatLocationOptions}
                value={form.city || form.state || (form.country ? regionName(form.country) : '')}
                loading={loading}
                placeholder={loading ? t('common.loading') : noInventory ? t('create.targeting.noScreensYet') : t('create.location.placeholder')}
                onSelect={entry => setForm(s => ({
                  ...s,
                  area_type: entry.level,
                  country: entry.country,
                  state: entry.level === 'country' ? '' : entry.state ?? '',
                  city: entry.level === 'city' ? entry.city : '',
                  radius_center_lat: null,
                  radius_center_lon: null,
                }))}
              />
            </div>
          )}

          {form.area_type === 'radius' && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 5 }}>{t('create.targeting.city')}</div>
              <LocationSearch
                options={radiusLocations.map(e => ({ level: 'city', ...e }))}
                value={form.city}
                loading={loading}
                placeholder={t('create.targeting.radiusPlaceholder')}
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
                    {t('create.targeting.radiusLabel', { km: form.radius_km, city: form.city })}
                  </div>
                  <PillGroup
                    options={[5, 10, 25, 50, 100].map(v => ({ value: v, label: t('create.targeting.km', { n: v }) }))}
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
            {t('create.targeting.screenType')} <span style={{ color: C.textMuted, fontWeight: 400 }}>{t('common.optional')}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, fontFamily: F.sans, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>{t('create.targeting.environment')}</div>
              <PillGroup
                options={[{ value: 'any', label: t('common.env.any') }, { value: 'indoor', label: t('common.env.indoor') }, { value: 'outdoor', label: t('common.env.outdoor') }]}
                value={form.env_filter}
                onChange={v => setForm(s => ({ ...s, env_filter: v }))}
              />
            </div>
            <SelInput label={t('create.targeting.venueCategory')} value={form.venue_filter} onChange={e => setForm(s => ({ ...s, venue_filter: e.target.value }))}>
              <option value="">{t('create.targeting.anyVenue')}</option>
              {Object.keys(VENUE_TAXONOMY).map(key => (
                <option key={key} value={key}>{t(`venue.category.${key}`)}</option>
              ))}
            </SelInput>
          </div>

          <TopScreensInsight
            pastCampaignIds={pastCampaignIds}
            allScreens={allScreens}
            currentVenueFilter={form.venue_filter}
            currentEnvFilter={form.env_filter}
            onApply={profile => setForm(s => ({ ...s, venue_filter: profile.venue_category, env_filter: profile.environment }))}
          />
        </div>

        {reachSummary && (
          <div style={{ marginTop: 16, padding: '10px 14px', background: C.purpleSoft, borderRadius: 8, fontSize: 13, color: C.purple, fontFamily: F.sans }}>
            {reachSummary}
          </div>
        )}

        {matchedScreenCount >= 10 && (
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 12,
            padding: '10px 14px', border: `1px solid ${C.border}`, borderRadius: 8, cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={form.holdout_enabled}
              onChange={e => setForm(s => ({ ...s, holdout_enabled: e.target.checked }))}
              style={{ marginTop: 2 }}
            />
            <span style={{ fontSize: 13, color: C.text, fontFamily: F.sans }}>
              {tx('create.targeting.holdout', { b: chunk => <strong>{chunk}</strong> })}
            </span>
          </label>
        )}
      </Card>
    </div>
  );
}
