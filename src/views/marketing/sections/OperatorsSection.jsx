import { useReveal } from './useReveal.js';
import { IconTrend, IconShield, IconChart, IconBolt } from './icons.jsx';
import { useT } from '../../../i18n/useT.js';

const CARDS = [
  [IconTrend, 'pricing'],
  [IconShield, 'control'],
  [IconChart, 'analytics'],
  [IconBolt, 'lockin'],
];

export function OperatorsSection({ onOperatorSignup }) {
  const { t } = useT();
  const [ref, on] = useReveal();
  return (
    <section className="sec lcard-bg" id="operators" ref={ref}>
      <div className="inner">
        <div className={`sticky-split rv ${on ? 'on' : ''}`}>
          <div className="sticky-col">
            <img src="/marketing/venue-barbershop.jpg" alt={t('marketing.operators.imgAlt')}
              loading="lazy" width="1600" height="1073" />
          </div>
          <div className="scroll-col">
            <div className="eyebrow">{t('marketing.operators.eyebrow')}</div>
            <h2 className="sec-h">{t('marketing.operators.heading')}</h2>
            <p className="sec-sub">{t('marketing.operators.sub')}</p>
            <div className="card-grid">
              {CARDS.map(card => {
                const [Icon, key] = card;
                return (
                  <div className="f-card" key={key}>
                    <Icon /><h3>{t(`marketing.operators.cards.${key}.h`)}</h3><p>{t(`marketing.operators.cards.${key}.p`)}</p>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 32 }}>
              <button className="btn-p" onClick={onOperatorSignup}>{t('marketing.cta.listScreens')}</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
