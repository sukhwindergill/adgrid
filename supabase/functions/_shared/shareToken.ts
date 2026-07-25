// Share-link tokens. Pure — uses Web Crypto, present in Deno and Node 18+.
//
// This token is the ONLY thing between a URL and a campaign's report, so it
// fails closed everywhere: unknown, revoked, expired, or unparseable all deny.

export const TOKEN_BYTES = 32;

export interface ShareTokenRow {
  revoked_at?: string | null;
  expires_at?: string | null;
}

export interface TokenVerdict {
  usable: boolean;
  reason: string | null;
}

export function generateToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  // base64url, no padding
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function isTokenUsable(row: ShareTokenRow | null | undefined, now: Date = new Date()): TokenVerdict {
  if (!row) return { usable: false, reason: 'not_found' };

  // Revocation is checked first and unconditionally: a revoked link must die
  // immediately regardless of what its expiry says.
  if (row.revoked_at) return { usable: false, reason: 'revoked' };

  if (row.expires_at !== null && row.expires_at !== undefined) {
    const expires = new Date(row.expires_at).getTime();
    // An unparseable expiry denies rather than grants.
    if (!Number.isFinite(expires) || now.getTime() >= expires) {
      return { usable: false, reason: 'expired' };
    }
  }

  return { usable: true, reason: null };
}
