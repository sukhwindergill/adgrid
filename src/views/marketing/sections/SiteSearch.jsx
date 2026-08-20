import { useState } from 'react';
import { F } from '../../../design/tokens.js';
import { FAQS } from './Faq.jsx';

const SECTION_ENTRIES = [
  { id: 'how', title: 'How it works', text: 'List your screens or book a campaign — real-time pricing, self-serve, no long-term contracts.' },
  { id: 'operators', title: 'For operators', text: 'List your digital screens, set your own prices, approve every ad before it airs.' },
  { id: 'advertisers', title: 'For advertisers', text: 'Book real out-of-home ad campaigns on local screens in minutes, no minimums.' },
];

const FAQ_ENTRIES = FAQS.map(([q, a], i) => ({ id: 'faq', title: q, text: a, key: `faq-${i}` }));

const INDEX = [...SECTION_ENTRIES, ...FAQ_ENTRIES];

function matches(entry, query) {
  const q = query.toLowerCase();
  return entry.title.toLowerCase().includes(q) || entry.text.toLowerCase().includes(q);
}

export function SiteSearch({ onScrollTo }) {
  const [query, setQuery] = useState('');

  const results = query.trim().length === 0 ? [] : INDEX.filter(e => matches(e, query));

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        placeholder="Search…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        style={{
          padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)',
          background: 'rgba(255,255,255,0.06)', color: '#fff', fontFamily: F.sans, fontSize: 13,
          outline: 'none', width: 180,
        }}
      />
      {query.trim().length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6,
          background: '#14141f', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
          maxHeight: 320, overflowY: 'auto', zIndex: 60, padding: 6,
        }}>
          {results.length === 0 ? (
            <div style={{ padding: 12, fontSize: 13, color: '#8A8A9A', fontFamily: F.sans }}>No results</div>
          ) : (
            results.map((r, i) => (
              <button
                key={r.key ?? r.id}
                onClick={() => { onScrollTo(r.id); setQuery(''); }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px',
                  background: 'none', border: 'none', borderRadius: 8, cursor: 'pointer',
                  color: '#fff', fontFamily: F.sans, fontSize: 13,
                }}
              >
                <span>{r.title}</span>
                {r.id === 'faq' && (
                  <span style={{ display: 'block', fontSize: 12, color: '#8A8A9A', marginTop: 2 }}>
                    {r.text}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
