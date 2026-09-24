import { useState } from 'react';
import { useReveal } from './useReveal.js';
import { estimateMonthlyEarnings, ESTIMATE_ASSUMPTIONS } from '../../../lib/earningsEstimate.js';

const FILL_OPTIONS = [
  [0.25, 'Quiet', '25% of ad spots booked'],
  [0.5, 'Typical', '50% of ad spots booked'],
  [0.75, 'Busy', '75% of ad spots booked'],
];

const fmt = n => `$${n.toLocaleString('en-CA')}`;

export function EarningsCalculator({ onOperatorSignup }) {
  const [ref, on] = useReveal();
  const [screens, setScreens] = useState(1);
  const [dailyVisitors, setDailyVisitors] = useState(400);
  const [fillRate, setFillRate] = useState(0.5);

  const { operator } = estimateMonthlyEarnings({ screens, dailyVisitors, fillRate });
  const { cpm, adSpotsPerLoop, ownerShare } = ESTIMATE_ASSUMPTIONS;

  return (
    <section className="sec light" id="earnings" ref={ref}>
      <div className="inner">
        <div className={`calc rv ${on ? 'on' : ''}`}>
          <div>
            <div className="eyebrow">Earnings calculator</div>
            <h2 className="sec-h">What could your screen earn?</h2>
            <p className="sec-sub">
              Move the sliders to match your venue. You keep {Math.round(ownerShare * 100)}% of
              what advertisers pay.
            </p>

            <div className="calc-field">
              <label htmlFor="calc-screens">Screens <strong>{screens}</strong></label>
              <input id="calc-screens" type="range" min="1" max="20" step="1"
                value={screens} onChange={e => setScreens(Number(e.target.value))} />
            </div>

            <div className="calc-field">
              <label htmlFor="calc-visitors">
                Visitors per day, per screen <strong>{dailyVisitors.toLocaleString('en-CA')}</strong>
              </label>
              <input id="calc-visitors" type="range" min="50" max="3000" step="50"
                value={dailyVisitors} onChange={e => setDailyVisitors(Number(e.target.value))} />
            </div>

            <fieldset className="calc-field calc-fill">
              <legend>How much ad time gets booked</legend>
              <div className="calc-seg">
                {FILL_OPTIONS.map(([value, label, title]) => (
                  <button key={value} type="button" title={title}
                    aria-pressed={fillRate === value}
                    className={fillRate === value ? 'on' : ''}
                    onClick={() => setFillRate(value)}>
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="calc-result" aria-live="polite">
            <div className="calc-result-lbl">Estimated monthly payout</div>
            <div className="calc-result-num">{fmt(operator)}</div>
            <div className="calc-result-sub">{fmt(operator * 12)} a year</div>
            <button className="btn-p" onClick={onOperatorSignup}>List your screens</button>
            <p className="calc-note">
              Estimate only, not a guarantee. Assumes each visitor sees {adSpotsPerLoop} ad spots
              at a ${cpm} CPM. Real earnings depend on your floor price, hours and demand in your area.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
