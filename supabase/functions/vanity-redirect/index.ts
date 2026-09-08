// Vanity URL redirect for promo-code attribution (Competitive Parity
// Program, Phase 6, G9 widen -- see docs/superpowers/specs/2026-09-08-
// conversion-pixel-postback-design.md). For someone who saw a screen's ad
// but never scanned the QR -- the advertiser can also print a short vanity
// path (e.g. adgrid.app/go/SEEONSCREEN10) instead of/alongside a promo code.
// No scans row is written here: this isn't a QR scan, and double-writing to
// scans would corrupt existing scan-rate reporting.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rateLimited, clientIp } from "../_shared/rateLimit.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const vanityPath = url.searchParams.get("p");

  if (!vanityPath) {
    return new Response("Missing vanity path", { status: 400 });
  }

  if (await rateLimited(supabase, `vanity-redirect:${clientIp(req)}`, { limit: 60, windowSeconds: 60 })) {
    return new Response("Too many requests", { status: 429 });
  }

  const { data: promo } = await supabase
    .from("campaign_promo_codes")
    .select("id, code, campaign_id")
    .eq("vanity_path", vanityPath)
    .maybeSingle();

  if (!promo) {
    return new Response("This link isn't valid.", { status: 404 });
  }

  const { data: campaign } = await supabase
    .from("bookings")
    .select("destination_url, status, payment_status")
    .eq("id", promo.campaign_id)
    .single();

  if (!campaign || !["scheduled", "active"].includes(campaign.status) || campaign.payment_status !== "paid") {
    return new Response("This link isn't valid.", { status: 410 });
  }

  let dest: URL;
  try {
    dest = new URL(campaign.destination_url);
  } catch {
    return new Response("Invalid destination URL", { status: 400 });
  }
  if (dest.protocol !== "https:" && dest.protocol !== "http:") {
    return new Response("Invalid destination URL", { status: 400 });
  }
  if (!dest.searchParams.has("utm_source")) {
    dest.searchParams.set("utm_source", "adgrid");
    dest.searchParams.set("utm_medium", "ooh");
    dest.searchParams.set("utm_campaign", promo.campaign_id);
  }
  dest.searchParams.set("promo_code", promo.code);

  return Response.redirect(dest.toString(), 302);
});
