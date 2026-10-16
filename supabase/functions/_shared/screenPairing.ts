// TV-style screen pairing (see supabase/functions/screen-pairing/index.ts).
//
// A display opens the public /pair page with no secret, asks for a short
// code, and shows it on screen. The operator types that code into the
// dashboard, which claims it for one of their screens. The display -- and
// only the display, proven by a device secret handed out alongside the
// code -- then polls the code, gets the screen_token back, and redirects
// itself to /display/<screen_token>.
//
// Pure logic + a storage interface so the whole create -> claim -> poll
// flow is unit-testable without a database (screenPairing.test.js); the
// Edge Function supplies a Supabase-backed store.

// No 0/O, 1/I/L -- the code gets read off a TV across a room and typed on
// a phone, so every glyph has to be unambiguous.
export const PAIRING_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const PAIRING_CODE_LENGTH = 6;
export const PAIRING_TTL_MS = 15 * 60_000;
const DEVICE_SECRET_BYTES = 32;
const MAX_CODE_ATTEMPTS = 5;

type RandomFill = (buf: Uint8Array) => Uint8Array;
const defaultRandom: RandomFill = (buf) => crypto.getRandomValues(buf);

// Rejection sampling: 256 % 31 != 0, so a plain modulo would bias the
// first few letters. Bytes >= the largest multiple of 31 are discarded.
export function generatePairingCode(random: RandomFill = defaultRandom): string {
  const n = PAIRING_ALPHABET.length;
  const ceiling = 256 - (256 % n);
  let out = "";
  while (out.length < PAIRING_CODE_LENGTH) {
    const buf = random(new Uint8Array(PAIRING_CODE_LENGTH * 2));
    for (const b of buf) {
      if (b < ceiling) out += PAIRING_ALPHABET[b % n];
      if (out.length === PAIRING_CODE_LENGTH) break;
    }
  }
  return out;
}

// Operators type what they see: lower case, a space or dash in the middle
// ("ABC 234" is how the TV renders it). Strip all of that before checking.
export function normalizePairingCode(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.toUpperCase().replace(/[\s-]/g, "");
}

export function isValidPairingCode(code: unknown): code is string {
  if (typeof code !== "string" || code.length !== PAIRING_CODE_LENGTH) return false;
  for (const ch of code) if (!PAIRING_ALPHABET.includes(ch)) return false;
  return true;
}

export function generateDeviceSecret(random: RandomFill = defaultRandom): string {
  const bytes = random(new Uint8Array(DEVICE_SECRET_BYTES));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Only the hash is stored, so a leaked pairing_codes row can't be used to
// poll for someone else's screen_token.
export async function hashDeviceSecret(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface PairingRow {
  code: string;
  secret_hash: string;
  expires_at: string;
  claimed_screen_id: string | null;
  claimed_at: string | null;
}

export type PairingState = "not_found" | "expired" | "claimed" | "pending";

export function pairingState(row: PairingRow | null, now: Date): PairingState {
  if (!row) return "not_found";
  if (row.claimed_screen_id) return "claimed";
  if (new Date(row.expires_at).getTime() <= now.getTime()) return "expired";
  return "pending";
}

export interface PairingStore {
  // Resolves false on a primary-key collision with a live code.
  insertCode(row: { code: string; secret_hash: string; expires_at: string }): Promise<boolean>;
  getCode(code: string): Promise<PairingRow | null>;
  // Conditional update: only succeeds if the row is still unclaimed and
  // unexpired at `now`, so two operators racing on one code can't both win.
  claimCode(code: string, screenId: string, userId: string, now: Date): Promise<boolean>;
  markDelivered(code: string, now: Date): Promise<void>;
  getScreen(screenId: string): Promise<{ id: string; name: string; operator_id: string | null } | null>;
  getScreenToken(screenId: string): Promise<string | null>;
}

export type PairingResult =
  | { status: 200; body: Record<string, unknown> }
  | { status: 400 | 403 | 404 | 409 | 410 | 500; body: { error: string } };

export async function createPairing(
  store: PairingStore,
  now: Date,
  random: RandomFill = defaultRandom,
): Promise<PairingResult> {
  const secret = generateDeviceSecret(random);
  const secret_hash = await hashDeviceSecret(secret);
  const expires_at = new Date(now.getTime() + PAIRING_TTL_MS).toISOString();
  for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) {
    const code = generatePairingCode(random);
    if (await store.insertCode({ code, secret_hash, expires_at })) {
      return { status: 200, body: { code, device_secret: secret, expires_at } };
    }
  }
  return { status: 500, body: { error: "Could not allocate a pairing code, try again" } };
}

export async function pollPairing(
  store: PairingStore,
  input: { code: unknown; device_secret: unknown },
  now: Date,
): Promise<PairingResult> {
  const code = normalizePairingCode(input.code);
  if (!isValidPairingCode(code) || typeof input.device_secret !== "string" || !input.device_secret) {
    return { status: 400, body: { error: "code and device_secret required" } };
  }
  const row = await store.getCode(code);
  // A wrong secret is reported exactly like a missing code so the poll
  // endpoint can't be used to probe which codes exist.
  if (!row || row.secret_hash !== await hashDeviceSecret(input.device_secret)) {
    return { status: 404, body: { error: "Pairing code not found" } };
  }
  const state = pairingState(row, now);
  if (state === "pending") return { status: 200, body: { status: "pending", expires_at: row.expires_at } };
  if (state === "expired") return { status: 200, body: { status: "expired" } };

  const token = await store.getScreenToken(row.claimed_screen_id!);
  if (!token) return { status: 404, body: { error: "Paired screen no longer exists" } };
  await store.markDelivered(code, now);
  return { status: 200, body: { status: "claimed", screen_token: token } };
}

export async function claimPairing(
  store: PairingStore,
  input: { code: unknown; screen_id: unknown; user_id: string },
  now: Date,
): Promise<PairingResult> {
  const code = normalizePairingCode(input.code);
  if (!isValidPairingCode(code)) {
    return { status: 400, body: { error: "Enter the 6-character code shown on your screen" } };
  }
  if (typeof input.screen_id !== "string" || !input.screen_id) {
    return { status: 400, body: { error: "screen_id required" } };
  }

  const screen = await store.getScreen(input.screen_id);
  if (!screen) return { status: 404, body: { error: "Screen not found" } };
  if (screen.operator_id !== input.user_id) {
    return { status: 403, body: { error: "You don't own this screen" } };
  }

  const row = await store.getCode(code);
  const state = pairingState(row, now);
  if (state === "not_found") {
    return { status: 404, body: { error: "That code doesn't match any screen. Check it and try again." } };
  }
  if (state === "expired") {
    return { status: 410, body: { error: "That code has expired. The screen will show a new one -- enter that instead." } };
  }
  if (state === "claimed") {
    return { status: 409, body: { error: "That code has already been used." } };
  }
  if (!await store.claimCode(code, screen.id, input.user_id, now)) {
    return { status: 409, body: { error: "That code has already been used." } };
  }
  return { status: 200, body: { ok: true, screen_id: screen.id, screen_name: screen.name } };
}
