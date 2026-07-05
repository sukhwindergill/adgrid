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
        <div className={`split rv ${on ? 'on' : ''}`}>
          {/* TODO(design): swap for photoreal venue-barbershop.jpg once Nano Banana generation is available */}
          <div className="creative-ph">Digital ad screen on a barbershop counter — creative pending</div>
          <div>
            <div className="eyebrow">For operators</div>
            <h2 className="sec-h">Your screens. Your rules. New revenue.</h2>
            <p className="sec-sub">Turn idle screen time into income without giving up control of what plays in your venue.</p>
          </div>
        </div>
        <div className={`card-grid rv d1 ${on ? 'on' : ''}`}>
          {CARDS.map(card => {
            const [Icon, h, p] = card;
            return <div className="f-card" key={h}><Icon /><h3>{h}</h3><p>{p}</p></div>;
          })}
        </div>
        <div className={`rv d2 ${on ? 'on' : ''}`} style={{ marginTop: 32 }}>
          <button className="btn-p" onClick={() => onScrollTo('waitlist-form')}>Join the operator waitlist</button>
        </div>
      </div>
    </section>
  );
}
