import { describe, it, expect } from 'vitest';
import { generateApiKey, hashApiKey, apiKeyPrefix } from './apiKey.js';

describe('apiKey (client)', () => {
  it('generates a key with the agak_ prefix', () => {
    expect(generateApiKey().startsWith('agak_')).toBe(true);
  });

  it('generates a different key each call', () => {
    expect(generateApiKey()).not.toBe(generateApiKey());
  });

  it('hashes deterministically and does not return the plaintext', async () => {
    const key = generateApiKey();
    const h1 = await hashApiKey(key);
    const h2 = await hashApiKey(key);
    expect(h1).toBe(h2);
    expect(h1).not.toBe(key);
  });

  it('derives an 8-char prefix after the agak_ marker', () => {
    const key = generateApiKey();
    const prefix = apiKeyPrefix(key);
    expect(prefix).toBe(key.slice(0, 13));
    expect(prefix.startsWith('agak_')).toBe(true);
  });
});
