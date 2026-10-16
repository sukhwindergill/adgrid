import { LegalDocument } from './LegalDocument.jsx';

// Text lives in src/locales under legal.privacy. The fr-CA version still needs
// review by a lawyer before it is relied on (see LegalDocument.jsx).
export function PrivacyPolicy() {
  return <LegalDocument doc="privacy" updated="2026-09-24" />;
}
