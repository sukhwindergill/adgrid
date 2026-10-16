import { useState, useEffect, useRef, useMemo } from 'react';
import { C, F } from '../../design/tokens.js';
import { scopedBookings, applyBookingSearch } from '../../lib/bookingsQuery.js';
import { navItems } from './navConfig.js';
import { rankMatches } from '../../lib/commandSearch.js';

// Cmd/Ctrl+K jump-to: pages, screens and campaigns from one box. Pages and
// screens are matched locally; campaigns are looked up on the server
// (scoped to the advertiser, or to bookings on the operator's screens) so it
// works however many there are. Mounted only while open, so each opening
// starts from fresh state.
export function CommandPalette({ onClose, activeMode, screens = [], advertiserId, onNavigate }) {
  const [query, setQuery] = useState('');
  // Tagged with the query they answer, so stale rows never show for a
  // different (or too-short) query.
  const [campaigns, setCampaigns] = useState({ q: '', rows: [] });
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  const isAdv = activeMode === 'advertiser';

  useEffect(() => {
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  // Debounced server lookup for campaigns, scoped on the server to this
  // side of the account (see scopedBookings).
  const screenIdsKey = screens.map(sc => sc.id).join(',');
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || (!isAdv && !screenIdsKey)) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const scope = isAdv ? { advertiserId } : { operatorScreenIds: screenIdsKey.split(',') };
      const req = applyBookingSearch(scopedBookings(scope, { columns: 'id, advertiser_name, campaign_name, status' }), q)
        .order('created_at', { ascending: false })
        .limit(6);
      const { data } = await req;
      if (!cancelled) setCampaigns({ q, rows: data || [] });
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, isAdv, advertiserId, screenIdsKey]);

  const results = useMemo(() => {
    const pages = rankMatches(query, navItems(activeMode), i => i.label)
      .map(i => ({ key: `p-${i.id}`, kind: 'Page', label: i.label, to: i.id }));
    const screenHits = isAdv ? [] : rankMatches(query, screens, s => `${s.name} ${s.city ?? ''}`).slice(0, 6)
      .map(s => ({ key: `s-${s.id}`, kind: 'Screen', label: s.name, sub: s.city, to: `screen-detail/${s.id}` }));
    const rows = campaigns.q === query.trim() ? campaigns.rows : [];
    const campaignHits = rows.map(c => ({
      key: `c-${c.id}`, kind: 'Campaign', label: c.campaign_name || c.advertiser_name || 'Campaign', sub: c.status,
      to: `${isAdv ? 'adv-campaigns' : 'campaigns'}/${c.id}`,
    }));
    return [...pages.slice(0, query ? 6 : 12), ...screenHits, ...campaignHits];
  }, [query, activeMode, screens, campaigns, isAdv]);


  const pick = r => { onClose(); onNavigate(r.to); };
  const onKeyDown = e => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    else if (e.key === 'Enter' && results[cursor]) { e.preventDefault(); pick(results[cursor]); }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.35)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '12vh 16px 16px' }}>
      <div role="dialog" aria-modal="true" aria-label="Search" onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 560, background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`,
        boxShadow: '0 16px 48px rgba(0,0,0,0.18)', overflow: 'hidden', fontFamily: F.sans,
      }}>
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setCursor(0); }}
          onKeyDown={onKeyDown}
          placeholder={isAdv ? 'Search pages and campaigns…' : 'Search pages, screens and campaigns…'}
          aria-label="Search"
          role="combobox"
          aria-expanded="true"
          aria-controls="cmdk-results"
          aria-activedescendant={results[cursor] ? `cmdk-${results[cursor].key}` : undefined}
          style={{ width: '100%', boxSizing: 'border-box', padding: '16px 18px', border: 'none', borderBottom: `1px solid ${C.border}`, fontSize: 16, fontFamily: F.sans, outline: 'none', color: C.text }}
        />
        <ul id="cmdk-results" role="listbox" style={{ listStyle: 'none', margin: 0, padding: 6, maxHeight: 360, overflowY: 'auto' }}>
          {results.length === 0 && (
            <li style={{ padding: '14px 12px', fontSize: 14, color: C.textMuted }}>No matches.</li>
          )}
          {results.map((r, i) => (
            <li
              key={r.key}
              id={`cmdk-${r.key}`}
              role="option"
              aria-selected={i === cursor}
              onMouseEnter={() => setCursor(i)}
              onClick={() => pick(r)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                background: i === cursor ? C.purpleSoft : 'transparent',
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, width: 64, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{r.kind}</span>
              <span style={{ flex: 1, fontSize: 14, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
              {r.sub && <span style={{ fontSize: 12, color: C.textMuted }}>{r.sub}</span>}
            </li>
          ))}
        </ul>
        <div style={{ padding: '8px 14px', borderTop: `1px solid ${C.border}`, fontSize: 12, color: C.textMuted }}>
          ↑↓ to move · Enter to open · Esc to close
        </div>
      </div>
    </div>
  );
}
