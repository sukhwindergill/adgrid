// Operator webhook dispatch -- docs/superpowers/specs/2026-09-08-operator-
// webhook-integration-design.md. Fires alongside the existing in-app
// notification/email for a fixed set of operator-relevant events, additive
// to (never replacing) those channels. Mirrors fire-integration's
// fireShopify HMAC-SHA256 signing shape exactly (X-AdGrid-Signature header
// instead of X-Shopify-Hmac-Sha256).

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export async function signWebhookBody(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export function buildWebhookBody(eventType: string, data: Record<string, unknown>): string {
  return JSON.stringify({ event: eventType, data, timestamp: new Date().toISOString() });
}

export async function fireOperatorWebhook(
  supabase: SupabaseClient,
  operatorId: string,
  eventType: string,
  data: Record<string, unknown>,
): Promise<void> {
  const { data: hook } = await supabase
    .from("operator_webhooks")
    .select("webhook_url, secret")
    .eq("operator_id", operatorId)
    .eq("enabled", true)
    .maybeSingle();
  if (!hook) return;

  const body = buildWebhookBody(eventType, data);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (hook.secret) {
    headers["X-AdGrid-Signature"] = await signWebhookBody(hook.secret, body);
  }
  await fetch(hook.webhook_url, { method: "POST", headers, body }).catch(() => {});
}
