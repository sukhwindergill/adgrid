// Conversion postback key generation/hashing (Competitive Parity Program,
// Phase 6, G9 widen -- docs/superpowers/specs/2026-09-08-conversion-
// pixel-postback-design.md). Mirrors supabase/functions/_shared/
// postbackKey.ts exactly -- kept as a separate copy rather than a shared
// import because supabase/functions/ isn't part of the frontend build.
//
// The key is generated and hashed client-side; only the hash is ever
// written to advertiser_integrations.config.key_hash (RLS lets an
// advertiser insert their own row directly). The plaintext key is shown
// once, in local component state, and never persisted anywhere.

function toHex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function generatePostbackKey() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return 'agpk_' + toHex(bytes.buffer);
}

export async function hashPostbackKey(key) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return toHex(buf);
}
