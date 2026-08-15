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
