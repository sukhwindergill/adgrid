import { describe, it, expect } from 'vitest';
import { generateToken, isTokenUsable, TOKEN_BYTES } from './shareToken.ts';

const now = new Date('2026-07-25T12:00:00Z');

describe('generateToken', () => {
  it('returns a url-safe string', () => {
    expect(generateToken()).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is long enough not to be guessable', () => {
    expect(TOKEN_BYTES).toBeGreaterThanOrEqual(32);
    expect(generateToken().length).toBeGreaterThanOrEqual(43);
  });

  it('does not repeat', () => {
    const seen = new Set(Array.from({ length: 200 }, () => generateToken()));
    expect(seen.size).toBe(200);
  });
});

describe('isTokenUsable', () => {
  const row = (over = {}) => ({ revoked_at: null, expires_at: '2026-08-01T00:00:00Z', ...over });

  it('accepts a live token', () => {
    expect(isTokenUsable(row(), now).usable).toBe(true);
  });

  it('rejects a missing row', () => {
    expect(isTokenUsable(null, now).reason).toBe('not_found');
    expect(isTokenUsable(undefined, now).reason).toBe('not_found');
  });

  it('rejects a revoked token even if it has not expired', () => {
    expect(isTokenUsable(row({ revoked_at: '2026-07-20T00:00:00Z' }), now).reason).toBe('revoked');
  });

  it('rejects an expired token', () => {
    expect(isTokenUsable(row({ expires_at: '2026-07-24T00:00:00Z' }), now).reason).toBe('expired');
  });

  it('rejects a token expiring exactly now', () => {
    expect(isTokenUsable(row({ expires_at: now.toISOString() }), now).usable).toBe(false);
  });

  it('accepts a token with no expiry set', () => {
    expect(isTokenUsable(row({ expires_at: null }), now).usable).toBe(true);
  });

  it('rejects an unparseable expiry rather than treating it as valid', () => {
    // Fail closed: a corrupt timestamp must not grant access.
    expect(isTokenUsable(row({ expires_at: 'garbage' }), now).reason).toBe('expired');
  });

  it('rejects a revoked token before checking expiry, so revocation always wins', () => {
    const r = isTokenUsable(row({ revoked_at: '2026-07-20T00:00:00Z', expires_at: null }), now);
    expect(r.usable).toBe(false);
    expect(r.reason).toBe('revoked');
  });
});
