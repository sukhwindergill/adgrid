import { describe, it, expect, vi } from 'vitest';
import {
  PAIRING_ALPHABET,
  PENDING_PAIRING_KEY,
  PAIRED_TOKEN_KEY,
  normalizePairingCode,
  isValidPairingCode,
  formatPairingCode,
  loadPendingPairing,
  savePendingPairing,
  loadPairedToken,
  savePairedToken,
  callPairing,
  formatCountdown,
} from './screenPairing.js';
import { PAIRING_ALPHABET as SERVER_ALPHABET } from '../../supabase/functions/_shared/screenPairing.ts';

const now = new Date('2026-10-16T12:00:00Z');

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
  };
}

const throwingStorage = {
  getItem: () => { throw new Error('SecurityError'); },
  setItem: () => { throw new Error('SecurityError'); },
  removeItem: () => { throw new Error('SecurityError'); },
};

describe('code helpers', () => {
  it('uses the same alphabet as the edge function', () => {
    expect(PAIRING_ALPHABET).toBe(SERVER_ALPHABET);
  });

  it('normalizes what an operator types', () => {
    expect(normalizePairingCode('abc 234')).toBe('ABC234');
    expect(normalizePairingCode('abc-234')).toBe('ABC234');
    expect(normalizePairingCode(undefined)).toBe('');
  });

  it('validates', () => {
    expect(isValidPairingCode('ABC234')).toBe(true);
    expect(isValidPairingCode('ABC230')).toBe(false);
    expect(isValidPairingCode('ABC23')).toBe(false);
  });

  it('formats as two groups of three', () => {
    expect(formatPairingCode('abc234')).toBe('ABC 234');
    expect(formatPairingCode('AB')).toBe('AB');
  });

  it('formats a countdown and clamps at zero', () => {
    expect(formatCountdown('2026-10-16T12:14:05Z', now)).toBe('14:05');
    expect(formatCountdown('2026-10-16T11:00:00Z', now)).toBe('0:00');
  });
});

describe('pending pairing storage', () => {
  const pending = { code: 'ABC234', device_secret: 'secret', expires_at: '2026-10-16T12:15:00Z' };

  it('round-trips a live pairing', () => {
    const s = memoryStorage();
    savePendingPairing(s, pending);
    expect(loadPendingPairing(s, now)).toEqual(pending);
    savePendingPairing(s, null);
    expect(s.data[PENDING_PAIRING_KEY]).toBeUndefined();
  });

  it('drops expired or malformed entries', () => {
    expect(loadPendingPairing(memoryStorage({ [PENDING_PAIRING_KEY]: JSON.stringify(pending) }), new Date('2026-10-16T12:15:00Z'))).toBeNull();
    expect(loadPendingPairing(memoryStorage({ [PENDING_PAIRING_KEY]: '{not json' }), now)).toBeNull();
    expect(loadPendingPairing(memoryStorage({ [PENDING_PAIRING_KEY]: JSON.stringify({ ...pending, code: 'nope' }) }), now)).toBeNull();
  });

  it('survives storage that throws', () => {
    expect(() => savePendingPairing(throwingStorage, pending)).not.toThrow();
    expect(loadPendingPairing(throwingStorage, now)).toBeNull();
    expect(loadPendingPairing(null, now)).toBeNull();
  });
});

describe('paired token storage', () => {
  it('round-trips a uuid token', () => {
    const s = memoryStorage();
    savePairedToken(s, '3f1c2b7a-0000-4000-8000-000000000001');
    expect(loadPairedToken(s)).toBe('3f1c2b7a-0000-4000-8000-000000000001');
    savePairedToken(s, null);
    expect(s.data[PAIRED_TOKEN_KEY]).toBeUndefined();
  });

  it('ignores junk that would build a bad redirect', () => {
    expect(loadPairedToken(memoryStorage({ [PAIRED_TOKEN_KEY]: '../../evil' }))).toBeNull();
    expect(loadPairedToken(throwingStorage)).toBeNull();
  });
});

describe('callPairing', () => {
  it('posts JSON to screen-pairing with the bearer token', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ code: 'ABC234' }) }));
    const r = await callPairing({ action: 'create' }, { functionsUrl: 'https://x/functions/v1', accessToken: 'jwt', fetchImpl });
    expect(r).toEqual({ ok: true, status: 200, data: { code: 'ABC234' } });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://x/functions/v1/screen-pairing');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer jwt');
    expect(JSON.parse(init.body)).toEqual({ action: 'create' });
  });

  it('returns error responses without throwing', async () => {
    const fetchImpl = () => Promise.resolve({ ok: false, status: 429, json: () => Promise.reject(new Error('not json')) });
    expect(await callPairing({ action: 'poll' }, { functionsUrl: 'u', fetchImpl })).toEqual({ ok: false, status: 429, data: {} });
  });

  it('maps network failures and missing config to status 0', async () => {
    const fetchImpl = () => Promise.reject(new TypeError('Failed to fetch'));
    expect((await callPairing({}, { functionsUrl: 'u', fetchImpl })).status).toBe(0);
    expect((await callPairing({}, { functionsUrl: '' })).status).toBe(0);
  });
});
