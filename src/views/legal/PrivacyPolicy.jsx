// DRAFT legal page — placeholder structure pending counsel-supplied copy.
// TODO(legal): replace all section copy with reviewed language before removing
// the draft banner.

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
const banner = {
  background: 'rgba(255,180,0,0.12)',
  border: '1px solid rgba(255,180,0,0.5)',
  borderRadius: 8,
  padding: '12px 16px',
  margin: '0 0 32px',
  color: '#ffb400',
  fontSize: 14,
  fontWeight: 600,
};

export function PrivacyPolicy() {
  return (
    <div style={page}>
      <div style={inner}>
        <h1 style={h1}>Privacy Policy</h1>
        <p style={{ ...p, color: 'rgba(255,255,255,0.5)' }}>Last updated: June 11, 2026</p>

        <div style={banner}>
          DRAFT — pending legal review. This is placeholder text and not a final policy.
        </div>

        <h2 style={h2}>Data we collect</h2>
        {/* TODO(legal): confirm this list stays in sync with actual collection. */}
        <p style={p}>
          AdGrid operates digital advertising screens. The screens themselves do not
          use cameras, sensors, or computer vision, and do not identify or count
          individual viewers. Data we process today:
        </p>
        <p style={p}>
          • Account data for advertisers and screen operators (name, email, billing
          details processed by Stripe).<br />
          • Screen telemetry (screen online/offline heartbeats and which campaign was
          playing) — no viewer data.<br />
          • QR-code scans: when you scan an ad's QR code, we record the scan event
          (timestamp, campaign, screen) to count engagement before redirecting you to
          the advertiser's site.
        </p>

        <h2 style={h2}>Retention</h2>
        {/* TODO(legal): set concrete retention periods. */}
        <p style={p}>
          Placeholder: retention periods for account data, telemetry, and scan events
          to be confirmed by counsel.
        </p>

        <h2 style={h2}>Contact</h2>
        {/* TODO(legal): confirm contact address / DPO details. */}
        <p style={p}>
          Placeholder: privacy contact email and postal address to be supplied.
        </p>
      </div>
    </div>
  );
}
