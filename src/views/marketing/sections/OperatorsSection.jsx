import { useReveal } from './useReveal.js';
import { IconTrend, IconShield, IconChart, IconBolt } from './icons.jsx';

const CARDS = [
  [IconTrend, 'Dynamic pricing', 'Set a floor price and let demand move it up. Event nights and rush hours price themselves.'],
  [IconShield, 'Full approval control', 'Approve or reject every ad. Block categories and competitors. Set blackout windows.'],
  [IconChart, 'Real-time analytics', 'Fill rate, revenue trends, and playback proof — per screen, per day.'],
  [IconBolt, 'No lock-in', 'Connect in minutes. No long-term contracts, no upfront costs.'],
];

export function OperatorsSection({ onScrollTo }) {
  const [ref, on] = useReveal();
  return (
    <section className="sec lcard-bg" id="operators" ref={ref}>
      <div className="inner">
        <div className={`sticky-split rv ${on ? 'on' : ''}`}>
          <div className="sticky-col">
            <img src="/marketing/venue-barbershop.jpg" alt="Digital ad screen on a barbershop counter"
              loading="lazy" width="1600" height="1073" />
          </div>
          <div className="scroll-col">
            <div className="eyebrow">For operators</div>
            <h2 className="sec-h">Your screens. Your rules. New revenue.</h2>
            <p className="sec-sub">Turn idle screen time into income without giving up control of what plays in your venue.</p>
            <div className="card-grid">
              {CARDS.map(card => {
                const [Icon, h, p] = card;
                return <div className="f-card" key={h}><Icon /><h3>{h}</h3><p>{p}</p></div>;
              })}
            </div>
            <div style={{ marginTop: 32 }}>
              <button className="btn-p" onClick={() => onScrollTo('waitlist-form')}>Join the operator waitlist</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
