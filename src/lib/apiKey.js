// REST campaign API key generation/hashing (Competitive Parity Program,
// Phase 6, G21 REST API half -- docs/superpowers/specs/2026-09-08-rest-
// campaign-api-design.md). Mirrors src/lib/postbackKey.js exactly, with an
// 'agak_' prefix (vs. postback's 'agpk_') so the two key families are
// visually distinguishable in the UI and in support conversations.
//
// Generated and hashed client-side; only the hash is ever written to
// api_keys.key_hash (RLS lets an advertiser insert their own row
// directly). The plaintext key is shown once, in local component state,
// and never persisted anywhere.

function toHex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function generateApiKey() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return 'agak_' + toHex(bytes.buffer);
}

export async function hashApiKey(key) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return toHex(buf);
}

/** First 8 chars after the prefix, shown in the dashboard's key list so an advertiser can tell keys apart without re-seeing the full value. */
export function apiKeyPrefix(key) {
  return key.slice(0, 'agak_'.length + 8);
}
