// Scan quality helpers. Pure — no Deno APIs — so vitest can run them.
// Uses Web Crypto, which exists in both Deno and Node 18+.

export const DEDUP_WINDOW_MS = 30 * 60 * 1000;

const BOT_UA = /bot|crawler|spider|preview|facebookexternalhit|slackbot|whatsapp|telegram|discord|curl|wget|python-requests|headless|lighthouse|monitoring/i;

export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua || !ua.trim()) return true; // no UA at all is not a phone camera
  return BOT_UA.test(ua);
}

// SHA-256 over the identifying tuple. The raw IP is never stored — only this
// digest — so dedup does not turn the scans table into an IP log.
export async function dedupKey(
  campaignId: string,
  screenId: string | null,
  ip: string,
  ua: string,
): Promise<string> {
  const input = [campaignId, screenId ?? '', ip, ua].join('|');
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}
