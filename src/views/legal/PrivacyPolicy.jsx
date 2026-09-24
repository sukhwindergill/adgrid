import { Link } from 'react-router-dom';
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

export function PrivacyPolicy() {
  usePageMeta({
    title: 'Privacy Policy | AdGrid',
    description: 'How AdGrid collects, uses, and protects the data of advertisers, screen operators, and website visitors.',
  });
  return (
    <div id="main-content" style={page}>
      <div style={inner}>
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Privacy Policy' }]} />
        <h1 style={h1}>Privacy Policy</h1>
        <p style={{ ...p, color: 'rgba(255,255,255,0.5)' }}>Last updated: September 24, 2026</p>

        <h2 style={h2}>Who we are</h2>
        <p style={p}>
          AdGrid Inc. ("AdGrid", "we", "us") operates a digital out-of-home advertising
          platform that connects advertisers with screen owners, currently serving Toronto
          and Vancouver. Our registered address is available at legal@adgrid.io. AdGrid is
          based in Canada, and we handle personal information under the federal{' '}
          <em>Personal Information Protection and Electronic Documents Act</em> (PIPEDA).
        </p>
        <p style={p}>
          <strong>Privacy Officer:</strong> AdGrid's designated Privacy Officer is
          accountable for our compliance with PIPEDA and is the first point of contact for
          any question, concern, or complaint about how we handle your personal
          information: <a href="mailto:privacy@adgrid.io" style={{ color: '#a78bfa' }}>privacy@adgrid.io</a>.
        </p>

        <h2 style={h2}>Data we collect, and why</h2>
        <p style={p}>
          Under PIPEDA we only collect personal information for identified purposes, with
          your knowledge and consent (implied by creating an account, or express where we
          say so below). Each category below names why we collect it — we do not use it for
          any other purpose without asking first.
        </p>
        <p style={p}>
          <strong>Account holders (advertisers and screen operators):</strong> name, email
          address, business name, and billing information, collected when you create an
          account, to identify you, operate your account, and process payment. Payment
          details are processed and stored by Stripe. AdGrid never stores raw card numbers.
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
          aggregate, anonymized statistics for each ~30-second window (approximate
          person count, dwell time, attention score, and age/gender bracket counts) are
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
        <p style={p}>
          <strong>Product analytics (only if you opt in):</strong> if you choose "Accept"
          in our cookie banner, we record how the site and app are used so we can see where
          people get stuck and improve them. This covers pages viewed, the browser and
          device type, approximate location derived from your IP address, and a small set
          of product events: joining the waitlist, submitting the sign-up form, using the
          earnings calculator, and moving through or submitting the campaign builder. Once
          you are signed in, these events are linked to your AdGrid account ID, never your
          name or email. We do not record your screen, keystrokes, or what you type into
          forms. If you choose "Essential only", or never answer, none of this is collected.
          You can change your choice at any time on our{' '}
          <Link to="/cookies" style={{ color: '#a78bfa' }}>Cookie Policy</Link> page.
        </p>
        <p style={p}>
          <strong>Marketplace messages:</strong> when an advertiser and a screen operator
          message each other about an exclusive placement listing through AdGrid's
          marketplace, we store the message content, sender, and timestamp so both parties
          can see the conversation. We do not read or use this content for any purpose
          other than delivering it and, where relevant, resolving a support request.
        </p>

        <p style={p}>
          <strong>Waitlist and contact forms:</strong> if you join our waitlist (as a screen
          operator or an advertiser) or contact us, we collect the name, email, company,
          city, and other details you submit, so we can respond to your inquiry and follow up about onboarding. We do
          not share this information with third parties and use it only for that purpose.
        </p>

        <h2 style={h2}>How we use your data</h2>
        <p style={p}>
          We use account data to provide the AdGrid service, process payments, send
          transactional emails (campaign approvals, payment receipts, payout notifications),
          and respond to support requests. If you opt in to product analytics, we use that
          data only to understand and improve AdGrid's own website and app. We do not sell
          personal data to third parties or use it for behavioural advertising.
        </p>

        <h2 style={h2}>Data retention</h2>
        <p style={p}>
          Account data (including marketplace messages) is retained for the life of your
          account and for 90 days following account deletion, after which it is permanently
          deleted. Screen telemetry,
          heartbeat records, and aggregate audience-measurement statistics are retained for
          12 months, then automatically deleted. QR scan events and conversion records
          (from our conversion pixel or server postback) are retained for 24 months
          to support campaign analytics, then automatically deleted. Product analytics data
          (if you opted in) is retained for 12 months, then deleted. Stripe retains payment
          records independently per their own privacy policy.
        </p>

        <h2 style={h2}>Your rights</h2>
        <p style={p}>
          If you are located in Canada, the EU, or the UK you have the right to access,
          correct, or delete your personal data, and to withdraw consent where processing
          is consent-based. To exercise any of these rights, email our Privacy Officer at
          {' '}<a href="mailto:privacy@adgrid.io" style={{ color: '#a78bfa' }}>privacy@adgrid.io</a>.
          We will respond within 30 days, as required by PIPEDA.
        </p>
        <p style={p}>
          If you're not satisfied with how we've handled your request or your personal
          information, you can file a complaint with the{' '}
          <a href="https://www.priv.gc.ca" target="_blank" rel="noreferrer" style={{ color: '#a78bfa' }}>
            Office of the Privacy Commissioner of Canada
          </a>, the federal regulator responsible for enforcing PIPEDA.
        </p>

        <h2 style={h2}>Cookies and similar technologies</h2>
        <p style={p}>
          AdGrid does not set any cookies. Your signed-in session is kept in your browser's
          local storage, used only to keep you logged in, and is never shared with third
          parties. If you opt in to product analytics, our analytics provider also keeps a
          random identifier in your browser's local storage so it can tell visits apart.
          We do not use advertising cookies or cross-site trackers. Details are in our{' '}
          <Link to="/cookies" style={{ color: '#a78bfa' }}>Cookie Policy</Link>.
        </p>

        <h2 style={h2}>Third-party services</h2>
        <p style={p}>
          We use Stripe for payment processing, Supabase for database and authentication,
          and Resend for transactional email. If you opt in to product analytics, that data
          is processed by PostHog, Inc. Each service operates under its own privacy policy
          and data processing agreement.
        </p>
        <p style={p}>
          <strong>Storage outside Canada:</strong> some of these providers, including
          PostHog, store data on servers in the United States. Information stored there is
          subject to the laws of that country and may be accessible to its authorities. We
          require each provider to protect your information to a standard comparable to
          PIPEDA.
        </p>

        <h2 style={h2}>Changes to this policy</h2>
        <p style={p}>
          We may update this policy from time to time. Material changes will be notified
          by email to account holders at least 14 days before taking effect.
        </p>

        <h2 style={h2}>Contact</h2>
        <p style={p}>
          For privacy questions or data requests:{' '}
          <a href="mailto:privacy@adgrid.io" style={{ color: '#a78bfa' }}>privacy@adgrid.io</a>
        </p>

        <p style={{ ...p, marginTop: 32, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 24 }}>
          Also see our <Link to="/terms" style={{ color: '#a78bfa' }}>Terms of Service</Link> and{' '}
          <Link to="/cookies" style={{ color: '#a78bfa' }}>Cookie Policy</Link>.
        </p>
      </div>
    </div>
  );
}
