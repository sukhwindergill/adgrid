import { useState } from 'react';
import { analyticsConfigured, getConsent, setConsent } from '../../lib/analytics.js';
import { useT } from '../../i18n/useT.js';

const STORAGE_KEY = 'adgrid_cookie_ack';

function hasAcknowledged() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    // Storage unavailable (e.g. private browsing) -- fall back to always
    // showing the banner rather than crashing.
    return false;
  }
}

function acknowledge() {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // Best effort -- if storage isn't available the banner just
    // reappears next visit, which is an acceptable fallback.
  }
}

// Two modes. Without analytics configured it's a notice ("Got it"), since
// only essential storage is used. With VITE_POSTHOG_KEY set it asks for
// opt-in consent, and analytics stays off unless the visitor accepts.
export function CookieBanner() {
  const { t } = useT();
  const askConsent = analyticsConfigured();
  const [dismissed, setDismissed] = useState(() => (askConsent ? getConsent() !== null : hasAcknowledged()));

  if (dismissed) return null;

  function choose(consent) {
    acknowledge();
    if (consent) setConsent(consent);
    setDismissed(true);
  }

  if (!askConsent) {
    return (
      <div className="cookie-banner" role="region" aria-label={t('shell.cookie.noticeLabel')}>
        <span>{t('shell.cookie.notice')}</span>
        <button type="button" className="cookie-banner-dismiss" onClick={() => choose(null)}>{t('shell.cookie.gotIt')}</button>
      </div>
    );
  }

  return (
    <div className="cookie-banner" role="region" aria-label={t('shell.cookie.consentLabel')}>
      <span>{t('shell.cookie.consent')}</span>
      <span style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button type="button" className="cookie-banner-dismiss secondary" onClick={() => choose('denied')}>{t('shell.cookie.essentialOnly')}</button>
        <button type="button" className="cookie-banner-dismiss" onClick={() => choose('granted')}>{t('shell.cookie.accept')}</button>
      </span>
    </div>
  );
}
