import { useReveal } from './useReveal.js';
import { IconPin, IconTagPrice, IconQr, IconClock } from './icons.jsx';
import { useT } from '../../../i18n/useT.js';

const CARDS = [
  [IconPin, 'local'],
  [IconTagPrice, 'pricing'],
  [IconQr, 'scans'],
  [IconClock, 'fast'],
];

export function AdvertisersSection({ onAdvertiserSignup }) {
  const { t } = useT();
  const [ref, on] = useReveal();
  return (
    <section className="sec light" id="advertisers" ref={ref}>
      <div className="inner">
        <div className={`sticky-split rv ${on ? 'on' : ''}`}>
          <div className="scroll-col">
            <div className="eyebrow">{t('marketing.advertisers.eyebrow')}</div>
            <h2 className="sec-h">{t('marketing.advertisers.heading')}</h2>
            <p className="sec-sub">{t('marketing.advertisers.sub')}</p>
            <div className="card-grid">
              {CARDS.map(card => {
                const [Icon, key] = card;
                return (
                  <div className="f-card" key={key}>
                    <Icon /><h3>{t(`marketing.advertisers.cards.${key}.h`)}</h3><p>{t(`marketing.advertisers.cards.${key}.p`)}</p>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 32 }}>
              <button className="btn-p" onClick={onAdvertiserSignup}>{t('marketing.cta.bookCampaign')}</button>
            </div>
          </div>
          <div className="sticky-col">
            <img src="/marketing/venue-cafe.jpg" alt={t('marketing.advertisers.imgAlt')}
              loading="lazy" width="1600" height="1073" />
          </div>
        </div>
      </div>
    </section>
  );
}
