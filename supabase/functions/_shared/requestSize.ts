// Rejects oversized request bodies before they're parsed. Applied to
// public/unauthenticated ingestion endpoints (ingest-impressions,
// ingest-plays) where any client on the internet can POST -- without a cap,
// an attacker can send an arbitrarily large body to burn CPU/memory on JSON
// parsing or blow past reasonable telemetry-row sizes.

export function requestTooLarge(req: Request, maxBytes = 65536): boolean {
  const len = req.headers.get("content-length");
  if (!len) return false; // no declared length -- let JSON.parse fail naturally on garbage
  const n = Number(len);
  return Number.isFinite(n) && n > maxBytes;
}

// Platform-audit finding: requestTooLarge only reads the Content-Length
// header. Any caller can simply omit it -- chunked transfer-encoding sends
// no Content-Length at all -- and sail straight past the cap above. The
// three callers (auth-security, ingest-impressions, ingest-plays) all
// followed their requestTooLarge() check with a plain `await req.json()`,
// which buffers the entire body into memory before parsing regardless of
// how big it actually is. On public, unauthenticated endpoints (the two
// ingest-* routes accept any client on the internet; auth-security's own
// body-size check exists for the same reason) that's a real memory/CPU
// exhaustion vector: the size cap was enforceable only against a
// cooperative caller, not an adversarial one.
//
// Enforces the same cap against the body's ACTUAL byte count as it streams
// in, aborting as soon as the limit is exceeded -- independent of whatever
// (or whether any) Content-Length header was sent. Throws RequestTooLargeError
// so callers can 413 the same way they already do for the header-only case.
export class RequestTooLargeError extends Error {
  constructor() {
    super("Request body exceeds the allowed size");
    this.name = "RequestTooLargeError";
  }
}

export async function readJsonLimited(req: Request, maxBytes = 65536): Promise<unknown> {
  if (!req.body) return req.json(); // no body at all -- nothing to stream-guard

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new RequestTooLargeError();
    }
    chunks.push(value);
  }

  const buf = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buf.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return JSON.parse(new TextDecoder().decode(buf));
}
