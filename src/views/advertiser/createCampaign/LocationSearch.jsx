// src/views/advertiser/createCampaign/LocationSearch.jsx
import { useState, useRef, useEffect } from 'react';
import { C, F, T, SH } from '../../../design/tokens.js';
import { Inp } from '../../../components/primitives/Inp.jsx';
import { TX } from '../../../design/text.js';
import { useT } from '../../../i18n/useT.js';

// Display name + level badge for a flattened location option (see
// buildFlatLocationOptions in src/lib/locationIndex.js). `kind` drives the
// badge colour; `badge` is the translated word shown.
function describe(entry, t, regionName) {
  const stateWord = code => t(`venue.stateWord.${code}`).startsWith('venue.') ? t('venue.stateWord.default') : t(`venue.stateWord.${code}`);
  if (entry.level === 'country') return { name: regionName(entry.country), kind: 'country', badge: t('create.location.country'), sub: null };
  if (entry.level === 'state') return { name: entry.state, kind: 'state', badge: stateWord(entry.country), sub: regionName(entry.country) };
  return { name: entry.city, kind: 'city', badge: t('create.location.city'), sub: `${entry.state ? `${entry.state}, ` : ''}${regionName(entry.country)}` };
}

const BADGE_COLOR = {
  country: { bg: C.purpleSoft, fg: C.purple },
  city: { bg: C.blueSoft, fg: C.blueText },
};
const badgeColor = kind => BADGE_COLOR[kind] ?? BADGE_COLOR.city; // any State/Province/Region word falls back to a neutral tone below
const BADGE_DEFAULT = { bg: C.surfaceAlt, fg: C.textMid };

// Single consolidated typeahead over country + state + city, all in one
// dropdown, each row tagged with which level it resolves to (Country /
// State / Province / City) — replaces the old stacked Country select +
// State select + City search. Every suggestion matches at least one real
// screen (or, for country/state rows, rolls up screens under it) — no
// network call, filtering is instant.
export function LocationSearch({ options, value, onSelect, placeholder, loading = false }) {
  const { t, regionName } = useT();
  const [query, setQuery] = useState(value ?? '');
  const [prevValue, setPrevValue] = useState(value ?? '');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef(null);

  if ((value ?? '') !== prevValue) {
    setPrevValue(value ?? '');
    setQuery(value ?? '');
  }

  useEffect(() => {
    function onDocMouseDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  const q = query.trim().toLowerCase();
  const matches = q
    ? options
        .map(e => ({ entry: e, d: describe(e, t, regionName) }))
        .filter(({ d }) => d.name.toLowerCase().includes(q))
        .sort((a, b) => {
          const aStarts = a.d.name.toLowerCase().startsWith(q) ? 0 : 1;
          const bStarts = b.d.name.toLowerCase().startsWith(q) ? 0 : 1;
          if (aStarts !== bStarts) return aStarts - bStarts;
          return (b.entry.count ?? 0) - (a.entry.count ?? 0);
        })
        .slice(0, 10)
    : [];

  const selectEntry = (entry, d) => {
    setQuery(d.name);
    setOpen(false);
    onSelect(entry);
  };

  const onKeyDown = (e) => {
    if (!open) return;
    if (e.key === 'Escape') { setOpen(false); return; }
    if (matches.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (matches[highlight]) selectEntry(matches[highlight].entry, matches[highlight].d); }
  };

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <Inp
        type="text"
        value={query}
        disabled={loading}
        placeholder={loading ? t('create.location.loading') : (placeholder ?? t('create.location.placeholder'))}
        onChange={e => { setQuery(e.target.value); setOpen(true); setHighlight(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        style={{ boxSizing: 'border-box', transition: 'border-color 0.15s' }}
      />
      {open && q && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
          boxShadow: SH.hover, zIndex: 10, maxHeight: 260, overflowY: 'auto',
        }}>
          {matches.length === 0 ? (
            <div style={{ ...TX.helperMuted, padding: '10px 12px' }}>
              {t('create.location.noMatches')}
            </div>
          ) : matches.map(({ entry, d }, i) => {
            const bc = badgeColor(d.kind) ?? BADGE_DEFAULT;
            return (
              <div
                key={`${d.kind}|${entry.country}|${entry.state ?? ''}|${entry.city ?? ''}`}
                // B20: the input's onBlur closes this list via setTimeout(150).
                // A plain onClick fires after mousedown/blur/mouseup, so on any
                // slow-enough click (assistive tech, touch, a laggy trackpad,
                // automated interaction) the 150ms timer can win the race and
                // unmount this row before the click ever lands -- the
                // selection silently does nothing. onMouseDown + preventDefault
                // stops the input from blurring in the first place, so the
                // race can't happen at all rather than depending on being fast
                // enough to win it.
                onMouseDown={e => { e.preventDefault(); selectEntry(entry, d); }}
                onMouseEnter={() => setHighlight(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px', fontSize: T.base, fontFamily: F.sans, cursor: 'pointer',
                  background: i === highlight ? C.surfaceAlt : C.surface, color: C.text,
                }}
              >
                <span style={{
                  flexShrink: 0, fontSize: T.xs, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em',
                  padding: '2px 6px', borderRadius: 4, background: bc.bg, color: bc.fg,
                }}>
                  {d.badge}
                </span>
                <span>
                  {d.name}
                  {d.sub && <span style={{ color: C.textMuted, fontSize: T.sm }}> — {d.sub}</span>}
                </span>
                <span style={{ marginLeft: 'auto', color: C.textMuted, fontSize: T.sm, flexShrink: 0 }}>
                  {t('common.screensCount', { count: entry.count ?? 0 })}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
