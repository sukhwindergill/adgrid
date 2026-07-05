import { useReveal } from './useReveal.js';

const TRACKS = [
  {
    label: 'For screen operators',
    steps: [
      ['Connect your screen', 'Pair any display in minutes. No proprietary hardware to buy.'],
      ['Set your rules', 'Floor price, allowed ad categories, blackout hours. You approve every ad before it plays.'],
      ['Get paid', 'Automatic payouts for every second of ad time sold. Track earnings per screen.'],
    ],
  },
  {
    label: 'For advertisers',
    steps: [
      ['Choose your venues', 'Filter by neighbourhood, venue type, and daily foot traffic.'],
      ['Set budget and schedule', 'Transparent per-slot pricing. No minimums, no long-term contracts.'],
      ['Measure what happens', 'Live playback logs and QR scan tracking for every campaign.'],
    ],
  },
];

function FlowDiagram() {
  return (
    <svg className="flow-diagram" viewBox="0 0 440 72" fill="none" aria-hidden="true">
      <rect x="8" y="20" width="48" height="32" rx="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M24 60h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path className="flow-line" d="M60 36H180" stroke="#7B2FFF" strokeWidth="2" strokeLinecap="round" pathLength="1" />
      <circle cx="220" cy="36" r="26" stroke="#7B2FFF" strokeWidth="1.5" />
      <text x="220" y="41" textAnchor="middle" fontSize="11" fontWeight="700" fill="#7B2FFF">AG</text>
      <path className="flow-line" d="M260 36H380" stroke="#7B2FFF" strokeWidth="2" strokeLinecap="round" pathLength="1" />
      <path d="M384 28h48v6l-4 4v20h-40V38l-4-4v-6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function HowItWorks() {
  const [ref, on] = useReveal();
  return (
    <section className="sec light" id="how" ref={ref}>
      <div className="inner" style={{ textAlign: 'center' }}>
        <div className={`rv ${on ? 'on' : ''}`}>
          <div className="eyebrow">How it works</div>
          <h2 className="sec-h">Two sides, one marketplace</h2>
          <div className={on ? 'flow-on' : ''}>
            <FlowDiagram />
          </div>
        </div>
        <div className="tracks" style={{ textAlign: 'left' }}>
          {TRACKS.map((track, ti) => (
            <div className={`track rv d${ti + 1} ${on ? 'on' : ''}`} key={track.label}>
              <div className="t-label">{track.label}</div>
              {track.steps.map((step, i) => {
                const [h, p] = step;
                return (
                  <div className="step" key={h}>
                    <div className="n">{i + 1}</div>
                    <div><h4>{h}</h4><p>{p}</p></div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
