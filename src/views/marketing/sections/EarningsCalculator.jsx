import { useRef, useState } from 'react';
import { useReveal } from './useReveal.js';
import { estimateMonthlyEarnings, ESTIMATE_ASSUMPTIONS } from '../../../lib/earningsEstimate.js';
import { track } from '../../../lib/analytics.js';
import { useT } from '../../../i18n/useT.js';

const FILL_OPTIONS = [
  [0.25, 'quiet'],
  [0.5, 'typical'],
  [0.75, 'busy'],
];

export function EarningsCalculator({ onOperatorSignup }) {
  const { t, formatCurrency, formatNumber, formatPercent } = useT();
  const fmt = n => formatCurrency(n, { decimals: 0 });
  const [ref, on] = useReveal();
  const [screens, setScreens] = useState(1);
  const [dailyVisitors, setDailyVisitors] = useState(400);
  const [fillRate, setFillRate] = useState(0.5);
  // One event per page view, on first interaction, not per slider tick.
  const tracked = useRef(false);
  const touched = setter => value => {
    if (!tracked.current) { tracked.current = true; track('earnings_calculator_used'); }
    setter(value);
  };

  const { operator } = estimateMonthlyEarnings({ screens, dailyVisitors, fillRate });
  const { cpm, adSpotsPerLoop, ownerShare } = ESTIMATE_ASSUMPTIONS;

  return (
    <section className="sec light" id="earnings" ref={ref}>
      <div className="inner">
        <div className={`calc rv ${on ? 'on' : ''}`}>
          <div>
            <div className="eyebrow">{t('marketing.calc.eyebrow')}</div>
            <h2 className="sec-h">{t('marketing.calc.heading')}</h2>
            <p className="sec-sub">
              {t('marketing.calc.sub', { share: formatPercent(ownerShare) })}
            </p>

            <div className="calc-field">
              <label htmlFor="calc-screens">{t('marketing.calc.screens')} <strong>{screens}</strong></label>
              <input id="calc-screens" type="range" min="1" max="20" step="1"
                value={screens} onChange={e => touched(setScreens)(Number(e.target.value))} />
            </div>

            <div className="calc-field">
              <label htmlFor="calc-visitors">
                {t('marketing.calc.visitors')} <strong>{formatNumber(dailyVisitors)}</strong>
              </label>
              <input id="calc-visitors" type="range" min="50" max="3000" step="50"
                value={dailyVisitors} onChange={e => touched(setDailyVisitors)(Number(e.target.value))} />
            </div>

            <fieldset className="calc-field calc-fill">
              <legend>{t('marketing.calc.fillLegend')}</legend>
              <div className="calc-seg">
                {FILL_OPTIONS.map(([value, key]) => (
                  <button key={value} type="button" title={t(`marketing.calc.fill.${key}.title`)}
                    aria-pressed={fillRate === value}
                    className={fillRate === value ? 'on' : ''}
                    onClick={() => touched(setFillRate)(value)}>
                    {t(`marketing.calc.fill.${key}.label`)}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="calc-result" aria-live="polite">
            <div className="calc-result-lbl">{t('marketing.calc.resultLabel')}</div>
            <div className="calc-result-num">{fmt(operator)}</div>
            <div className="calc-result-sub">{t('marketing.calc.perYear', { amount: fmt(operator * 12) })}</div>
            <button className="btn-p" onClick={onOperatorSignup}>{t('marketing.cta.listScreens')}</button>
            <p className="calc-note">
              {t('marketing.calc.note', { spots: adSpotsPerLoop, cpm: fmt(cpm) })}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
