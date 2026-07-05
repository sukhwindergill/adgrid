import { useReveal } from './useReveal.js';
import { IconPin, IconTagPrice, IconQr, IconClock } from './icons.jsx';

const CARDS = [
  [IconPin, 'Hyper-local targeting', 'Pick the exact venues your customers already visit, down to the block.'],
  [IconTagPrice, 'Transparent pricing', 'See the price per slot before you book. Pay only for played time.'],
  [IconQr, 'Scan-level measurement', 'Every campaign gets a unique QR code. Track scans by screen and by hour.'],
  [IconClock, 'Live in days', 'Upload creative, get approved, go live. No agencies, no RFPs.'],
];

export function AdvertisersSection() {
  const [ref, on] = useReveal();
  return (
    <section className="sec light" id="advertisers" ref={ref}>
      <div className="inner">
        <div className={`split rv ${on ? 'on' : ''}`}>
          <div>
            <div className="eyebrow">For advertisers</div>
            <h2 className="sec-h">Local reach you can actually measure</h2>
            <p className="sec-sub">Put your brand on real screens in the neighbourhoods your customers live in — and see exactly what it did.</p>
          </div>
          {/* TODO(design): swap for photoreal venue-cafe.jpg once Nano Banana generation is available */}
          <div className="creative-ph">Café window screen with QR code — creative pending</div>
        </div>
        <div className={`card-grid rv d1 ${on ? 'on' : ''}`}>
          {CARDS.map(card => {
            const [Icon, h, p] = card;
            return <div className="f-card" key={h}><Icon /><h3>{h}</h3><p>{p}</p></div>;
          })}
        </div>
      </div>
    </section>
  );
}
