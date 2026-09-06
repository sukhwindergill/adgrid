import { Link } from 'react-router-dom';
import { usePageMeta } from '../../lib/usePageMeta.js';
import { Breadcrumbs } from '../../components/shared/Breadcrumbs.jsx';

const page = {
  minHeight: '100vh',
  background: '#0b0d12',
  color: 'rgba(255,255,255,0.85)',
  fontFamily: "'Inter', sans-serif",
  padding: '48px 24px',
};
const inner = { maxWidth: 760, margin: '0 auto' };
const h1 = { fontSize: 32, fontWeight: 700, color: '#fff', margin: '0 0 8px' };
const h2 = { fontSize: 20, fontWeight: 600, color: '#fff', margin: '32px 0 8px' };
const p = { fontSize: 15, lineHeight: 1.7, margin: '0 0 12px' };

export function RefundPolicy() {
  usePageMeta({
    title: 'Refund Policy | AdGrid',
    description: 'When AdGrid issues refunds for advertising campaigns booked through the platform.',
  });
  return (
    <div id="main-content" style={page}>
      <div style={inner}>
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Refund Policy' }]} />
        <h1 style={h1}>Refund Policy</h1>
        <p style={{ ...p, color: 'rgba(255,255,255,0.5)' }}>Last updated: September 5, 2026</p>

        <h2 style={h2}>When a campaign is refundable</h2>
        <p style={p}>
          Your card is charged the full campaign budget when you submit a campaign for
          payment. A campaign only goes live once (a) payment has been captured and (b) the
          screen Operator has approved your creative, or the screen is set to
          auto-approval. If a campaign is cancelled — by you or because an Operator declines
          your content — before any impressions have been served on that screen, you receive
          a full refund of the amount charged for that screen.
        </p>

        <h2 style={h2}>When a campaign is not refundable</h2>
        <p style={p}>
          Once a campaign has begun serving impressions on a screen, the portion of the
          budget already spent on that screen is non-refundable. Content removed by AdGrid
          for violating the Acceptable Use or Advertiser Content Rules in our{' '}
          <Link to="/terms" style={{ color: '#a78bfa' }}>Terms of Service</Link> is not
          refunded.
        </p>

        <h2 style={h2}>How refunds are issued</h2>
        <p style={p}>
          Eligible refunds are returned to your original payment method via Stripe within
          5–10 business days of approval. We do not issue refunds as account credit unless
          you request that instead.
        </p>

        <h2 style={h2}>Operator payouts</h2>
        <p style={p}>
          Where a refund is issued for a campaign that had not yet served impressions, no
          Operator payout is generated for that amount. Refunds do not claw back a payout
          already paid to an Operator for impressions actually served.
        </p>

        <h2 style={h2}>Requesting a refund</h2>
        <p style={p}>
          Email{' '}
          <a href="mailto:billing@adgrid.io" style={{ color: '#a78bfa' }}>billing@adgrid.io</a>{' '}
          with your campaign ID. We respond within 2 business days.
        </p>

        <p style={{ ...p, marginTop: 32, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 24 }}>
          This policy is part of, and should be read together with, our{' '}
          <Link to="/terms" style={{ color: '#a78bfa' }}>Terms of Service</Link>.
        </p>
      </div>
    </div>
  );
}
