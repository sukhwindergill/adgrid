import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usePageMeta } from '../../lib/usePageMeta.js';
import { Breadcrumbs } from '../../components/shared/Breadcrumbs.jsx';

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
const h1 = { fontSize: 32, fontWeight: 700, color: '#fff', margin: '0 0 12px', textAlign: 'center' };
const p = { fontSize: 15, lineHeight: 1.7, margin: '0 0 12px', textAlign: 'center' };
const promise = {
  ...p,
  marginTop: 24,
  padding: '14px 18px',
  background: 'rgba(123,47,255,0.1)',
  border: '1px solid rgba(123,47,255,0.3)',
  borderRadius: 10,
  color: '#fff',
};
const h2 = { fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#B79CFF', margin: '36px 0 14px' };
const list = { listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 };
const item = {
  padding: '14px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)', fontSize: 14, lineHeight: 1.6,
};
const itemTitle = { color: '#fff', fontWeight: 600, display: 'block', marginBottom: 2 };
const actions = { display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 32 };
const btn = {
  display: 'inline-block', padding: '13px 26px', borderRadius: 8, border: 'none', cursor: 'pointer',
  background: '#7B2FFF', color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: 15,
  fontFamily: 'inherit',
};
const btnSecondary = { ...btn, background: 'transparent', border: '1px solid rgba(255,255,255,0.18)' };

// What someone can usefully do while waiting, per side of the marketplace.
// Only lists things that exist today -- no referral credit is promised.
const NEXT_STEPS = {
  operator: {
    intro: "We'll be in touch as we onboard screens in your city. Here's how to get a head start.",
    steps: [
      ['Pick your screen', 'Any landscape screen with an internet connection works: a commercial display, a spare TV or existing signage.'],
      ['Count your foot traffic', "A rough daily visitor count per screen is the one number you'll need at setup. It sets what advertisers see."],
      ['Estimate your earnings', <>Try the <Link to="/#earnings" style={{ color: '#B79CFF' }}>earnings calculator</Link> with your numbers.</>],
    ],
    shareText: 'Know a venue with a screen? AdGrid pays operators 70% of what advertisers spend.',
  },
  advertiser: {
    intro: "We'll be in touch as screens go live in your city. Here's how to be ready to book on day one.",
    steps: [
      ['Get your artwork ready', 'A landscape 1920 × 1080 image or short video. Each screen lists its exact specs when you book.'],
      ['Leave room for a QR code', 'Each campaign gets a trackable QR code so you can see scans by screen and by hour.'],
      ['Think local', 'Pick the neighbourhoods and venue types your customers actually visit: gyms, cafés, salons.'],
    ],
    shareText: 'Know a venue owner with a screen? They can earn from it on AdGrid.',
  },
};

function ShareButton({ text }) {
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
      {copied ? 'Link copied' : 'Share AdGrid'}
    </button>
  );
}

export function ThankYou() {
  usePageMeta({
    title: 'Thank You | AdGrid',
    description: "You're on the AdGrid waitlist. We'll be in touch as we onboard operators and advertisers in your city.",
  });
  const [params] = useSearchParams();
  const role = params.get('role') === 'advertiser' ? 'advertiser' : 'operator';
  const { intro, steps, shareText } = NEXT_STEPS[role];

  return (
    <div id="main-content" style={page}>
      <div style={inner}>
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Thank you' }]} />
        <h1 style={h1}>You're on the list.</h1>
        <p style={p}>{intro}</p>
        <p style={promise}>We'll respond within 2 business days.</p>

        <h2 style={h2}>While you wait</h2>
        <ol style={list}>
          {steps.map(([title, body]) => (
            <li key={title} style={item}>
              <span style={itemTitle}>{title}</span>
              {body}
            </li>
          ))}
        </ol>

        <div style={actions}>
          <ShareButton text={shareText} />
          <Link to="/" style={btn}>Back to home</Link>
        </div>
      </div>
    </div>
  );
}
