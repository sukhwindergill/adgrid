import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isSafeWebhookUrl } from "../_shared/webhookUrlGuard.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const INTERNAL_SECRET = Deno.env.get("INTERNAL_NOTIFICATION_SECRET");

interface FirePayload {
  scan_id: string;
  advertiser_id: string;
  campaign_id: string;
  email?: string | null;
  consent?: boolean;
  _test_platform?: string;
  _test_config?: Record<string, string>;
}

async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value.trim().toLowerCase()),
  );
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function fireMeta(
  config: Record<string, string>,
  payload: FirePayload,
): Promise<{ status: string; error?: string }> {
  const { pixel_id, access_token } = config;
  if (!pixel_id || !access_token) return { status: "failed", error: "missing pixel_id or access_token" };

  const userData: Record<string, string> = {};
  if (payload.email && payload.consent) {
    userData.em = await sha256Hex(payload.email);
  }

  const body = {
    data: [
      {
        event_name: "ViewContent",
        event_time: Math.floor(Date.now() / 1000),
        action_source: "physical_store",
        user_data: { ...userData, client_ip_address: "0.0.0.0" },
        custom_data: {
          campaign_id: payload.campaign_id,
          scan_id: payload.scan_id,
          content_type: "ooh_ad",
        },
      },
    ],
  };

  const res = await fetch(
    `https://graph.facebook.com/v18.0/${pixel_id}/events?access_token=${access_token}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  );
  const json = await res.json();
  if (!res.ok) return { status: "failed", error: JSON.stringify(json) };
  return { status: "sent" };
}

async function fireGoogle(
  config: Record<string, string>,
  payload: FirePayload,
): Promise<{ status: string; error?: string }> {
  const { conversion_id, conversion_label, developer_token, customer_id, refresh_token } = config;
  if (!conversion_id || !conversion_label || !developer_token || !customer_id || !refresh_token) {
    return { status: "failed", error: "missing google config fields" };
  }

  // Exchange refresh_token for access_token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token,
      client_id: Deno.env.get("GOOGLE_CLIENT_ID") ?? "",
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "",
    }),
  });
  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok) return { status: "failed", error: `token exchange failed: ${JSON.stringify(tokenJson)}` };

  const conversionBody = {
    conversions: [
      {
        gclid: null,
        conversion_action: `customers/${customer_id}/conversionActions/${conversion_id}`,
        conversion_date_time: new Date().toISOString().replace("T", " ").substring(0, 19) + "+00:00",
        conversion_value: 1.0,
        currency_code: "USD",
        order_id: payload.scan_id,
      },
    ],
  };

  const convRes = await fetch(
    `https://googleads.googleapis.com/v14/customers/${customer_id}:uploadClickConversions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${tokenJson.access_token}`,
        "developer-token": developer_token,
      },
      body: JSON.stringify(conversionBody),
    },
  );
  const convJson = await convRes.json();
  if (!convRes.ok) return { status: "failed", error: JSON.stringify(convJson) };
  return { status: "sent" };
}

async function fireShopify(
  config: Record<string, string>,
  payload: FirePayload,
): Promise<{ status: string; error?: string }> {
  const { webhook_url, secret } = config;
  if (!webhook_url) return { status: "failed", error: "missing webhook_url" };
  // SSRF guard -- webhook_url is advertiser-supplied; see webhookUrlGuard.ts.
  if (!isSafeWebhookUrl(webhook_url)) return { status: "failed", error: "webhook_url is not allowed" };

  const body = JSON.stringify({
    event: "scan.created",
    scan_id: payload.scan_id,
    campaign_id: payload.campaign_id,
    advertiser_id: payload.advertiser_id,
    timestamp: new Date().toISOString(),
  });

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret) {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
    headers["X-Shopify-Hmac-Sha256"] = btoa(String.fromCharCode(...new Uint8Array(sig)));
  }

  const res = await fetch(webhook_url, { method: "POST", headers, body });
  if (!res.ok) return { status: "failed", error: `HTTP ${res.status}` };
  return { status: "sent" };
}

async function fireForPlatform(
  platform: string,
  config: Record<string, string>,
  payload: FirePayload,
): Promise<{ status: string; error?: string }> {
  if (platform === "meta") return fireMeta(config, payload);
  if (platform === "google") return fireGoogle(config, payload);
  if (platform === "shopify") return fireShopify(config, payload);
  return { status: "failed", error: `unknown platform: ${platform}` };
}

Deno.serve(async (req: Request) => {
  // Two callers: scan-redirect (server-to-server, real scans) authenticates
  // with the internal secret. AdvIntegrationsView.jsx's "Send Test Event"
  // button sends the advertiser's own session JWT instead -- there was no
  // code path accepting that at all, so every test click 401'd
  // unconditionally and the feature never worked.
  const authHeader = req.headers.get("Authorization") ?? "";
  const isInternal = !!INTERNAL_SECRET && authHeader === `Bearer ${INTERNAL_SECRET}`;

  let testCallerId: string | null = null;
  if (!isInternal) {
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return new Response("Unauthorized", { status: 401 });
    testCallerId = user.id;
  }

  const payload: FirePayload = await req.json();
  const { scan_id, campaign_id } = payload;
  // A test caller can only ever fire against their own advertiser_id --
  // never trust the client-supplied value for anything but the internal
  // (already-trusted) caller.
  const advertiser_id = isInternal ? payload.advertiser_id : testCallerId!;

  if (!scan_id || !advertiser_id) {
    return new Response("Missing scan_id or advertiser_id", { status: 400 });
  }

  // Test path: fire exactly the draft platform/config being edited in the
  // modal right now, not whatever (if anything) is already saved for this
  // advertiser -- and never write a fake test firing into integration_events,
  // the real per-scan delivery log.
  if (testCallerId && payload._test_platform && payload._test_config) {
    const result = await fireForPlatform(payload._test_platform, payload._test_config, payload);
    return new Response(JSON.stringify({ fired: result.status === "sent" ? 1 : 0, results: [{ platform: payload._test_platform, ...result }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: integrations } = await supabase
    .from("advertiser_integrations")
    .select("*")
    .eq("advertiser_id", advertiser_id)
    .eq("enabled", true);

  if (!integrations?.length) {
    return new Response(JSON.stringify({ fired: 0 }), { status: 200 });
  }

  const results = await Promise.allSettled(
    integrations.map(async (intg) => {
      const result = await fireForPlatform(intg.platform, intg.config, payload);

      await supabase.from("integration_events").insert({
        advertiser_id,
        platform: intg.platform,
        event_type: intg.platform === "meta" ? "ViewContent" : intg.platform === "google" ? "Conversion" : "scan.created",
        scan_id,
        status: result.status,
        error: result.error ?? null,
      });

      return { platform: intg.platform, ...result };
    }),
  );

  const fired = results.filter((r) => r.status === "fulfilled").length;
  return new Response(JSON.stringify({ fired, results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
