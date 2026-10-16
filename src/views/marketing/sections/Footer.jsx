import { Link } from 'react-router-dom';
import { useT } from '../../../i18n/useT.js';

export function Footer({ onLogin, onScrollTo }) {
  const { t } = useT();
  return (
    <footer className="mfooter">
      <div className="inner">
        <div className="top">
          <div>
            <div className="logo">AdGrid</div>
            <p className="tagline">{t('marketing.footer.tagline')}</p>
          </div>
          <div className="cols">
            <div className="col">
              <h5>{t('marketing.footer.platform')}</h5>
              <button onClick={() => onScrollTo('operators')}>{t('marketing.nav.forOperators')}</button>
              <button onClick={() => onScrollTo('advertisers')}>{t('marketing.nav.forAdvertisers')}</button>
              <button onClick={() => onScrollTo('how')}>{t('marketing.nav.howItWorks')}</button>
              <button onClick={() => onScrollTo('faq')}>{t('marketing.nav.faq')}</button>
            </div>
            <div className="col">
              <h5>{t('marketing.footer.account')}</h5>
              <button onClick={onLogin}>{t('marketing.nav.signIn')}</button>
              <button onClick={() => onScrollTo('waitlist-form')}>{t('marketing.footer.joinWaitlist')}</button>
            </div>
            <div className="col">
              <h5>{t('marketing.footer.legal')}</h5>
              <Link to="/privacy">{t('marketing.footer.privacy')}</Link>
              <Link to="/terms">{t('marketing.footer.terms')}</Link>
              <Link to="/cookies">{t('marketing.footer.cookies')}</Link>
              <Link to="/refunds">{t('marketing.footer.refunds')}</Link>
            </div>
          </div>
        </div>
        <div className="base">
          <span>© {new Date().getFullYear()} AdGrid</span>
          <span>{t('marketing.footer.madeIn')}</span>
        </div>
      </div>
    </footer>
  );
}
