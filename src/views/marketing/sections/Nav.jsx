import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SiteSearch } from './SiteSearch.jsx';
import { useT } from '../../../i18n/useT.js';
import { LanguageSwitcher } from '../../../i18n/LanguageSwitcher.jsx';

export function Nav({ onScrollTo, onLogin, onSignup }) {
  const { t } = useT();
  const [menuOpen, setMenuOpen] = useState(false);

  const go = id => { setMenuOpen(false); onScrollTo(id); };

  return (
    <nav className="mnav">
      <div className="inner">
        <div className="logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>AdGrid</div>
        <div className="nav-mid">
          <button className="nl" onClick={() => go('operators')}>{t('marketing.nav.forOperators')}</button>
          <button className="nl" onClick={() => go('advertisers')}>{t('marketing.nav.forAdvertisers')}</button>
          <button className="nl" onClick={() => go('how')}>{t('marketing.nav.howItWorks')}</button>
          <button className="nl" onClick={() => go('faq')}>{t('marketing.nav.faq')}</button>
          <Link className="nl" to="/screens" style={{ textDecoration: 'none' }}>{t('marketing.nav.screens')}</Link>
        </div>
        <div className="nav-search-wrap">
          <SiteSearch onScrollTo={go} />
        </div>
        <div className="nav-spacer" />
        <LanguageSwitcher className="nl nav-desktop-only" />
        <button className="nl nav-desktop-only" onClick={onLogin}>{t('marketing.nav.signIn')}</button>
        <button className="btn-p nav-desktop-only" onClick={onSignup}>{t('marketing.nav.getStarted')}</button>
        {/* Hamburger — mobile only */}
        <button
          className="nav-burger"
          aria-label={menuOpen ? t('marketing.nav.closeMenu') : t('marketing.nav.openMenu')}
          onClick={() => setMenuOpen(o => !o)}
        >
          <span /><span /><span />
        </button>
      </div>
      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="nav-mobile-menu">
          <div style={{ padding: '0 12px 12px' }}>
            <SiteSearch onScrollTo={go} />
          </div>
          <button className="nl" onClick={() => go('operators')}>{t('marketing.nav.forOperators')}</button>
          <button className="nl" onClick={() => go('advertisers')}>{t('marketing.nav.forAdvertisers')}</button>
          <button className="nl" onClick={() => go('how')}>{t('marketing.nav.howItWorks')}</button>
          <Link className="nl" to="/screens" style={{ textDecoration: 'none' }}>{t('marketing.nav.screens')}</Link>
          <hr className="nav-divider" />
          <LanguageSwitcher className="nl" />
          <button className="nl" onClick={() => { setMenuOpen(false); onLogin(); }}>{t('marketing.nav.signIn')}</button>
          <button className="btn-p" style={{ margin: '8px 12px 12px' }} onClick={() => { setMenuOpen(false); onSignup(); }}>{t('marketing.nav.getStarted')}</button>
        </div>
      )}
    </nav>
  );
}
