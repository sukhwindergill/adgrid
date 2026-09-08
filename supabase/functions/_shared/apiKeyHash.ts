// SHA-256 hashing for REST API keys (Competitive Parity Program, Phase 6,
// G21 REST API half). Pure -- no Deno APIs beyond Web Crypto, which also
// exists in Node -- so vitest can run it directly, same pattern as
// postbackKey.ts.

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashApiKey(key: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return toHex(buf);
}
