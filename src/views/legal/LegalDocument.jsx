import { Link } from 'react-router-dom';
import { usePageMeta } from '../../lib/usePageMeta.js';
import { Breadcrumbs } from '../../components/shared/Breadcrumbs.jsx';
import { rich, useT } from '../../i18n/useT.js';

// Shared renderer for the legal pages. Each page's text lives in the locale
// catalogs under legal.<doc>: title, metaTitle, metaDescription, an array of
// { h, p: [paragraphs] } sections, and a seeAlso footer line. Paragraphs can
// use the inline tags below (<strong>, <terms>…</terms>, {privacyEmail}…).
//
// LEGAL REVIEW: the fr-CA text of every legal page (legal.* in
// src/locales/fr-CA.json) is a working translation and has NOT been reviewed
// by a lawyer. It must be reviewed by Quebec counsel before launch there.

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
const legalP = { fontSize: 15, lineHeight: 1.7, margin: '0 0 12px' };
const linkStyle = { color: '#a78bfa' };

const mail = address => <a href={`mailto:${address}`} style={linkStyle}>{address}</a>;

function inlineVars() {
  return {
    strong: chunk => <strong>{chunk}</strong>,
    em: chunk => <em>{chunk}</em>,
    privacy: chunk => <Link to="/privacy" style={linkStyle}>{chunk}</Link>,
    terms: chunk => <Link to="/terms" style={linkStyle}>{chunk}</Link>,
    cookies: chunk => <Link to="/cookies" style={linkStyle}>{chunk}</Link>,
    refunds: chunk => <Link to="/refunds" style={linkStyle}>{chunk}</Link>,
    opc: chunk => <a href="https://www.priv.gc.ca" target="_blank" rel="noreferrer" style={linkStyle}>{chunk}</a>,
    privacyEmail: mail('privacy@adgrid.io'),
    legalEmail: mail('legal@adgrid.io'),
    billingEmail: mail('billing@adgrid.io'),
  };
}

// `doc` is the catalog key under legal.*; `updated` an ISO date. `slots`
// maps a section's "slot" name to a component rendered in place of its
// paragraphs (the cookie page's analytics toggle).
export function LegalDocument({ doc, updated, slots = {} }) {
  const { t, tx, tList, formatDate } = useT();
  const ns = `legal.${doc}`;
  usePageMeta({ title: t(`${ns}.metaTitle`), description: t(`${ns}.metaDescription`) });
  const vars = inlineVars();

  return (
    <div id="main-content" style={page}>
      <div style={inner}>
        <Breadcrumbs items={[{ label: t('legal.home'), to: '/' }, { label: t(`${ns}.title`) }]} />
        <h1 style={h1}>{t(`${ns}.title`)}</h1>
        <p style={{ ...legalP, color: 'rgba(255,255,255,0.5)' }}>
          {t('legal.lastUpdated', { date: formatDate(updated, { dateStyle: 'long' }) })}
        </p>

        {tList(`${ns}.sections`).map((section, i) => {
          const Slot = section.slot && slots[section.slot];
          return (
            <section key={i}>
              <h2 style={h2}>{section.h}</h2>
              {Slot ? <Slot /> : (section.p ?? []).map((para, j) => <p key={j} style={legalP}>{rich(para, vars)}</p>)}
            </section>
          );
        })}

        <p style={{ ...legalP, marginTop: 32, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 24 }}>
          {tx(`${ns}.seeAlso`, vars)}
        </p>
      </div>
    </div>
  );
}

