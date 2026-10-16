import { useEffect, useState } from 'react';
import { useReveal } from './useReveal.js';
import { useCountUp } from './useCountUp.js';
import { useT } from '../../../i18n/useT.js';

const TABS = {
  operators: {
    // Illustrative only, and kept in line with EarningsCalculator's
    // assumptions ($5 CPM, 4 spots per visitor, 70% payout) so the two
    // sections never tell a visitor different stories.
    kpis: [['kpiScreens', 3, 'int'], ['kpiFill', 72, 'pct'], ['kpiMonth', 545, 'money']],
    rows: [
      ['rowGym', 84, 310, 'money'],
      ['rowCafe', 68, 140, 'money'],
      ['rowClinic', 55, 95, 'money'],
    ],
  },
  advertisers: {
    kpis: [['kpiActive', 2, 'int'], ['kpiPlays', 1431, 'int'], ['kpiScans', 96, 'int']],
    rows: [
      ['rowCoffee', 74, 512, 'plays'],
      ['rowClass', 58, 344, 'plays'],
      ['rowOpenHouse', 41, 187, 'plays'],
    ],
  },
};

function useKpiFormat(tab) {
  const { t, formatCurrency, formatNumber, formatPercent } = useT();
  return (value, kind) => {
    const n = Math.round(value);
    if (kind === 'money') return formatCurrency(n, { decimals: 0 });
    if (kind === 'pct') return formatPercent(n / 100);
    if (kind === 'plays') return t(`marketing.showcase.${tab}.plays`, { count: n });
    return formatNumber(n);
  };
}

function Kpi({ label, value, kind, tab, active }) {
  const format = useKpiFormat(tab);
  const animated = useCountUp(value, active);
  return (
    <div className="mock-kpi">
      <div className="k">{label}</div>
      <div className="v">{format(animated, kind)}</div>
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
  const { t } = useT();
  const format = useKpiFormat('advertisers');
  const [tab, setTab] = useState('operators');
  const data = TABS[tab];
  const ns = `marketing.showcase.${tab}`;
  return (
    <section className="sec light" id="product" ref={ref}>
      <div className={`inner rv ${on ? 'on' : ''}`} style={{ textAlign: 'center' }}>
        <div className="eyebrow">{t('marketing.showcase.eyebrow')}</div>
        <h2 className="sec-h">{t('marketing.showcase.heading')}</h2>
        <div className="toggle">
          <button className={tab === 'operators' ? 'on' : ''} onClick={() => setTab('operators')}>{t('marketing.nav.forOperators')}</button>
          <button className={tab === 'advertisers' ? 'on' : ''} onClick={() => setTab('advertisers')}>{t('marketing.nav.forAdvertisers')}</button>
        </div>
        <div className="shot-frame">
          <div className="shot-bar"><span /><span /><span /></div>
          <div className="shot-stage" style={{ textAlign: 'left' }}>
            <div className="mock-kpis">
              {data.kpis.map(([k, v, kind]) => (
                <Kpi key={`${tab}-${k}`} label={t(`${ns}.${k}`)} value={v} kind={kind} tab={tab} active={on} />
              ))}
            </div>
            {data.rows.map(([name, pct, val, kind], i) => (
              <MockRow key={`${tab}-${name}`} name={t(`${ns}.${name}`)} pct={pct} val={format(val, kind)} delay={i * 80} />
            ))}
          </div>
        </div>
        <p className="sec-sub" style={{ margin: '20px auto 0' }}>{t(`${ns}.caption`)}</p>
        <p style={{ margin: '8px auto 0', fontSize: 12, opacity: 0.6 }}>{t('marketing.showcase.disclaimer')}</p>
      </div>
    </section>
  );
}
