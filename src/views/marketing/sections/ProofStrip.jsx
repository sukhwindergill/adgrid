import { useReveal } from './useReveal.js';
import { Carousel } from './Carousel.jsx';
import { IconDumbbell, IconCoffee, IconScissors, IconCross, IconBus, IconBag, IconBed, IconCap } from './icons.jsx';

const VENUES = [
  ['Gyms', IconDumbbell], ['Cafés', IconCoffee], ['Salons & barbershops', IconScissors],
  ['Clinics', IconCross], ['Transit', IconBus], ['Retail', IconBag],
  ['Hotels', IconBed], ['Campuses', IconCap],
];

const SLIDES = [
  { src: '/marketing/hero-gym.jpg', alt: 'Digital ad screen mounted in a gym', caption: 'Gym — wall-mounted display', width: 1600, height: 1073 },
  { src: '/marketing/venue-barbershop.jpg', alt: 'Digital ad screen on a barbershop counter', caption: 'Barbershop — counter display', width: 1600, height: 1073 },
  { src: '/marketing/venue-cafe.jpg', alt: 'Café window screen showing an ad with a QR code', caption: 'Café — window-facing display', width: 1600, height: 1073 },
  { src: '/marketing/venue-retail.jpg', alt: 'Digital ad screen in a retail store', caption: 'Retail — in-store display', width: 1600, height: 1073 },
  { src: '/marketing/venue-transit.jpg', alt: 'Digital ad screen at a transit shelter', caption: 'Transit — shelter display', width: 1600, height: 1073 },
];

export function ProofStrip() {
  const [ref, on] = useReveal();
  return (
    <section className="sec light" ref={ref} style={{ padding: '56px 24px', textAlign: 'center' }}>
      <div className={`inner rv ${on ? 'on' : ''}`}>
        <h2 className="sec-h" style={{ fontSize: 24 }}>Screens where people actually spend time</h2>
        <Carousel slides={SLIDES} />
        <div className="marquee">
          <div className="marquee-track">
            {[...VENUES, ...VENUES].map((v, i) => {
              const [label, Icon] = v;
              return <span className="venue-chip" key={`${label}-${i}`}><Icon size={17} /> {label}</span>;
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
