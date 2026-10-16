import { useEffect, useState } from 'react';
import { useParallax } from './useParallax.js';
import { useT } from '../../../i18n/useT.js';

// Below this, a live-screen count reads as "barely anyone is here" rather
// than social proof, so the stat is hidden until the network is bigger.
const MIN_LIVE_COUNT_TO_SHOW = 25;

export function Hero({ onOperatorSignup, onAdvertiserSignup }) {
  const { t, tx, formatNumber } = useT();
  const [liveCount, setLiveCount] = useState(null);
  const [mounted, setMounted] = useState(false);
  const parallaxRef = useParallax(0.15);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    import('../../../lib/supabase.js').then(({ supabase }) => {
      // Anon can't read screens (RLS only exposes invited ones), so the
      // count comes from a narrow RPC that also excludes demo screens.
      supabase.rpc('live_screen_count')
        .then(({ data }) => { if (typeof data === 'number') setLiveCount(data); });
    }).catch(() => {});
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <section className="hero">
      <div className={`inner rv ${mounted ? 'on' : ''}`}>
        <div>
          <div className="eyebrow">{t('marketing.hero.eyebrow')}</div>
          <h1 className="hero-h">
            {tx('marketing.hero.heading', { accent: chunk => <span className="accent">{chunk}</span> })}
          </h1>
          <p className="hero-sub">
            {t('marketing.hero.sub')}
          </p>
          <div className="hero-ctas">
            <button className="btn-p" onClick={onOperatorSignup}>{t('marketing.cta.listScreens')}</button>
            <button className="btn-s" onClick={onAdvertiserSignup}>{t('marketing.cta.bookCampaign')}</button>
          </div>
          <div className="hero-stats">
            {typeof liveCount === 'number' && liveCount >= MIN_LIVE_COUNT_TO_SHOW && (
              <div className="hero-stat">
                <div className="num">{formatNumber(liveCount)}</div>
                <div className="lbl">{t('marketing.hero.liveNow')}</div>
              </div>
            )}
            <div className="hero-stat">
              <div className="num">{t('marketing.hero.cities')}</div>
              <div className="lbl">{t('marketing.hero.launchCities')}</div>
            </div>
            <div className="hero-stat">
              <div className="num">8</div>
              <div className="lbl">{t('marketing.hero.venueCategories')}</div>
            </div>
          </div>
        </div>
        <div className="hero-img-wrap" ref={parallaxRef}>
          <img className="hero-img" src="/marketing/hero-gym.jpg"
            alt={t('marketing.hero.imgAlt')} width="1600" height="1073" fetchPriority="high" />
        </div>
      </div>
    </section>
  );
}
