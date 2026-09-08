// Conversion postback key generation/verification (Competitive Parity
// Program, Phase 6, G9 widen -- see docs/superpowers/specs/2026-09-08-
// conversion-pixel-postback-design.md). Pure Web Crypto helpers -- no Deno
// APIs -- so vitest can run them directly, same pattern as scanQuality.ts's
// dedupKey.
//
// The key is stored hashed (never plaintext), same precedent as
// screen_token: shown once at generation, verified by comparing hashes,
// regenerable (old key invalidated on regeneration since only the latest
// hash is stored).

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function generatePostbackKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return "agpk_" + toHex(bytes.buffer);
}

export async function hashPostbackKey(key: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return toHex(buf);
}

export async function verifyPostbackKey(presentedKey: string, storedHash: string): Promise<boolean> {
  if (!presentedKey || !storedHash) return false;
  const presentedHash = await hashPostbackKey(presentedKey);
  // Constant-time-ish comparison -- not perfectly timing-safe in a JS
  // string comparison, but this endpoint is already rate-limited per key/IP
  // (see conversion-postback/index.ts), which is the more meaningful
  // defense against a brute-force guess at this key length (48 hex chars).
  return presentedHash === storedHash;
}
