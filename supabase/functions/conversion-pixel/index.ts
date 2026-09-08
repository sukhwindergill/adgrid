// AdGrid conversion pixel (Competitive Parity Program, Phase 6, G9 widen --
// see docs/superpowers/specs/2026-09-08-conversion-pixel-postback-design.md).
// Public, unauthenticated -- a pixel fired from an advertiser's own webpage
// can't carry a secret. Resolves an adgrid_cid (from a QR-scan click) or a
// promo_code (for someone who never scanned) to a campaign, records a
// conversion, and always returns a valid 1x1 GIF -- a broken pixel response
// would break the advertiser's page load, which is worse than a silently
// unresolved conversion.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rateLimited, clientIp } from "../_shared/rateLimit.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// 1x1 transparent GIF.
const PIXEL_BYTES = Uint8Array.from(
  atob("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="),
  (c) => c.charCodeAt(0),
);

function pixelResponse(): Response {
  return new Response(PIXEL_BYTES, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store",
    },
  });
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const adgridCid = url.searchParams.get("adgrid_cid");
  const promoCode = url.searchParams.get("promo_code");
  const valueParam = url.searchParams.get("value");
  const currency = url.searchParams.get("currency") || null;

  // Generous per-IP cap -- a pixel firing from real page loads is not a
  // flood; this only stops a scripted hammering of the endpoint.
  if (await rateLimited(supabase, `conversion-pixel:${clientIp(req)}`, { limit: 120, windowSeconds: 60 })) {
    return pixelResponse();
  }

  if (!adgridCid && !promoCode) return pixelResponse();

  const orderValue = valueParam !== null && Number.isFinite(Number(valueParam)) ? Number(valueParam) : null;

  try {
    if (adgridCid) {
      const { data: scan } = await supabase
        .from("scans")
        .select("id, campaign_id, advertiser_id")
        .eq("id", adgridCid)
        .maybeSingle();
      if (scan?.campaign_id && scan?.advertiser_id) {
        await supabase.from("conversions").insert({
          campaign_id: scan.campaign_id,
          advertiser_id: scan.advertiser_id,
          scan_id: scan.id,
          source: "scan",
          order_value: orderValue,
          currency,
          verified: false,
          received_via: "pixel",
        });
      }
    } else if (promoCode) {
      const { data: promo } = await supabase
        .from("campaign_promo_codes")
        .select("id, campaign_id, advertiser_id")
        .eq("code", promoCode)
        .maybeSingle();
      if (promo) {
        await supabase.from("conversions").insert({
          campaign_id: promo.campaign_id,
          advertiser_id: promo.advertiser_id,
          promo_code_id: promo.id,
          source: "promo_code",
          order_value: orderValue,
          currency,
          verified: false,
          received_via: "pixel",
        });
      }
    }
  } catch (err) {
    // Never let a DB hiccup surface as a broken pixel response.
    console.error("[conversion-pixel] insert failed:", err);
  }

  return pixelResponse();
});
