import { describe, it, expect } from 'vitest';
import { generatePostbackKey, hashPostbackKey } from './postbackKey.js';

describe('postbackKey (client)', () => {
  it('generates a key with the agpk_ prefix', () => {
    expect(generatePostbackKey().startsWith('agpk_')).toBe(true);
  });

  it('generates a different key each call', () => {
    expect(generatePostbackKey()).not.toBe(generatePostbackKey());
  });

  it('hashes deterministically and does not return the plaintext', async () => {
    const key = generatePostbackKey();
    const h1 = await hashPostbackKey(key);
    const h2 = await hashPostbackKey(key);
    expect(h1).toBe(h2);
    expect(h1).not.toBe(key);
  });
});
