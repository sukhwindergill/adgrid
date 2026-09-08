import { describe, it, expect } from 'vitest';
import { generatePostbackKey, hashPostbackKey, verifyPostbackKey } from './postbackKey.ts';

describe('postbackKey', () => {
  it('generates a key with the agpk_ prefix and sufficient length', () => {
    const key = generatePostbackKey();
    expect(key.startsWith('agpk_')).toBe(true);
    expect(key.length).toBeGreaterThan(40);
  });

  it('generates a different key each call', () => {
    expect(generatePostbackKey()).not.toBe(generatePostbackKey());
  });

  it('hashes deterministically', async () => {
    const key = generatePostbackKey();
    const h1 = await hashPostbackKey(key);
    const h2 = await hashPostbackKey(key);
    expect(h1).toBe(h2);
    expect(h1).not.toBe(key);
  });

  it('verifies a matching key against its stored hash', async () => {
    const key = generatePostbackKey();
    const hash = await hashPostbackKey(key);
    expect(await verifyPostbackKey(key, hash)).toBe(true);
  });

  it('rejects a wrong key', async () => {
    const hash = await hashPostbackKey(generatePostbackKey());
    expect(await verifyPostbackKey(generatePostbackKey(), hash)).toBe(false);
  });

  it('rejects empty input without throwing', async () => {
    expect(await verifyPostbackKey('', 'somehash')).toBe(false);
    expect(await verifyPostbackKey('somekey', '')).toBe(false);
  });
});
