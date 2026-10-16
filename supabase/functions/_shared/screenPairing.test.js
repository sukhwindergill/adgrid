import { describe, it, expect, beforeEach } from 'vitest';
import {
  PAIRING_ALPHABET,
  PAIRING_CODE_LENGTH,
  PAIRING_TTL_MS,
  generatePairingCode,
  normalizePairingCode,
  isValidPairingCode,
  generateDeviceSecret,
  hashDeviceSecret,
  pairingState,
  createPairing,
  pollPairing,
  claimPairing,
} from './screenPairing.ts';

const now = new Date('2026-10-16T12:00:00Z');
const later = (ms) => new Date(now.getTime() + ms);

// In-memory PairingStore with the same conditional-claim semantics as the
// Supabase-backed one in screen-pairing/index.ts.
function memoryStore({ screens = {} } = {}) {
  const codes = new Map();
  return {
    codes,
    async insertCode(row) {
      if (codes.has(row.code)) return false;
      codes.set(row.code, { ...row, claimed_screen_id: null, claimed_at: null, delivered_at: null });
      return true;
    },
    async getCode(code) { return codes.get(code) ?? null; },
    async claimCode(code, screenId, userId, at) {
      const row = codes.get(code);
      if (!row || row.claimed_screen_id || new Date(row.expires_at) <= at) return false;
      Object.assign(row, { claimed_screen_id: screenId, claimed_by: userId, claimed_at: at.toISOString() });
      return true;
    },
    async markDelivered(code, at) { codes.get(code).delivered_at ??= at.toISOString(); },
    async getScreen(id) { return screens[id] ? { id, name: screens[id].name, operator_id: screens[id].operator_id } : null; },
    async getScreenToken(id) { return screens[id]?.screen_token ?? null; },
  };
}

describe('generatePairingCode', () => {
  it('is 6 chars from the unambiguous alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const code = generatePairingCode();
      expect(code).toHaveLength(PAIRING_CODE_LENGTH);
      expect(isValidPairingCode(code)).toBe(true);
    }
  });

  it('never uses look-alike glyphs', () => {
    for (const ch of '01OIL') expect(PAIRING_ALPHABET).not.toContain(ch);
  });

  it('skips bytes that would bias the modulo', () => {
    // 248 is the first byte >= 256 - (256 % 31); it must be rejected rather
    // than mapped onto the alphabet.
    let call = 0;
    const random = (buf) => {
      buf.fill(call++ === 0 ? 248 : 0);
      return buf;
    };
    expect(generatePairingCode(random)).toBe('AAAAAA');
  });
});

describe('normalizePairingCode', () => {
  it('upper-cases and strips the space/dash the TV shows', () => {
    expect(normalizePairingCode(' abc-234 ')).toBe('ABC234');
    expect(normalizePairingCode('Abc 234')).toBe('ABC234');
  });

  it('returns empty string for non-strings', () => {
    expect(normalizePairingCode(null)).toBe('');
    expect(normalizePairingCode(123456)).toBe('');
  });
});

describe('isValidPairingCode', () => {
  it('rejects wrong length and ambiguous characters', () => {
    expect(isValidPairingCode('ABC23')).toBe(false);
    expect(isValidPairingCode('ABC2345')).toBe(false);
    expect(isValidPairingCode('ABC10O')).toBe(false);
    expect(isValidPairingCode('abc234')).toBe(false);
    expect(isValidPairingCode('ABC234')).toBe(true);
  });
});

describe('device secret', () => {
  it('is url-safe, long, and unique', () => {
    const a = generateDeviceSecret();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateDeviceSecret()).not.toBe(a);
  });

  it('hashes deterministically to hex', async () => {
    const h = await hashDeviceSecret('s3cret');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashDeviceSecret('s3cret')).toBe(h);
    expect(await hashDeviceSecret('other')).not.toBe(h);
  });
});

describe('pairingState', () => {
  const row = (over = {}) => ({
    code: 'ABC234', secret_hash: 'x', expires_at: later(60_000).toISOString(),
    claimed_screen_id: null, claimed_at: null, ...over,
  });

  it('classifies rows', () => {
    expect(pairingState(null, now)).toBe('not_found');
    expect(pairingState(row(), now)).toBe('pending');
    expect(pairingState(row({ expires_at: now.toISOString() }), now)).toBe('expired');
    expect(pairingState(row({ claimed_screen_id: 's1', claimed_at: now.toISOString() }), now)).toBe('claimed');
  });

  it('reports a claimed code as claimed even after expiry so the display still gets its token', () => {
    expect(pairingState(row({ claimed_screen_id: 's1', expires_at: now.toISOString() }), later(1))).toBe('claimed');
  });
});

describe('pairing flow', () => {
  let store;
  beforeEach(() => {
    store = memoryStore({
      screens: {
        s1: { name: 'Corner Brew', operator_id: 'op1', screen_token: 'tok-1' },
        s2: { name: 'Someone else', operator_id: 'op2', screen_token: 'tok-2' },
      },
    });
  });

  it('create -> claim -> poll hands the display its screen token', async () => {
    const created = await createPairing(store, now);
    expect(created.status).toBe(200);
    const { code, device_secret, expires_at } = created.body;
    expect(isValidPairingCode(code)).toBe(true);
    expect(new Date(expires_at).getTime()).toBe(now.getTime() + PAIRING_TTL_MS);
    // Only the hash is persisted.
    expect(store.codes.get(code).secret_hash).not.toBe(device_secret);

    expect((await pollPairing(store, { code, device_secret }, now)).body.status).toBe('pending');

    const claimed = await claimPairing(store, { code: code.toLowerCase().replace(/^(...)/, '$1 '), screen_id: 's1', user_id: 'op1' }, later(1000));
    expect(claimed).toEqual({ status: 200, body: { ok: true, screen_id: 's1', screen_name: 'Corner Brew' } });

    const polled = await pollPairing(store, { code, device_secret }, later(2000));
    expect(polled.body).toEqual({ status: 'claimed', screen_token: 'tok-1' });
    expect(store.codes.get(code).delivered_at).toBe(later(2000).toISOString());
  });

  it('retries on a code collision', async () => {
    await store.insertCode({ code: 'AAAAAA', secret_hash: 'x', expires_at: later(1).toISOString() });
    let call = 0;
    // First code attempt yields AAAAAA (taken), later ones yield BBBBBB.
    const random = (buf) => { buf.fill(call++ < 2 ? 0 : 1); return buf; };
    const r = await createPairing(store, now, random);
    expect(r.body.code).toBe('BBBBBB');
  });

  it('gives up after repeated collisions', async () => {
    await store.insertCode({ code: 'AAAAAA', secret_hash: 'x', expires_at: later(1).toISOString() });
    const r = await createPairing(store, now, (buf) => buf.fill(0));
    expect(r.status).toBe(500);
  });

  it('poll rejects a wrong device secret like an unknown code', async () => {
    const { body } = await createPairing(store, now);
    expect((await pollPairing(store, { code: body.code, device_secret: 'nope' }, now)).status).toBe(404);
    expect((await pollPairing(store, { code: 'ZZZZZZ', device_secret: 'nope' }, now)).status).toBe(404);
    expect((await pollPairing(store, { code: body.code }, now)).status).toBe(400);
  });

  it('poll reports expiry', async () => {
    const { body } = await createPairing(store, now);
    const r = await pollPairing(store, { code: body.code, device_secret: body.device_secret }, later(PAIRING_TTL_MS));
    expect(r.body).toEqual({ status: 'expired' });
  });

  it('claim enforces ownership', async () => {
    const { body } = await createPairing(store, now);
    const r = await claimPairing(store, { code: body.code, screen_id: 's2', user_id: 'op1' }, now);
    expect(r.status).toBe(403);
    expect(store.codes.get(body.code).claimed_screen_id).toBeNull();
  });

  it('claim validates input', async () => {
    expect((await claimPairing(store, { code: 'AB', screen_id: 's1', user_id: 'op1' }, now)).status).toBe(400);
    expect((await claimPairing(store, { code: 'ABC234', screen_id: '', user_id: 'op1' }, now)).status).toBe(400);
    expect((await claimPairing(store, { code: 'ABC234', screen_id: 'missing', user_id: 'op1' }, now)).status).toBe(404);
    expect((await claimPairing(store, { code: 'ABC234', screen_id: 's1', user_id: 'op1' }, now)).status).toBe(404);
  });

  it('claim rejects expired and already-used codes', async () => {
    const a = (await createPairing(store, now)).body;
    expect((await claimPairing(store, { code: a.code, screen_id: 's1', user_id: 'op1' }, later(PAIRING_TTL_MS))).status).toBe(410);

    const b = (await createPairing(store, now)).body;
    expect((await claimPairing(store, { code: b.code, screen_id: 's1', user_id: 'op1' }, now)).status).toBe(200);
    expect((await claimPairing(store, { code: b.code, screen_id: 's1', user_id: 'op1' }, now)).status).toBe(409);
  });

  it('claim loses a race cleanly when the conditional update fails', async () => {
    const { body } = await createPairing(store, now);
    store.claimCode = async () => false;
    expect((await claimPairing(store, { code: body.code, screen_id: 's1', user_id: 'op1' }, now)).status).toBe(409);
  });

  it('poll 404s when the claimed screen was deleted', async () => {
    const { body } = await createPairing(store, now);
    await claimPairing(store, { code: body.code, screen_id: 's1', user_id: 'op1' }, now);
    store.getScreenToken = async () => null;
    expect((await pollPairing(store, { code: body.code, device_secret: body.device_secret }, now)).status).toBe(404);
  });
});
