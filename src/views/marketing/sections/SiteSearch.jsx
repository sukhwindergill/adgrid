import { useEffect, useRef, useState } from 'react';
import { FAQS } from './faqData.js';

const SECTION_ENTRIES = [
  { id: 'how', title: 'How it works', text: 'List your screens or book a campaign, real-time pricing, self-serve, no long-term contracts.' },
  { id: 'operators', title: 'For operators', text: 'List your digital screens, set your own prices, approve every ad before it airs.' },
  { id: 'advertisers', title: 'For advertisers', text: 'Book real out-of-home ad campaigns on local screens in minutes, no minimums.' },
];

// Each FAQ gets its own anchor id (`faq-<i>`) instead of sharing 'faq', so a
// search result scrolls to — and can auto-expand — the specific question
// matched, rather than just the top of the FAQ section.
const FAQ_ENTRIES = FAQS.map(([q, a], i) => ({ id: `faq-${i}`, title: q, text: a, key: `faq-${i}` }));

const INDEX = [...SECTION_ENTRIES, ...FAQ_ENTRIES];

function matches(entry, query) {
  const q = query.toLowerCase();
  return entry.title.toLowerCase().includes(q) || entry.text.toLowerCase().includes(q);
}

export function SiteSearch({ onScrollTo }) {
  const [query, setQuery] = useState('');
  const [closed, setClosed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const optionRefs = useRef([]);

  const results = query.trim().length === 0 ? [] : INDEX.filter(e => matches(e, query));
  const isOpen = !closed && query.trim().length > 0;

  // Dismiss on outside click.
  useEffect(() => {
    if (!isOpen) return;
    const onDocMouseDown = e => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setClosed(true);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [isOpen]);

  useEffect(() => {
    optionRefs.current[activeIndex]?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex]);

  const selectResult = entry => {
    if (entry.id.startsWith('faq-')) {
      // Tell Faq.jsx which question to auto-expand — separate from the
      // scroll-to-anchor call below, which only positions the viewport.
      window.dispatchEvent(new CustomEvent('adgrid:faq-open', { detail: Number(entry.id.split('-')[1]) }));
    }
    onScrollTo(entry.id);
    setQuery('');
    setClosed(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
  };

  const onChange = e => {
    setQuery(e.target.value);
    setClosed(false);
    setActiveIndex(-1);
  };

  const onKeyDown = e => {
    if (e.key === 'Escape') {
      if (isOpen) {
        e.stopPropagation();
        setClosed(true);
        setActiveIndex(-1);
      }
      return;
    }
    if (!isOpen || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => (i + 1 >= results.length ? 0 : i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => (i - 1 < 0 ? results.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < results.length) {
        e.preventDefault();
        selectResult(results[activeIndex]);
      }
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        placeholder="Search…"
        value={query}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onFocus={() => setClosed(false)}
        role="combobox"
        aria-expanded={isOpen}
        aria-controls="site-search-listbox"
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? `site-search-opt-${activeIndex}` : undefined}
        className="site-search-input"
      />
      {isOpen && (
        <div id="site-search-listbox" role="listbox" className="site-search-listbox">
          {results.length === 0 ? (
            <div className="site-search-empty">No results</div>
          ) : (
            results.map((r, i) => (
              <button
                key={r.key ?? r.id}
                ref={el => { optionRefs.current[i] = el; }}
                id={`site-search-opt-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                onClick={() => selectResult(r)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`site-search-option${i === activeIndex ? ' on' : ''}`}
              >
                {r.title}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
