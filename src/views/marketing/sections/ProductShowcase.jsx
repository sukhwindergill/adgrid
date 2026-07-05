import { useEffect, useState } from 'react';
import { useReveal } from './useReveal.js';
import { useCountUp } from './useCountUp.js';

const TABS = {
  operators: {
    kpis: [['Screens live', '3'], ['Fill rate', '80%'], ['This month', '$6,075']],
    rows: [
      ['Queen St & Spadina', 82, '$1,240'],
      ['Union Station Concourse', 91, '$2,860'],
      ['Yonge-Dundas Square', 67, '$1,975'],
    ],
    caption: 'List inventory, set floor prices, approve every ad, and track earnings per screen.',
  },
  advertisers: {
    kpis: [['Active campaigns', '2'], ['Plays today', '1,431'], ['QR scans', '96']],
    rows: [
      ['Downtown coffee launch', 74, '512 plays'],
      ['Weekend class promo', 58, '344 plays'],
      ['Neighbourhood open house', 41, '187 plays'],
    ],
    caption: 'Pick venues, set a budget, upload creative, and watch plays and scans come in live.',
  },
};

function parseKpi(str) {
  const m = str.match(/^([^\d]*)([\d,]+)(.*)$/);
  if (!m) return { prefix: '', target: 0, suffix: str, hasComma: false };
  const [, prefix, digits, suffix] = m;
  return { prefix, target: parseInt(digits.replace(/,/g, ''), 10), suffix, hasComma: digits.includes(',') };
}

function formatKpi(parsed, value) {
  const rounded = Math.round(value);
  const numStr = parsed.hasComma ? rounded.toLocaleString('en-US') : String(rounded);
  return `${parsed.prefix}${numStr}${parsed.suffix}`;
}

function Kpi({ label, value, active }) {
  const parsed = parseKpi(value);
  const animated = useCountUp(parsed.target, active);
  return (
    <div className="mock-kpi">
      <div className="k">{label}</div>
      <div className="v">{formatKpi(parsed, animated)}</div>
    </div>
  );
}

function MockRow({ name, pct, val, delay }) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div className={`mock-row rv ${entered ? 'on' : ''}`} style={{ transitionDelay: `${delay}ms` }}>
      <span className="dot" />
      <span className="name">{name}</span>
      <span className="bar"><i className={entered ? 'on' : ''} style={{ width: `${pct}%` }} /></span>
      <span className="val">{val}</span>
    </div>
  );
}

export function ProductShowcase() {
  const [ref, on] = useReveal();
  const [tab, setTab] = useState('operators');
  const t = TABS[tab];
  return (
    <section className="sec light" id="product" ref={ref}>
      <div className={`inner rv ${on ? 'on' : ''}`} style={{ textAlign: 'center' }}>
        <div className="eyebrow">The product</div>
        <h2 className="sec-h">One dashboard for each side of the marketplace</h2>
        <div className="toggle">
          <button className={tab === 'operators' ? 'on' : ''} onClick={() => setTab('operators')}>For operators</button>
          <button className={tab === 'advertisers' ? 'on' : ''} onClick={() => setTab('advertisers')}>For advertisers</button>
        </div>
        <div className="shot-frame">
          <div className="shot-bar"><span /><span /><span /></div>
          <div className="shot-stage" style={{ textAlign: 'left' }}>
            <div className="mock-kpis">
              {t.kpis.map(([k, v]) => (
                <Kpi key={`${tab}-${k}`} label={k} value={v} active={on} />
              ))}
            </div>
            {t.rows.map(([name, pct, val], i) => (
              <MockRow key={`${tab}-${name}`} name={name} pct={pct} val={val} delay={i * 80} />
            ))}
          </div>
        </div>
        <p className="sec-sub" style={{ margin: '20px auto 0' }}>{t.caption}</p>
      </div>
    </section>
  );
}
