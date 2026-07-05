import { useReveal } from './useReveal.js';
import { IconDumbbell, IconCoffee, IconScissors, IconCross, IconBus, IconBag, IconBed, IconCap } from './icons.jsx';

const VENUES = [
  ['Gyms', IconDumbbell], ['Cafés', IconCoffee], ['Salons & barbershops', IconScissors],
  ['Clinics', IconCross], ['Transit', IconBus], ['Retail', IconBag],
  ['Hotels', IconBed], ['Campuses', IconCap],
];

export function ProofStrip() {
  const [ref, on] = useReveal();
  return (
    <section className="sec light" ref={ref} style={{ padding: '56px 24px', textAlign: 'center' }}>
      <div className={`inner rv ${on ? 'on' : ''}`}>
        <h2 className="sec-h" style={{ fontSize: 24 }}>Screens where people actually spend time</h2>
        <div className="venue-row">
          {VENUES.map(v => {
            const [label, Icon] = v;
            return <span className="venue-chip" key={label}><Icon size={17} /> {label}</span>;
          })}
        </div>
      </div>
    </section>
  );
}
