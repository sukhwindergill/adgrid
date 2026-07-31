// src/views/advertiser/createCampaign/StepCreative.jsx
import { useState } from 'react';
import { C, F } from '../../../design/tokens.js';
import { Card } from '../../../components/primitives/Card.jsx';
import { SelInput } from '../../../components/primitives/SelInput.jsx';
import { PillGroup } from './PillGroup.jsx';
import { ScreenPickerCard } from './ScreenPickerCard.jsx';
import { CreativeCard } from './CreativeCard.jsx';
import { unassignedScreenIds, splitScreenIdsByOrientation } from '../../../lib/creativeAssignment.js';
import { VENUE_TAXONOMY } from '../../../lib/venueTypes.js';

const BLANK_CREATIVE = () => ({
  id: crypto.randomUUID(),
  label: '',
  headline: '', cta_text: '', destination_url: '', accent_color: '#7c3aed', category: 'Food & Beverage',
  media_url: '', media_type: '', media_width: null, media_height: null,
  creative_template: 'bottom_bar', secondary_color: '',
  assigned_screen_ids: [],
  weight: 100,
});

export function StepCreative({ form, setForm, matchedScreens, profile }) {
  const [showFilters, setShowFilters] = useState(false);

  const toggleScreen = (id) => setForm(s => ({
    ...s,
    selected_screen_ids: s.selected_screen_ids.includes(id)
      ? s.selected_screen_ids.filter(x => x !== id)
      : [...s.selected_screen_ids, id],
  }));
  const selectAll = () => setForm(s => ({ ...s, selected_screen_ids: matchedScreens.map(sc => sc.id) }));
  const deselectAll = () => setForm(s => ({ ...s, selected_screen_ids: [] }));

  const selectedScreens = matchedScreens.filter(s => form.selected_screen_ids.includes(s.id));
  const totalImpr = selectedScreens.reduce((a, s) => a + (s.impressions || 0), 0);

  const creatives = form.creatives.length > 0 ? form.creatives : [BLANK_CREATIVE()];
  const isMulti = creatives.length > 1;

  const updateCreative = (id, next) => setForm(s => ({
    ...s,
    creatives: (s.creatives.length > 0 ? s.creatives : [BLANK_CREATIVE()]).map(c => c.id === id ? next : c),
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
    const { landscape, portrait } = splitScreenIdsByOrientation(matchedScreens, form.selected_screen_ids);
    // This creative takes landscape, the first other creative takes portrait
    // -- a starting point the advertiser can hand-adjust afterward, not a
    // permanent rule.
    const other = base.find(c => c.id !== id);
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
            fontSize: 12, fontWeight: 500, fontFamily: F.sans,
            cursor: 'pointer', transition: 'all 0.15s', marginBottom: 12,
          }}
        >
          Refine screens {showFilters ? '▲' : '▼'}
        </button>
        {showFilters && (
          <div style={{ marginBottom: 16, padding: 16, background: C.surfaceAlt, borderRadius: 10, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
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
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: 0 }}>Screens</h2>
            <div style={{ fontSize: 12, color: C.purple, fontFamily: F.sans, marginTop: 4 }}>
              {form.selected_screen_ids.length} of {matchedScreens.length} selected · ~{(totalImpr / 1000).toFixed(0)}K impressions/mo
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 28 }}>
            {matchedScreens.map(s => (
              <ScreenPickerCard key={s.id} screen={s} selected={form.selected_screen_ids} onToggle={toggleScreen} />
            ))}
          </div>
        )}

        <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: '0 0 16px' }}>Creative{isMulti ? 's' : ''}</h2>

        {unassigned.length > 0 && (
          <div style={{ marginBottom: 16, padding: '10px 14px', background: C.amberSoft, border: `1px solid ${C.amberBorder}`, borderRadius: 8, fontSize: 12, color: C.amber, fontFamily: F.sans }}>
            {unassigned.length} of {form.selected_screen_ids.length} screens aren't assigned to a creative yet — they'll show the first creative above by default.
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
            duration={form.duration}
            onSplitByType={() => splitByType(c.id)}
            profile={profile}
          />
        ))}

        <button type="button" onClick={addCreative} style={{
          background: 'none', border: `1px dashed ${C.border}`, borderRadius: 10, padding: '12px 16px',
          fontSize: 13, color: C.purple, cursor: 'pointer', fontFamily: F.sans, width: '100%',
        }}>
          + Add another creative
        </button>
      </Card>
    </div>
  );
}
