// AdGrid conversion postback (Competitive Parity Program, Phase 6, G9
// widen -- see docs/superpowers/specs/2026-09-08-conversion-pixel-
// postback-design.md). Server-to-server alternative to conversion-pixel,
// for advertisers reporting from their own backend (e.g. a Shopify
// order-created webhook) -- more reliable than a client-side pixel and
// lets a key prove the postback actually came from the advertiser's own
// server. The postback key hash lives in advertiser_integrations under
// platform = 'adgrid_postback' (config: { key_hash }), reusing that
// existing per-advertiser-credential table rather than adding a new one.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rateLimited, clientIp, rateLimitResponse } from "../_shared/rateLimit.ts";
import { verifyPostbackKey } from "../_shared/postbackKey.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const JSON_HEADERS = { "Content-Type": "application/json" };

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: JSON_HEADERS });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const presentedKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  // Rate-limit by the presented key (even if invalid) so a broken
  // integration retry-looping can't spam the table; fall back to IP if no
  // key was presented at all.
  const limitKey = `conversion-postback:${presentedKey || clientIp(req)}`;
  if (await rateLimited(supabase, limitKey, { limit: 60, windowSeconds: 60 })) {
    return rateLimitResponse(JSON_HEADERS);
  }

  if (!presentedKey) {
    return new Response(JSON.stringify({ error: "Missing postback key" }), { status: 401, headers: JSON_HEADERS });
  }

  // A postback key isn't scoped to one advertiser by lookup key the way a
  // password would be -- find the advertiser_integrations row whose
  // key_hash matches. Postback keys are advertiser-scoped 1:1, so this is
  // a small table scan across 'adgrid_postback' rows, not the whole table.
  const { data: candidates } = await supabase
    .from("advertiser_integrations")
    .select("advertiser_id, config")
    .eq("platform", "adgrid_postback")
    .eq("enabled", true);

  let matchedAdvertiserId: string | null = null;
  for (const row of candidates ?? []) {
    const storedHash = row.config?.key_hash;
    if (storedHash && (await verifyPostbackKey(presentedKey, storedHash))) {
      matchedAdvertiserId = row.advertiser_id;
      break;
    }
  }

  if (!matchedAdvertiserId) {
    return new Response(JSON.stringify({ error: "Invalid postback key" }), { status: 401, headers: JSON_HEADERS });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: JSON_HEADERS });
  }

  const adgridCid = typeof body.adgrid_cid === "string" ? body.adgrid_cid : null;
  const promoCode = typeof body.promo_code === "string" ? body.promo_code : null;
  const orderValue = typeof body.order_value === "number" ? body.order_value : null;
  const currency = typeof body.currency === "string" ? body.currency : null;
  const externalOrderId = typeof body.external_order_id === "string" ? body.external_order_id : null;

  if (!adgridCid && !promoCode) {
    return new Response(JSON.stringify({ error: "Provide adgrid_cid or promo_code" }), { status: 400, headers: JSON_HEADERS });
  }

  let campaignId: string | null = null;
  let scanId: string | null = null;
  let promoCodeId: string | null = null;
  let source: "scan" | "promo_code" = "scan";

  if (adgridCid) {
    const { data: scan } = await supabase
      .from("scans")
      .select("id, campaign_id, advertiser_id")
      .eq("id", adgridCid)
      .maybeSingle();
    if (!scan || scan.advertiser_id !== matchedAdvertiserId) {
      return new Response(JSON.stringify({ error: "adgrid_cid not found for this advertiser" }), { status: 404, headers: JSON_HEADERS });
    }
    campaignId = scan.campaign_id;
    scanId = scan.id;
    source = "scan";
  } else if (promoCode) {
    const { data: promo } = await supabase
      .from("campaign_promo_codes")
      .select("id, campaign_id, advertiser_id")
      .eq("code", promoCode)
      .maybeSingle();
    if (!promo || promo.advertiser_id !== matchedAdvertiserId) {
      return new Response(JSON.stringify({ error: "promo_code not found for this advertiser" }), { status: 404, headers: JSON_HEADERS });
    }
    campaignId = promo.campaign_id;
    promoCodeId = promo.id;
    source = "promo_code";
  }

  const { data: inserted, error } = await supabase.from("conversions").insert({
    campaign_id: campaignId,
    advertiser_id: matchedAdvertiserId,
    scan_id: scanId,
    promo_code_id: promoCodeId,
    source,
    order_value: orderValue,
    currency,
    external_order_id: externalOrderId,
    verified: true,
    received_via: "postback",
  }).select("id").single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: JSON_HEADERS });
  }

  return new Response(JSON.stringify({ conversion_id: inserted.id }), { status: 200, headers: JSON_HEADERS });
});
