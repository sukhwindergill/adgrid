import { describe, it, expect } from 'vitest';
import { resolveApiKeyRow } from './apiKeyAuth.ts';

describe('resolveApiKeyRow', () => {
  it('resolves the advertiser for an active key', () => {
    const result = resolveApiKeyRow({ id: 'k1', advertiser_id: 'adv-1', revoked_at: null });
    expect(result).toEqual({ advertiserId: 'adv-1', keyId: 'k1' });
  });

  it('rejects a revoked key', () => {
    expect(resolveApiKeyRow({ id: 'k1', advertiser_id: 'adv-1', revoked_at: '2026-01-01T00:00:00Z' })).toBeNull();
  });

  it('rejects an unknown key (no row found)', () => {
    expect(resolveApiKeyRow(null)).toBeNull();
    expect(resolveApiKeyRow(undefined)).toBeNull();
  });
});
