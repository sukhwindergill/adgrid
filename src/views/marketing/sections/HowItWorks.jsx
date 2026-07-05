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

export function HowItWorks() {
  const [ref, on] = useReveal();
  return (
    <section className="sec light" id="how" ref={ref}>
      <div className="inner" style={{ textAlign: 'center' }}>
        <div className={`rv ${on ? 'on' : ''}`}>
          <div className="eyebrow">How it works</div>
          <h2 className="sec-h">Two sides, one marketplace</h2>
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
