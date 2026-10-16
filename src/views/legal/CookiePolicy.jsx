import { useState } from 'react';
import { analyticsConfigured, getConsent, setConsent } from '../../lib/analytics.js';
import { useT } from '../../i18n/useT.js';
import { LegalDocument } from './LegalDocument.jsx';
import { T, C } from '../../design/tokens.js';

// Text lives in src/locales under legal.cookies. The fr-CA version still needs
// review by a lawyer before it is relied on (see LegalDocument.jsx).

const p = { fontSize: T.lg, lineHeight: 1.7, margin: '0 0 12px' };

const choiceBtn = {
  padding: '9px 18px', borderRadius: 8, fontSize: T.md, fontWeight: 600, cursor: 'pointer',
  fontFamily: 'inherit', border: '1px solid rgba(255,255,255,0.25)', background: 'transparent', color: C.white,
};

// Lets visitors change or withdraw their analytics choice after the banner
// is gone. When analytics isn't configured there is nothing to choose.
function AnalyticsChoice() {
  const { t, tx } = useT();
  const [consent, setLocal] = useState(getConsent);
  if (!analyticsConfigured()) {
    return <p style={p}>{t('legal.cookies.choice.unavailable')}</p>;
  }
  const choose = value => { setConsent(value); setLocal(value); };
  return (
    <>
      <p style={p} aria-live="polite">
        {tx('legal.cookies.choice.status', {
          strong: chunk => <strong>{chunk}</strong>,
          state: consent === 'granted' ? t('legal.cookies.choice.on') : t('legal.cookies.choice.off'),
        })}
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '0 0 12px' }}>
        <button type="button" style={choiceBtn} disabled={consent === 'granted'} onClick={() => choose('granted')}>{t('legal.cookies.choice.turnOn')}</button>
        <button type="button" style={choiceBtn} disabled={consent !== 'granted'} onClick={() => choose('denied')}>{t('legal.cookies.choice.turnOff')}</button>
      </div>
    </>
  );
}

export function CookiePolicy() {
  return <LegalDocument doc="cookies" updated="2026-09-24" slots={{ analyticsChoice: AnalyticsChoice }} />;
}
