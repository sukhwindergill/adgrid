// src/views/advertiser/createCampaign/LocationSearch.jsx
import { useState, useRef, useEffect } from 'react';
import { C, F } from '../../../design/tokens.js';

// Typeahead combobox over the client-side location index (see
// src/lib/locationIndex.js). Every suggestion matches at least one real
// screen — there is no network call here, filtering is instant.
export function LocationSearch({ locations, value, onSelect, placeholder = 'Search a city…', scopeCountry, scopeState, loading = false }) {
  const [query, setQuery] = useState(value ?? '');
  // Track the last external `value` we synced from, so we can detect an
  // external reset (e.g. parent clearing the field) and re-sync `query`
  // during render, without mirroring it through a useEffect.
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

  const scoped = locations.filter(l =>
    (!scopeCountry || l.country === scopeCountry) &&
    (!scopeState || l.state === scopeState)
  );

  const q = query.trim().toLowerCase();
  const matches = q
    ? scoped
        .filter(l => l.city.toLowerCase().includes(q))
        .sort((a, b) => {
          const aStarts = a.city.toLowerCase().startsWith(q) ? 0 : 1;
          const bStarts = b.city.toLowerCase().startsWith(q) ? 0 : 1;
          return aStarts !== bStarts ? aStarts - bStarts : b.count - a.count;
        })
        .slice(0, 8)
    : [];

  const selectEntry = (entry) => {
    setQuery(entry.city);
    setOpen(false);
    onSelect(entry);
  };

  const onKeyDown = (e) => {
    if (!open || matches.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (matches[highlight]) selectEntry(matches[highlight]); }
    else if (e.key === 'Escape') { setOpen(false); }
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
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)', zIndex: 10, maxHeight: 220, overflowY: 'auto',
        }}>
          {matches.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 12, color: C.textMuted, fontFamily: F.sans }}>
              No screens in that area yet
            </div>
          ) : matches.map((m, i) => (
            <div
              key={`${m.country}|${m.state}|${m.city}`}
              onClick={() => selectEntry(m)}
              onMouseEnter={() => setHighlight(i)}
              style={{
                padding: '8px 12px', fontSize: 13, fontFamily: F.sans, cursor: 'pointer',
                background: i === highlight ? C.surfaceAlt : C.surface, color: C.text,
              }}
            >
              {m.city} <span style={{ color: C.textMuted, fontSize: 12 }}>— {m.state ? `${m.state}, ` : ''}{m.country} · {m.count} screen{m.count !== 1 ? 's' : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
