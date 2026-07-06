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

export function PrivacyPolicy() {
  return (
    <div style={page}>
      <div style={inner}>
        <h1 style={h1}>Privacy Policy</h1>
        <p style={{ ...p, color: 'rgba(255,255,255,0.5)' }}>Last updated: June 29, 2026</p>

        <h2 style={h2}>Who we are</h2>
        <p style={p}>
          AdGrid Inc. ("AdGrid", "we", "us") operates a digital out-of-home advertising
          platform that connects advertisers with screen owners. Our registered address is
          available at legal@adgrid.io.
        </p>

        <h2 style={h2}>Data we collect</h2>
        <p style={p}>
          <strong>Account holders (advertisers and screen operators):</strong> name, email
          address, business name, and billing information. Payment details are processed
          and stored by Stripe — AdGrid never stores raw card numbers.
        </p>
        <p style={p}>
          <strong>Screen telemetry:</strong> whether a screen is online or offline, which
          campaign was playing at a given time, and periodic heartbeat timestamps.
        </p>
        <p style={p}>
          <strong>Optional audience-measurement camera:</strong> some Operators enable an
          add-on camera at their venue to estimate anonymous aggregate audience size and
          composition. All face detection and age/gender estimation runs on-device at the
          screen; raw camera frames are never stored or transmitted anywhere. Only
          aggregate, anonymized statistics for each ~30-second window — approximate
          person count, dwell time, attention score, and age/gender bracket counts — are
          sent to AdGrid. We never receive images, video, biometric templates, or any data
          that identifies an individual, and screens do not track the same person across
          visits. Operators who enable this feature are contractually required to post a
          visible notice at the venue disclosing that anonymous audience analytics are in
          use.
        </p>
        <p style={p}>
          <strong>QR-code scans:</strong> when a viewer scans an ad's QR code we record
          a scan event containing the timestamp, the campaign ID, and the screen ID, then
          redirect the viewer to the advertiser's destination URL. We do not set tracking
          cookies on the destination site and do not receive any data about what the viewer
          does after the redirect.
        </p>
        <p style={p}>
          <strong>Usage data:</strong> standard server logs (IP address, browser type,
          pages visited) retained for up to 90 days for security and debugging purposes.
        </p>

        <h2 style={h2}>How we use your data</h2>
        <p style={p}>
          We use account data to provide the AdGrid service, process payments, send
          transactional emails (campaign approvals, payment receipts, payout notifications),
          and respond to support requests. We do not sell personal data to third parties or
          use it for behavioural advertising.
        </p>

        <h2 style={h2}>Data retention</h2>
        <p style={p}>
          Account data is retained for the life of your account and for 90 days following
          account deletion, after which it is permanently deleted. Screen telemetry and
          heartbeat records are retained for 12 months. QR scan events are retained for
          24 months to support campaign analytics. Stripe retains payment records
          independently per their own privacy policy.
        </p>

        <h2 style={h2}>Your rights</h2>
        <p style={p}>
          If you are located in Canada, the EU, or the UK you have the right to access,
          correct, or delete your personal data, and to withdraw consent where processing
          is consent-based. To exercise any of these rights, email us at
          {' '}<a href="mailto:privacy@adgrid.io" style={{ color: '#7c3aed' }}>privacy@adgrid.io</a>.
          We will respond within 30 days.
        </p>

        <h2 style={h2}>Cookies</h2>
        <p style={p}>
          AdGrid uses strictly necessary session cookies for authentication. We do not use
          third-party analytics or advertising cookies.
        </p>

        <h2 style={h2}>Third-party services</h2>
        <p style={p}>
          We use Stripe for payment processing, Supabase for database and authentication,
          and Resend for transactional email. Each service operates under its own privacy
          policy and data processing agreement.
        </p>

        <h2 style={h2}>Changes to this policy</h2>
        <p style={p}>
          We may update this policy from time to time. Material changes will be notified
          by email to account holders at least 14 days before taking effect.
        </p>

        <h2 style={h2}>Contact</h2>
        <p style={p}>
          For privacy questions or data requests:{' '}
          <a href="mailto:privacy@adgrid.io" style={{ color: '#7c3aed' }}>privacy@adgrid.io</a>
        </p>
      </div>
    </div>
  );
}
