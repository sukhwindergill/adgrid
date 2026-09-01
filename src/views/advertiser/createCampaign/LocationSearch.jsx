// src/views/advertiser/createCampaign/LocationSearch.jsx
import { useState, useRef, useEffect } from 'react';
import { C, F } from '../../../design/tokens.js';
import { COUNTRIES, STATE_LABEL } from '../../../lib/venueTypes.js';

const countryLabel = code => COUNTRIES.find(c => c.code === code)?.label ?? code;
const stateWord = code => STATE_LABEL[code] ?? 'State';

// Display name + level badge for a flattened location option (see
// buildFlatLocationOptions in src/lib/locationIndex.js).
function describe(entry) {
  if (entry.level === 'country') return { name: countryLabel(entry.country), badge: 'Country', sub: null };
  if (entry.level === 'state') return { name: entry.state, badge: stateWord(entry.country), sub: countryLabel(entry.country) };
  return { name: entry.city, badge: 'City', sub: `${entry.state ? `${entry.state}, ` : ''}${countryLabel(entry.country)}` };
}

const BADGE_COLOR = {
  Country: { bg: C.purpleSoft ?? '#f3e8ff', fg: C.purple ?? '#7c3aed' },
  City: { bg: C.blueSoft ?? '#e0f2fe', fg: C.blue ?? '#0284c7' },
};
const badgeColor = badge => BADGE_COLOR[badge] ?? BADGE_COLOR.City; // any State/Province/Region word falls back to a neutral tone below
const BADGE_DEFAULT = { bg: C.surfaceAlt ?? '#f1f5f9', fg: C.textMid ?? '#475569' };

// Single consolidated typeahead over country + state + city, all in one
// dropdown, each row tagged with which level it resolves to (Country /
// State / Province / City) — replaces the old stacked Country select +
// State select + City search. Every suggestion matches at least one real
// screen (or, for country/state rows, rolls up screens under it) — no
// network call, filtering is instant.
export function LocationSearch({ options, value, onSelect, placeholder = 'Search a country, state/province, or city…', loading = false }) {
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
        .map(e => ({ entry: e, d: describe(e) }))
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
      <input
        type="text"
        value={query}
        disabled={loading}
        placeholder={loading ? 'Loading locations…' : placeholder}
        onChange={e => { setQuery(e.target.value); setOpen(true); setHighlight(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        style={{
          padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 8,
          fontSize: 13, fontFamily: F.sans, color: C.text, background: C.surface,
          outline: 'none', width: '100%', boxSizing: 'border-box',
        }}
      />
      {open && q && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)', zIndex: 10, maxHeight: 260, overflowY: 'auto',
        }}>
          {matches.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 12, color: C.textMuted, fontFamily: F.sans }}>
              No screens in that area yet
            </div>
          ) : matches.map(({ entry, d }, i) => {
            const bc = badgeColor(d.badge) ?? BADGE_DEFAULT;
            return (
              <div
                key={`${d.badge}|${entry.country}|${entry.state ?? ''}|${entry.city ?? ''}`}
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
                  padding: '8px 12px', fontSize: 13, fontFamily: F.sans, cursor: 'pointer',
                  background: i === highlight ? C.surfaceAlt : C.surface, color: C.text,
                }}
              >
                <span style={{
                  flexShrink: 0, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em',
                  padding: '2px 6px', borderRadius: 4, background: bc.bg, color: bc.fg,
                }}>
                  {d.badge}
                </span>
                <span>
                  {d.name}
                  {d.sub && <span style={{ color: C.textMuted, fontSize: 12 }}> — {d.sub}</span>}
                </span>
                <span style={{ marginLeft: 'auto', color: C.textMuted, fontSize: 12, flexShrink: 0 }}>
                  {entry.count} screen{entry.count !== 1 ? 's' : ''}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
