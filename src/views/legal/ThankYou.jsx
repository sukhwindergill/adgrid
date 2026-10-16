import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usePageMeta } from '../../lib/usePageMeta.js';
import { Breadcrumbs } from '../../components/shared/Breadcrumbs.jsx';
import { useT } from '../../i18n/useT.js';
import { T, C } from '../../design/tokens.js';

const page = {
  minHeight: '100vh',
  background: '#0b0d12',
  color: 'rgba(255,255,255,0.85)',
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  padding: '48px 24px',
  display: 'flex',
  alignItems: 'center',
};
const inner = { maxWidth: 560, margin: '0 auto', width: '100%' };
const h1 = { fontSize: T.display, fontWeight: 700, color: C.white, margin: '0 0 12px', textAlign: 'center' };
const p = { fontSize: T.lg, lineHeight: 1.7, margin: '0 0 12px', textAlign: 'center' };
const promise = {
  ...p,
  marginTop: 24,
  padding: '14px 18px',
  background: 'rgba(123,47,255,0.1)',
  border: '1px solid rgba(123,47,255,0.3)',
  borderRadius: 10,
  color: C.white,
};
const h2 = { fontSize: T.base, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#B79CFF', margin: '36px 0 14px' };
const list = { listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 };
const item = {
  padding: '14px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)', fontSize: T.md, lineHeight: 1.6,
};
const itemTitle = { color: C.white, fontWeight: 600, display: 'block', marginBottom: 2 };
const actions = { display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 32 };
const btn = {
  display: 'inline-block', padding: '13px 26px', borderRadius: 8, border: 'none', cursor: 'pointer',
  background: '#7B2FFF', color: C.white, textDecoration: 'none', fontWeight: 600, fontSize: T.lg,
  fontFamily: 'inherit',
};
const btnSecondary = { ...btn, background: 'transparent', border: '1px solid rgba(255,255,255,0.18)' };

// What someone can usefully do while waiting, per side of the marketplace.
// Only lists things that exist today -- no referral credit is promised.
// Step text lives in src/locales under legal.thankYou.<role>.steps.
const NEXT_STEPS = {
  operator: ['screen', 'traffic', 'earnings'],
  advertiser: ['artwork', 'qr', 'local'],
};

function ShareButton({ text }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/`;

  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'AdGrid', text, url }); } catch { /* dismissed */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* clipboard blocked; nothing useful to fall back to */ }
  };

  return (
    <button type="button" style={btnSecondary} onClick={share}>
      {copied ? t('legal.thankYou.copied') : t('legal.thankYou.share')}
    </button>
  );
}

export function ThankYou() {
  const { t, tx } = useT();
  usePageMeta({
    title: t('legal.thankYou.metaTitle'),
    description: t('legal.thankYou.metaDescription'),
  });
  const [params] = useSearchParams();
  const role = params.get('role') === 'advertiser' ? 'advertiser' : 'operator';
  const ns = `legal.thankYou.${role}`;
  const calcLink = chunk => <Link to="/#earnings" style={{ color: '#B79CFF' }}>{chunk}</Link>;

  return (
    <div id="main-content" style={page}>
      <div style={inner}>
        <Breadcrumbs items={[{ label: t('legal.home'), to: '/' }, { label: t('legal.thankYou.breadcrumb') }]} />
        <h1 style={h1}>{t('legal.thankYou.heading')}</h1>
        <p style={p}>{t(`${ns}.intro`)}</p>
        <p style={promise}>{t('legal.thankYou.promise')}</p>

        <h2 style={h2}>{t('legal.thankYou.whileYouWait')}</h2>
        <ol style={list}>
          {NEXT_STEPS[role].map(step => (
            <li key={step} style={item}>
              <span style={itemTitle}>{t(`${ns}.steps.${step}.title`)}</span>
              {tx(`${ns}.steps.${step}.body`, { calc: calcLink })}
            </li>
          ))}
        </ol>

        <div style={actions}>
          <ShareButton text={t(`${ns}.shareText`)} />
          <Link to="/" style={btn}>{t('legal.thankYou.backHome')}</Link>
        </div>
      </div>
    </div>
  );
}
