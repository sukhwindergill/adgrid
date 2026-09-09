// SSRF guard for outbound webhook URLs (operator custom webhooks, Shopify
// integration config) -- both are supplied by the account holder themselves
// and then fetched server-side by this project's edge functions
// (operatorWebhook.ts's fireOperatorWebhook, operator-webhook-test, and
// fire-integration's fireShopify). With no validation, an authenticated
// operator/advertiser could point webhook_url at an internal address --
// a cloud metadata endpoint, a service on the platform's own private
// network -- and use AdGrid's server as a proxy to reach it (classic
// SSRF). Every fetch(hook.webhook_url, ...) call site should check this
// first and refuse to fetch if it returns false.
//
// This is a static, pre-connection check on the URL/hostname only -- it
// does not resolve DNS itself, so it can't catch DNS-rebinding (a hostname
// that resolves to a public IP at check time but a private one at fetch
// time). Full protection against that requires validating the resolved
// IP at the socket layer, which Deno's fetch() doesn't expose a hook for.
// This closes the straightforward case (a literal private/loopback/
// link-local IP or a well-known internal hostname), which is the
// realistic attack here given both fields are plain user input, not
// something worth a custom HTTP client for today.

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal", // GCP metadata endpoint
]);

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return false;
  const [a, b] = parts;
  if (a === 127) return true; // loopback
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local, incl. cloud metadata)
  if (a === 0) return true; // 0.0.0.0/8
  return false;
}

function isPrivateIPv6(hostname: string): boolean {
  const ip = hostname.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();
  if (ip === "::1") return true; // loopback
  if (ip === "::") return true; // unspecified
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true; // fc00::/7 unique local
  if (ip.startsWith("fe80")) return true; // fe80::/10 link-local

  // IPv4-mapped IPv6 (::ffff:a.b.c.d) -- check the embedded IPv4 part.
  // The URL parser normalizes this to either dotted-decimal or hex-group
  // form (::ffff:7f00:1 for 127.0.0.1), so handle both.
  const dotted = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) return isPrivateIPv4(dotted[1]);

  const hexGroups = ip.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hexGroups) {
    const hi = parseInt(hexGroups[1], 16);
    const lo = parseInt(hexGroups[2], 16);
    const octets = [(hi >> 8) & 0xff, hi & 0xff, (lo >> 8) & 0xff, lo & 0xff];
    return isPrivateIPv4(octets.join("."));
  }

  return false;
}

export function isSafeWebhookUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname || BLOCKED_HOSTNAMES.has(hostname)) return false;

  if (hostname.startsWith("[") || hostname.includes(":")) {
    if (isPrivateIPv6(hostname)) return false;
  } else if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    if (isPrivateIPv4(hostname)) return false;
  }

  return true;
}
