import { useState } from 'react';
import { useReveal } from './useReveal.js';

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
                <div className="mock-kpi" key={k}><div className="k">{k}</div><div className="v">{v}</div></div>
              ))}
            </div>
            {t.rows.map(([name, pct, val]) => (
              <div className="mock-row" key={name}>
                <span className="dot" />
                <span className="name">{name}</span>
                <span className="bar"><i style={{ width: `${pct}%` }} /></span>
                <span className="val">{val}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="sec-sub" style={{ margin: '20px auto 0' }}>{t.caption}</p>
      </div>
    </section>
  );
}
