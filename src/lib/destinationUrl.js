// Validation for a campaign's destination URL.
//
// This value is encoded into the QR code printed on a public screen, so it is
// the one advertiser-supplied field that strangers interact with. It's
// optional — a campaign can run with no QR at all (getCreativeRenderPlan's
// showQr is false when it's blank) — but *if* a value is typed, it must be
// http(s). `javascript:` and `data:` URLs are rejected here as well as in
// scan-redirect, so a hostile destination can't be stored in the first place,
// and a malformed one can't go live silently pointing scanners at an error.

const WEB_SCHEMES = ['http:', 'https:'];
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

export function normalizeDestinationUrl(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  // Only prepend a scheme when none was supplied. Never rewrite an explicit
  // one — silently turning `javascript:` into `https://javascript:` would
  // disguise a rejected value as a valid one.
  if (HAS_SCHEME.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function isValidDestinationUrl(value) {
  const normalized = normalizeDestinationUrl(value);
  if (!normalized) return false;

  let url;
  try {
    url = new URL(normalized);
  } catch {
    return false;
  }

  if (!WEB_SCHEMES.includes(url.protocol.toLowerCase())) return false;
  if (!url.hostname) return false;
  // A hostname with no dot is almost always a typo in this context — real
  // campaign destinations are public domains, not bare hosts.
  if (!url.hostname.includes('.')) return false;

  return true;
}
