// Client side of TV-style screen pairing. Mirrors the code rules in
// supabase/functions/_shared/screenPairing.ts (that file is the authority;
// this copy only exists so the UI can validate/format before a round trip).
//
// The display at /pair keeps two things in localStorage:
//   - the pending code + device secret, so a reload mid-pairing shows the
//     same code instead of invalidating the one the operator is typing;
//   - the paired screen_token, so a kiosk whose boot URL is /pair goes
//     straight to its player on every reboot after the first pairing.

// Hardware tabs in the setup guide (components/screens/ScreenPairing.jsx).
export const HARDWARE_OPTIONS = ['Browser Kiosk', 'Raspberry Pi 5', 'Mini PC', 'Android TV'];

export const PAIRING_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const PAIRING_CODE_LENGTH = 6;
export const PAIR_POLL_INTERVAL_MS = 3000;

export const PENDING_PAIRING_KEY = 'adgrid_pairing_pending';
export const PAIRED_TOKEN_KEY = 'adgrid_screen_token';

export function normalizePairingCode(input) {
  if (typeof input !== 'string') return '';
  return input.toUpperCase().replace(/[\s-]/g, '');
}

export function isValidPairingCode(code) {
  if (typeof code !== 'string' || code.length !== PAIRING_CODE_LENGTH) return false;
  return [...code].every(ch => PAIRING_ALPHABET.includes(ch));
}

// "ABC234" -> "ABC 234": two groups of three are far easier to read off a
// TV and hold in your head while typing.
export function formatPairingCode(code) {
  const c = normalizePairingCode(code);
  return c.length === PAIRING_CODE_LENGTH ? `${c.slice(0, 3)} ${c.slice(3)}` : c;
}

// Storage can throw (private mode, blocked site data) -- pairing must still
// work, it just won't survive a reload.
function read(storage, key) {
  try { return storage?.getItem(key) ?? null; } catch { return null; }
}
function write(storage, key, value) {
  try {
    if (value == null) storage?.removeItem(key);
    else storage?.setItem(key, value);
  } catch { /* storage unavailable */ }
}

export function loadPendingPairing(storage, now = new Date()) {
  const raw = read(storage, PENDING_PAIRING_KEY);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    if (!isValidPairingCode(p?.code) || typeof p.device_secret !== 'string' || !p.expires_at) return null;
    if (new Date(p.expires_at).getTime() <= now.getTime()) return null;
    return { code: p.code, device_secret: p.device_secret, expires_at: p.expires_at };
  } catch {
    return null;
  }
}

export function savePendingPairing(storage, pairing) {
  write(storage, PENDING_PAIRING_KEY, pairing ? JSON.stringify(pairing) : null);
}

export function loadPairedToken(storage) {
  const t = read(storage, PAIRED_TOKEN_KEY);
  return t && /^[A-Za-z0-9-]{8,}$/.test(t) ? t : null;
}

export function savePairedToken(storage, token) {
  write(storage, PAIRED_TOKEN_KEY, token || null);
}

// POSTs to the screen-pairing Edge Function. Never throws: network failures
// come back as { ok: false, status: 0 } so the display's poll loop can just
// keep going.
export async function callPairing(body, { functionsUrl, accessToken, fetchImpl = fetch } = {}) {
  if (!functionsUrl) return { ok: false, status: 0, data: { error: 'Pairing is not configured' } };
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const res = await fetchImpl(`${functionsUrl}/screen-pairing`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    return { ok: res.ok, status: res.status, data: data ?? {} };
  } catch {
    return { ok: false, status: 0, data: { error: 'Network error' } };
  }
}

// Whole-seconds countdown text for the TV ("14:05").
export function formatCountdown(expiresAt, now = new Date()) {
  const s = Math.max(0, Math.floor((new Date(expiresAt).getTime() - now.getTime()) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
