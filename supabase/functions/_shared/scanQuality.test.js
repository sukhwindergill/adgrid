import { describe, it, expect } from 'vitest';
import { isBotUserAgent, dedupKey, DEDUP_WINDOW_MS } from './scanQuality.ts';

describe('isBotUserAgent', () => {
  it('flags known crawlers and link previewers', () => {
    for (const ua of [
      'facebookexternalhit/1.1',
      'Slackbot-LinkExpanding 1.0',
      'WhatsApp/2.23',
      'Mozilla/5.0 (compatible; Googlebot/2.1)',
      'curl/8.4.0',
      'Wget/1.21',
      'HeadlessChrome/120.0.0.0',
      'Twitterbot/1.0',
    ]) {
      expect(isBotUserAgent(ua), ua).toBe(true);
    }
  });

  it('does not flag a real phone browser', () => {
    expect(isBotUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1')).toBe(false);
  });

  it('does not flag a real desktop browser', () => {
    expect(isBotUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36')).toBe(false);
  });

  it('treats a missing user agent as a bot', () => {
    expect(isBotUserAgent('')).toBe(true);
    expect(isBotUserAgent(null)).toBe(true);
    expect(isBotUserAgent('   ')).toBe(true);
  });
});

describe('dedupKey', () => {
  it('is stable for the same campaign, screen, ip and ua', async () => {
    const a = await dedupKey('c1', 's1', '1.2.3.4', 'ua');
    const b = await dedupKey('c1', 's1', '1.2.3.4', 'ua');
    expect(a).toBe(b);
  });

  it('differs when any input differs', async () => {
    const base = await dedupKey('c1', 's1', '1.2.3.4', 'ua');
    expect(await dedupKey('c2', 's1', '1.2.3.4', 'ua')).not.toBe(base);
    expect(await dedupKey('c1', 's2', '1.2.3.4', 'ua')).not.toBe(base);
    expect(await dedupKey('c1', 's1', '9.9.9.9', 'ua')).not.toBe(base);
    expect(await dedupKey('c1', 's1', '1.2.3.4', 'other')).not.toBe(base);
  });

  it('does not contain the raw ip', async () => {
    expect(await dedupKey('c1', 's1', '1.2.3.4', 'ua')).not.toContain('1.2.3.4');
  });

  it('returns a 64-character hex digest', async () => {
    expect(await dedupKey('c1', 's1', '1.2.3.4', 'ua')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('tolerates a null screen id', async () => {
    expect(typeof await dedupKey('c1', null, '1.2.3.4', 'ua')).toBe('string');
  });

  it('uses a 30 minute window', () => {
    expect(DEDUP_WINDOW_MS).toBe(30 * 60 * 1000);
  });
});
