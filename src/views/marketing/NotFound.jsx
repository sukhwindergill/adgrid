import { Link } from 'react-router-dom';
import './marketing.css';
import { usePageMeta } from '../../lib/usePageMeta.js';
import { useT } from '../../i18n/useT.js';

export function NotFound() {
  const { t } = useT();
  usePageMeta({
    title: t('marketing.notFound.metaTitle'),
    description: t('marketing.notFound.metaDescription'),
  });

  return (
    <div id="main-content" className="mktg" style={{ background: '#0A0A0F', minHeight: '100vh' }}>
      <section className="sec dark" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
        <div className="inner" style={{ textAlign: 'center', maxWidth: 560 }}>
          <div className="eyebrow">404</div>
          <h1 className="sec-h">{t('marketing.notFound.heading')}</h1>
          <p className="sec-sub" style={{ margin: '14px auto 32px' }}>
            {t('marketing.notFound.body')}
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/" className="btn-p">{t('marketing.notFound.home')}</Link>
            <Link to="/#faq" className="btn-s">{t('marketing.notFound.faq')}</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
