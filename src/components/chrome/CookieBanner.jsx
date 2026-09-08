import { useState } from 'react';

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

export function CookieBanner() {
  const [dismissed, setDismissed] = useState(hasAcknowledged);

  if (dismissed) return null;

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // Best effort -- if storage isn't available the banner just
      // reappears next visit, which is an acceptable fallback.
    }
    setDismissed(true);
  }

  return (
    <div className="cookie-banner" role="region" aria-label="Cookie notice">
      <span>We use minimal cookies to keep you signed in and remember your preferences.</span>
      <button type="button" className="cookie-banner-dismiss" onClick={dismiss}>Got it</button>
    </div>
  );
}
