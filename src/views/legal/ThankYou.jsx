import { Link } from 'react-router-dom';
import { usePageMeta } from '../../lib/usePageMeta.js';
import { Breadcrumbs } from '../../components/shared/Breadcrumbs.jsx';

const page = {
  minHeight: '100vh',
  background: '#0b0d12',
  color: 'rgba(255,255,255,0.85)',
  fontFamily: "'Inter', sans-serif",
  padding: '48px 24px',
  display: 'flex',
  alignItems: 'center',
};
const inner = { maxWidth: 560, margin: '0 auto', textAlign: 'center' };
const h1 = { fontSize: 32, fontWeight: 700, color: '#fff', margin: '0 0 12px' };
const p = { fontSize: 15, lineHeight: 1.7, margin: '0 0 12px' };
const promise = {
  ...p,
  marginTop: 24,
  padding: '14px 18px',
  background: 'rgba(123,47,255,0.1)',
  border: '1px solid rgba(123,47,255,0.3)',
  borderRadius: 10,
  color: '#fff',
};
const btn = {
  display: 'inline-block', marginTop: 28, padding: '13px 26px', borderRadius: 8,
  background: '#7B2FFF', color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: 15,
  transition: 'opacity 0.15s',
};

export function ThankYou() {
  usePageMeta({
    title: 'Thank You | AdGrid',
    description: "You're on the AdGrid waitlist. We'll be in touch as we onboard operators and advertisers in your city.",
  });

  return (
    <div id="main-content" style={page}>
      <div style={inner}>
        <div style={{ textAlign: 'left' }}>
          <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Thank you' }]} />
        </div>
        <h1 style={h1}>You're on the list.</h1>
        <p style={p}>
          Thanks for signing up for early access. We'll be in touch with next steps as we
          onboard operators and advertisers in your city.
        </p>
        <p style={promise}>We'll respond within 2 business days.</p>
        <Link to="/" style={btn}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
        >Back to home</Link>
      </div>
    </div>
  );
}
