// src/lib/creativeMessageSplit.js
const CTA_LEAD_WORDS = ['shop', 'get', 'try', 'save', 'learn', 'visit', 'order', 'book', 'call', 'sign up', 'download'];
const DELIMITERS = /[,;—.!?-]/g;

function isCtaCandidate(text) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 6) return false;
  const lower = text.toLowerCase();
  return CTA_LEAD_WORDS.some(w => lower === w || lower.startsWith(w + ' '));
}

/**
 * Deterministically splits a single free-text line into a headline and an
 * optional CTA -- no AI call. Looks at the text after the LAST delimiter; if
 * it reads like a call to action (starts with a lead verb, six words or
 * fewer) it becomes the CTA and everything before the delimiter becomes the
 * headline. Otherwise the whole message is the headline and the CTA falls
 * back to "Learn More".
 */
export function splitMessage(message) {
  const trimmed = (message || '').trim();
  if (!trimmed) return { headline: '', cta: '' };

  const matches = [...trimmed.matchAll(DELIMITERS)];
  if (matches.length > 0) {
    const last = matches[matches.length - 1];
    const before = trimmed.slice(0, last.index).trim();
    const after = trimmed.slice(last.index + 1).trim();
    if (before && isCtaCandidate(after)) {
      return { headline: before, cta: after };
    }
  }
  return { headline: trimmed, cta: 'Learn More' };
}
