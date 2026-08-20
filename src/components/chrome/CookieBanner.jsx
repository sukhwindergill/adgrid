import { useState } from 'react';
import { C, F } from '../../design/tokens.js';

const STORAGE_KEY = 'adgrid_cookie_ack';

function readAck() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    // localStorage unavailable (private browsing, disabled storage, etc) —
    // fail open: show the banner, don't crash the page.
    return false;
  }
}

export function CookieBanner() {
  const [dismissed, setDismissed] = useState(readAck);

  if (dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore — dismissal just won't persist across reloads
    }
    setDismissed(true);
  };

  return (
    <div className="cookie-banner" style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 400,
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      padding: '14px 20px',
      background: C.text,
      color: '#fff',
      fontFamily: F.sans,
      fontSize: 13,
    }}>
      <span>We use minimal cookies to keep you signed in and remember your preferences.</span>
      <button
        onClick={dismiss}
        style={{
          padding: '6px 16px',
          borderRadius: 999,
          border: 'none',
          background: '#fff',
          color: C.text,
          fontSize: 13,
          fontWeight: 600,
          fontFamily: F.sans,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >Got it</button>
    </div>
  );
}
