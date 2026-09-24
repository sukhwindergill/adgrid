import { useState } from 'react';
import { Link } from 'react-router-dom';
import { analyticsConfigured, getConsent, setConsent } from '../../lib/analytics.js';
import { usePageMeta } from '../../lib/usePageMeta.js';
import { Breadcrumbs } from '../../components/shared/Breadcrumbs.jsx';

const page = {
  minHeight: '100vh',
  background: '#0b0d12',
  color: 'rgba(255,255,255,0.85)',
  fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
  padding: '48px 24px',
};
const inner = { maxWidth: 760, margin: '0 auto' };
const h1 = { fontSize: 32, fontWeight: 700, color: '#fff', margin: '0 0 8px' };
const h2 = { fontSize: 20, fontWeight: 600, color: '#fff', margin: '32px 0 8px' };
const p = { fontSize: 15, lineHeight: 1.7, margin: '0 0 12px' };

const choiceBtn = {
  padding: '9px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  fontFamily: 'inherit', border: '1px solid rgba(255,255,255,0.25)', background: 'transparent', color: '#fff',
};

// Lets visitors change or withdraw their analytics choice after the banner
// is gone. When analytics isn't configured there is nothing to choose.
function AnalyticsChoice() {
  const [consent, setLocal] = useState(getConsent);
  if (!analyticsConfigured()) {
    return <p style={p}>Product analytics is currently turned off for everyone, so there is nothing to choose.</p>;
  }
  const choose = value => { setConsent(value); setLocal(value); };
  return (
    <>
      <p style={p} aria-live="polite">
        Product analytics is <strong>{consent === 'granted' ? 'on' : 'off'}</strong> for this browser.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '0 0 12px' }}>
        <button type="button" style={choiceBtn} disabled={consent === 'granted'} onClick={() => choose('granted')}>Turn on</button>
        <button type="button" style={choiceBtn} disabled={consent !== 'granted'} onClick={() => choose('denied')}>Turn off</button>
      </div>
    </>
  );
}

export function CookiePolicy() {
  usePageMeta({
    title: 'Cookie Policy | AdGrid',
    description: 'How AdGrid uses cookies and similar storage technologies.',
  });
  return (
    <div id="main-content" style={page}>
      <div style={inner}>
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Cookie Policy' }]} />
        <h1 style={h1}>Cookie Policy</h1>
        <p style={{ ...p, color: 'rgba(255,255,255,0.5)' }}>Last updated: September 24, 2026</p>

        <h2 style={h2}>Short version</h2>
        <p style={p}>
          AdGrid does not set cookies. We use browser storage to keep you signed in, and,
          only if you say yes, product analytics to see how people use the site. We do not
          use advertising cookies, tracking pixels, or cross-site trackers.
        </p>

        <h2 style={h2}>What we use instead of cookies</h2>
        <p style={p}>
          <strong>Local storage (strictly necessary):</strong> when you sign in, your session
          token is kept in your browser's local storage so you stay logged in between visits.
          This value is never transmitted to any third party and is cleared when you sign out
          or clear your browser data.
        </p>
        <p style={p}>
          <strong>Product analytics (optional, off unless you accept):</strong> if you
          choose "Accept" in our cookie banner, PostHog, our analytics provider, stores a
          random identifier in your browser's local storage and records pages viewed and a
          few product events, as described in our{' '}
          <Link to="/privacy" style={{ color: '#a78bfa' }}>Privacy Policy</Link>. If you
          choose "Essential only", or never answer, the analytics script is not loaded at all.
        </p>
        <p style={p}>
          We do not use tracking pixels, advertising cookies, session-replay scripts, or any
          cross-site tracking technology. If a screen operator's venue uses the optional
          anonymous audience-measurement camera described in our{' '}
          <Link to="/privacy" style={{ color: '#a78bfa' }}>Privacy Policy</Link>, it runs
          entirely on-device at the screen and involves no cookies or browser storage at all.
        </p>

        <h2 style={h2}>Third-party services</h2>
        <p style={p}>
          Payments (Stripe), our database and authentication (Supabase), and transactional
          email (Resend) may set their own strictly necessary cookies or storage when you
          interact directly with their hosted checkout or login flows. These are governed by
          each provider's own cookie and privacy policy, not by AdGrid.
        </p>

        <h2 style={h2}>Your choice</h2>
        <AnalyticsChoice />

        <h2 style={h2}>If this changes</h2>
        <p style={p}>
          If we add any other non-essential storage, such as advertising, we will update this
          page and ask for your consent before using it.
        </p>

        <h2 style={h2}>Contact</h2>
        <p style={p}>
          Questions about this policy:{' '}
          <a href="mailto:privacy@adgrid.io" style={{ color: '#a78bfa' }}>privacy@adgrid.io</a>
        </p>

        <p style={{ ...p, marginTop: 32, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 24 }}>
          Also see our <Link to="/privacy" style={{ color: '#a78bfa' }}>Privacy Policy</Link> and{' '}
          <Link to="/terms" style={{ color: '#a78bfa' }}>Terms of Service</Link>.
        </p>
      </div>
    </div>
  );
}
