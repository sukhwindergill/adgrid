import { LegalDocument } from './LegalDocument.jsx';

// Text lives in src/locales under legal.terms. The fr-CA version still needs
// review by a lawyer before it is relied on (see LegalDocument.jsx).
export function TermsOfService() {
  return <LegalDocument doc="terms" updated="2026-08-31" />;
}
