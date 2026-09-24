import { useState } from 'react';
import { analyticsConfigured, getConsent, setConsent } from '../../lib/analytics.js';

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
      <div className="cookie-banner" role="region" aria-label="Cookie notice">
        <span>We use minimal cookies to keep you signed in and remember your preferences.</span>
        <button type="button" className="cookie-banner-dismiss" onClick={() => choose(null)}>Got it</button>
      </div>
    );
  }

  return (
    <div className="cookie-banner" role="region" aria-label="Cookie consent">
      <span>We use essential storage to keep you signed in. With your OK, we also use analytics to see which pages help people most.</span>
      <span style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button type="button" className="cookie-banner-dismiss secondary" onClick={() => choose('denied')}>Essential only</button>
        <button type="button" className="cookie-banner-dismiss" onClick={() => choose('granted')}>Accept</button>
      </span>
    </div>
  );
}
