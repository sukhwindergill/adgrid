import { useReveal } from './useReveal.js';
import { Carousel } from './Carousel.jsx';
import { IconDumbbell, IconCoffee, IconScissors, IconCross, IconBus, IconBag, IconBed, IconCap } from './icons.jsx';
import { useT } from '../../../i18n/useT.js';

const VENUES = [
  ['gyms', IconDumbbell], ['cafes', IconCoffee], ['salons', IconScissors],
  ['clinics', IconCross], ['transit', IconBus], ['retail', IconBag],
  ['hotels', IconBed], ['campuses', IconCap],
];

const SLIDE_KEYS = ['retail', 'transit', 'clinic', 'hotel', 'campus'];

export function ProofStrip() {
  const { t } = useT();
  const [ref, on] = useReveal();
  const slides = SLIDE_KEYS.map(k => ({
    src: `/marketing/venue-${k}.jpg`,
    alt: t(`marketing.proof.slides.${k}.alt`),
    caption: t(`marketing.proof.slides.${k}.caption`),
    width: 1600,
    height: 1073,
  }));
  return (
    <section className="sec light" ref={ref} style={{ padding: '56px 24px', textAlign: 'center' }}>
      <div className={`inner rv ${on ? 'on' : ''}`}>
        <h2 className="sec-h" style={{ fontSize: 24 }}>{t('marketing.proof.heading')}</h2>
        <Carousel slides={slides} />
        <div className="marquee">
          <div className="marquee-track">
            {[...VENUES, ...VENUES].map((v, i) => {
              const [key, Icon] = v;
              return <span className="venue-chip" key={`${key}-${i}`}><Icon size={17} /> {t(`marketing.proof.venues.${key}`)}</span>;
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
