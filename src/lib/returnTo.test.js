import { describe, it, expect, beforeEach } from 'vitest';
import { peekReturnTo, RETURN_TO_KEY } from './returnTo.js';

describe('peekReturnTo', () => {
  beforeEach(() => sessionStorage.clear());

  it('returns a stored app path', () => {
    sessionStorage.setItem(RETURN_TO_KEY, '/app/campaigns/b1');
    expect(peekReturnTo()).toBe('/app/campaigns/b1');
  });

  it('rejects anything outside /app/', () => {
    for (const bad of ['https://evil.example/app/x', '//evil.example', '/login', '/app']) {
      sessionStorage.setItem(RETURN_TO_KEY, bad);
      expect(peekReturnTo()).toBeNull();
    }
  });

  it('returns null when nothing is stored', () => {
    expect(peekReturnTo()).toBeNull();
  });
});
