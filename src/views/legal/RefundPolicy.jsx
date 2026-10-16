import { LegalDocument } from './LegalDocument.jsx';

// Text lives in src/locales under legal.refunds. The fr-CA version still needs
// review by a lawyer before it is relied on (see LegalDocument.jsx).
export function RefundPolicy() {
  return <LegalDocument doc="refunds" updated="2026-09-05" />;
}
