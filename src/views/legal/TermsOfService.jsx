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

export function TermsOfService() {
  return (
    <div style={page}>
      <div style={inner}>
        <h1 style={h1}>Terms of Service</h1>
        <p style={{ ...p, color: 'rgba(255,255,255,0.5)' }}>Last updated: June 11, 2026</p>

        <div style={banner}>
          DRAFT — pending legal review. This is placeholder text and not a final agreement.
        </div>

        <h2 style={h2}>Acceptable use</h2>
        {/* TODO(legal): final acceptable-use terms. */}
        <p style={p}>
          Placeholder: rules governing use of the AdGrid platform by advertisers and
          screen operators, including prohibited conduct.
        </p>

        <h2 style={h2}>Advertiser content rules</h2>
        {/* TODO(legal): final content standards and moderation rights. */}
        <p style={p}>
          Placeholder: standards for advertising creative (no unlawful, deceptive, or
          restricted-category content), operator approval rights, and AdGrid's right
          to remove content.
        </p>

        <h2 style={h2}>Liability</h2>
        {/* TODO(legal): limitation of liability, indemnity, governing law. */}
        <p style={p}>
          Placeholder: limitation of liability, disclaimers, indemnification, and
          governing law to be supplied by counsel.
        </p>
      </div>
    </div>
  );
}
