// src/views/advertiser/createCampaign/StepCreative.jsx
import { useState, useMemo } from 'react';
import { C, F, T } from '../../../design/tokens.js';
import { TX } from '../../../design/text.js';
import { Card } from '../../../components/primitives/Card.jsx';
import { SelInput } from '../../../components/primitives/SelInput.jsx';
import { PillGroup } from './PillGroup.jsx';
import { ScreenPickerCard } from './ScreenPickerCard.jsx';
import { CreativeCard } from './CreativeCard.jsx';
import { unassignedScreenIds, splitScreenIdsByOrientation, makeBlankCreative } from '../../../lib/creativeAssignment.js';
import { VENUE_TAXONOMY } from '../../../lib/venueTypes.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useAdvertiserScreenFavorites } from '../../../hooks/useAdvertiserScreenFavorites.js';
import { useAdvertiserRecentScreens } from '../../../hooks/useAdvertiserRecentScreens.js';
import { useT } from '../../../i18n/useT.js';

const BLANK_CREATIVE = makeBlankCreative;

export function StepCreative({ form, setForm, matchedScreens, presetScreenUnavailable = false, houseAdMode = false }) {
  const { t, formatNumber } = useT();
  const [showFilters, setShowFilters] = useState(false);
  const [screenTab, setScreenTab] = useState('all');
  const { user } = useAuth();
  const { favoriteIds, toggleFavorite } = useAdvertiserScreenFavorites(user?.id);
  const { screenIds: recentScreenIds } = useAdvertiserRecentScreens(user?.id);

  const toggleScreen = (id) => setForm(s => ({
    ...s,
    selected_screen_ids: s.selected_screen_ids.includes(id)
      ? s.selected_screen_ids.filter(x => x !== id)
      : [...s.selected_screen_ids, id],
  }));
  const selectAll = () => setForm(s => ({ ...s, selected_screen_ids: matchedScreens.map(sc => sc.id) }));
  const deselectAll = () => setForm(s => ({ ...s, selected_screen_ids: [] }));

  // Favorites/Recent only ever narrow matchedScreens (still respecting the
  // targeting filters above) -- a favorited screen that's fallen out of the
  // current area/venue filters shouldn't reappear here.
  const favoriteScreens = useMemo(
    () => matchedScreens.filter(s => favoriteIds.has(s.id)),
    [matchedScreens, favoriteIds]
  );
  const recentScreens = useMemo(() => {
    const byId = new Map(matchedScreens.map(s => [s.id, s]));
    return recentScreenIds.map(id => byId.get(id)).filter(Boolean);
  }, [matchedScreens, recentScreenIds]);

  const visibleScreens = screenTab === 'favorites' ? favoriteScreens
    : screenTab === 'recent' ? recentScreens
    : matchedScreens;

  const selectedScreens = matchedScreens.filter(s => form.selected_screen_ids.includes(s.id));
  const totalImpr = selectedScreens.reduce((a, s) => a + (s.impressions || 0), 0);

  const creatives = form.creatives.length > 0 ? form.creatives : [BLANK_CREATIVE()];
  const isMulti = creatives.length > 1;

  // When form.creatives is still empty, the rendered `creatives` array above is a
  // locally-generated placeholder (fresh id every render) -- there's no id to match
  // against inside setForm's updater, so the first edit must seed state directly
  // rather than trying to find-and-replace by id.
  const updateCreative = (id, next) => setForm(s => ({
    ...s,
    creatives: s.creatives.length > 0 ? s.creatives.map(c => c.id === id ? next : c) : [next],
  }));

  const addCreative = () => setForm(s => {
    const base = s.creatives.length > 0 ? s.creatives : [BLANK_CREATIVE()];
    return { ...s, creatives: [...base, { ...BLANK_CREATIVE(), assigned_screen_ids: [] }] };
  });

  const removeCreative = (id) => setForm(s => {
    const remaining = s.creatives.filter(c => c.id !== id);
    // Dropping back to exactly one creative means assignment no longer
    // matters -- clear it so the simple (no campaign_creative_screens rows)
    // submit path applies again.
    return { ...s, creatives: remaining.length === 1 ? [{ ...remaining[0], assigned_screen_ids: [] }] : remaining };
  });

  const splitByType = (id) => setForm(s => {
    const base = s.creatives;
    const target = base.find(c => c.id === id);
    if (!target) return s;
    const other = base.find(c => c.id !== id);
    // Scope the split to screens this pair can actually claim -- the two
    // creatives' own current assignments plus whatever's still unassigned.
    // Splitting against the *entire* selected pool would sweep in screens a
    // third (or later) creative already owns, silently double-assigning
    // them into this pair and overwriting that creative's manual work.
    const pool = new Set([
      ...target.assigned_screen_ids,
      ...(other ? other.assigned_screen_ids : []),
      ...unassignedScreenIds(s.selected_screen_ids, base),
    ]);
    const { landscape, portrait } = splitScreenIdsByOrientation(matchedScreens, [...pool]);
    // This creative takes landscape, the first other creative takes portrait
    // -- a starting point the advertiser can hand-adjust afterward, not a
    // permanent rule.
    return {
      ...s,
      creatives: base.map(c => {
        if (c.id === id) return { ...c, assigned_screen_ids: landscape };
        if (other && c.id === other.id) return { ...c, assigned_screen_ids: portrait };
        return c;
      }),
    };
  });

  const unassigned = isMulti ? unassignedScreenIds(form.selected_screen_ids, creatives) : [];

  const creativeForScreen = (screenId) => {
    if (!isMulti) return creatives[0];
    return creatives.find(c => c.assigned_screen_ids.includes(screenId)) ?? creatives[0];
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <Card style={{ padding: 28 }}>
        <button
          onClick={() => setShowFilters(f => !f)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
            background: showFilters ? C.purpleSoft : C.surface,
            color: showFilters ? C.purple : C.textSub,
            fontSize: T.sm, fontWeight: 500, fontFamily: F.sans,
            cursor: 'pointer', transition: 'all 0.15s', marginBottom: 12,
          }}
          onMouseEnter={e => { if (!showFilters) e.currentTarget.style.background = C.surfaceAlt; }}
          onMouseLeave={e => { if (!showFilters) e.currentTarget.style.background = C.surface; }}
        >
          {t('create.creativeStep.refine')} {showFilters ? '▲' : '▼'}
        </button>
        {showFilters && (
          <div style={{ marginBottom: 16, padding: 16, background: C.surfaceAlt, borderRadius: 10, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ ...TX.helperMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>{t('create.targeting.environment')}</div>
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
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: T.lg, fontWeight: 700, color: C.text, fontFamily: F.display, margin: 0 }}>{t('create.creativeStep.screens')}</h2>
            <div style={{ fontSize: T.sm, color: C.purple, fontFamily: F.sans, marginTop: 4 }}>
              {t('create.creativeStep.selectedSummary', { selected: form.selected_screen_ids.length, total: matchedScreens.length, k: formatNumber(Math.round(totalImpr / 1000)) })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={selectAll} style={{ background: 'none', border: 'none', fontSize: T.sm, color: C.purple, cursor: 'pointer', fontFamily: F.sans, transition: 'opacity 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.75'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
            >{t('create.creativeStep.selectAll')}</button>
            <button onClick={deselectAll} style={{ ...TX.helperMuted, background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.color = C.text; }}
              onMouseLeave={e => { e.currentTarget.style.color = C.textMuted; }}
            >{t('create.creativeStep.deselectAll')}</button>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <PillGroup
            options={[
              { value: 'all', label: t('create.creativeStep.tabAll', { count: matchedScreens.length }) },
              { value: 'favorites', label: t('create.creativeStep.tabFavorites', { count: favoriteScreens.length }) },
              { value: 'recent', label: t('create.creativeStep.tabRecent', { count: recentScreens.length }) },
            ]}
            value={screenTab}
            onChange={setScreenTab}
          />
        </div>

        {visibleScreens.length === 0 ? (
          <div style={{ ...TX.bodySub, textAlign: 'center', padding: '32px 24px' }}>
            {screenTab === 'favorites'
              ? t('create.creativeStep.emptyFavorites')
              : screenTab === 'recent'
              ? t('create.creativeStep.emptyRecent')
              : presetScreenUnavailable
              ? t('create.creativeStep.presetUnavailable')
              : t('create.creativeStep.noMatch')}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 28 }}>
            {visibleScreens.map(s => (
              <ScreenPickerCard
                key={s.id}
                screen={s}
                selected={form.selected_screen_ids}
                onToggle={toggleScreen}
                creative={creativeForScreen(s.id)}
                isFavorited={favoriteIds.has(s.id)}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        )}

        <h2 style={{ fontSize: T.lg, fontWeight: 700, color: C.text, fontFamily: F.display, margin: '0 0 16px' }}>{isMulti ? t('create.creativeStep.creatives') : t('create.creativeStep.creative')}</h2>

        {unassigned.length > 0 && (
          <div style={{ marginBottom: 16, padding: '10px 14px', background: C.amberSoft, border: `1px solid ${C.amberBorder}`, borderRadius: 8, fontSize: T.sm, color: C.amberText, fontFamily: F.sans }}>
            {t('create.creativeStep.unassigned', {
              count: unassigned.length,
              total: form.selected_screen_ids.length,
              screens: t('create.creativeStep.screenWord', { count: form.selected_screen_ids.length }),
            })}
          </div>
        )}

        {creatives.map((c) => (
          <CreativeCard
            key={c.id}
            creative={c}
            onChange={(next) => updateCreative(c.id, next)}
            onRemove={isMulti ? () => removeCreative(c.id) : undefined}
            poolScreens={selectedScreens}
            allCreatives={creatives}
            showAssignment={isMulti}
            onSplitByType={() => splitByType(c.id)}
          />
        ))}

        {!houseAdMode && (
          <button type="button" onClick={addCreative} style={{
            background: 'none', border: `1px dashed ${C.border}`, borderRadius: 10, padding: '12px 16px',
            fontSize: T.base, color: C.purple, cursor: 'pointer', fontFamily: F.sans, width: '100%', transition: 'background 0.15s, border-color 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = C.purpleSoft; e.currentTarget.style.borderColor = C.purple; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = C.border; }}
          >
            {t('create.creativeStep.addCreative')}
          </button>
        )}
      </Card>
    </div>
  );
}
