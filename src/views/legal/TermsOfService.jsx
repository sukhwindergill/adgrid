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

export function TermsOfService() {
  return (
    <div style={page}>
      <div style={inner}>
        <h1 style={h1}>Terms of Service</h1>
        <p style={{ ...p, color: 'rgba(255,255,255,0.5)' }}>Last updated: June 29, 2026</p>

        <h2 style={h2}>1. Acceptance</h2>
        <p style={p}>
          By creating an account or using AdGrid you agree to these Terms of Service
          ("Terms"). If you are using AdGrid on behalf of a business, you represent that
          you have authority to bind that business to these Terms.
        </p>

        <h2 style={h2}>2. The service</h2>
        <p style={p}>
          AdGrid provides a marketplace platform connecting advertisers ("Advertisers")
          who wish to display digital advertising with screen owners and operators
          ("Operators") who make display screens available on the network. AdGrid is not
          a party to individual advertising agreements between Advertisers and Operators
          beyond facilitating the booking and payment flow.
        </p>

        <h2 style={h2}>3. Acceptable use</h2>
        <p style={p}>
          You must not use AdGrid to: violate any applicable law or regulation; infringe
          any third-party intellectual property, privacy, or other rights; transmit
          malware or harmful code; attempt to gain unauthorised access to any part of the
          platform; scrape or systematically extract data; or circumvent any rate limit,
          access control, or security measure.
        </p>

        <h2 style={h2}>4. Advertiser content rules</h2>
        <p style={p}>
          Advertisers are solely responsible for all creative content they submit.
          Content must not be unlawful, deceptive, defamatory, obscene, or discriminatory.
          Regulated categories (alcohol, gambling, cannabis, financial products, health
          claims) require pre-approval and must comply with all applicable advertising
          standards. AdGrid reserves the right to reject or remove any content at its
          discretion without refund if the content violates these rules or applicable law.
        </p>
        <p style={p}>
          Each Operator may set their own content restrictions for their screens. A
          campaign approved by AdGrid may still be declined by an individual Operator;
          payment is only captured after Operator approval (or auto-approval where
          configured).
        </p>

        <h2 style={h2}>5. Payments and refunds</h2>
        <p style={p}>
          Campaign budgets are charged in full at the time the Operator approves the
          campaign. All charges are processed by Stripe and are non-refundable except
          where a campaign is cancelled before any impressions are served, in which case a
          full refund will be issued within 5–10 business days. AdGrid charges a platform
          fee on each transaction as disclosed at checkout.
        </p>

        <h2 style={h2}>6. Operator responsibilities</h2>
        <p style={p}>
          Operators are responsible for keeping their screens online, displaying approved
          campaigns accurately, and maintaining any hardware required to run the AdGrid
          display player. Operators receive payouts via Stripe Connect on a schedule
          displayed in their dashboard, less AdGrid's platform fee.
        </p>

        <h2 style={h2}>7. Limitation of liability</h2>
        <p style={p}>
          To the maximum extent permitted by applicable law, AdGrid's total liability for
          any claim arising out of or relating to these Terms or the service is limited to
          the greater of (a) the amounts you paid AdGrid in the 3 months preceding the
          claim or (b) CAD $100. AdGrid is not liable for indirect, incidental, special,
          consequential, or punitive damages, including lost profits, even if advised of
          the possibility.
        </p>

        <h2 style={h2}>8. Disclaimer of warranties</h2>
        <p style={p}>
          The AdGrid platform is provided "as is" without warranty of any kind. We do not
          warrant that the service will be uninterrupted, error-free, or that any
          particular campaign will achieve any specific reach, impression count, or
          business result.
        </p>

        <h2 style={h2}>9. Governing law</h2>
        <p style={p}>
          These Terms are governed by the laws of the Province of Ontario and the federal
          laws of Canada applicable therein, without regard to conflict of law principles.
          Disputes will be resolved in the courts of Ontario, Canada.
        </p>

        <h2 style={h2}>10. Changes</h2>
        <p style={p}>
          We may update these Terms from time to time. We will notify account holders by
          email at least 14 days before material changes take effect. Continued use of the
          service after the effective date constitutes acceptance.
        </p>

        <h2 style={h2}>11. Contact</h2>
        <p style={p}>
          Questions about these Terms:{' '}
          <a href="mailto:legal@adgrid.io" style={{ color: '#7c3aed' }}>legal@adgrid.io</a>
        </p>
      </div>
    </div>
  );
}
