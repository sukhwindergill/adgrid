import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isBotUserAgent, dedupKey, DEDUP_WINDOW_MS } from "../_shared/scanQuality.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const campaignId = url.searchParams.get("c");
  const creativeId = url.searchParams.get("cr");

  if (!campaignId) {
    return new Response("Missing campaign id", { status: 400 });
  }

  // Look up campaign
  const { data: campaign, error } = await supabase
    .from("bookings")
    .select("destination_url, advertiser_id, status, payment_status")
    .eq("id", campaignId)
    .single();

  if (error || !campaign) {
    return new Response("Campaign not found", { status: 404 });
  }

  // Only a live, paid campaign's QR should keep counting scans and
  // redirecting — a rejected/paused/expired/unpaid campaign's code should
  // stop working, matching what display-feed actually serves.
  if (!["scheduled", "active"].includes(campaign.status) || campaign.payment_status !== "paid") {
    return new Response("Campaign not active", { status: 410 });
  }

  const { destination_url, advertiser_id } = campaign;

  // screen_id: prefer ?s= param passed by DisplayPlayer QR, fall back to campaign_screens lookup
  let screen_id: string | null = url.searchParams.get("s");
  if (!screen_id) {
    const { data: cs } = await supabase
      .from("campaign_screens")
      .select("screen_id")
      .eq("campaign_id", campaignId)
      .limit(1)
      .maybeSingle();
    screen_id = cs?.screen_id ?? null;
  }

  // Derive device type from User-Agent
  const ua = req.headers.get("user-agent") ?? "";
  const device_type = /mobile|android|iphone|ipad/i.test(ua)
    ? "mobile"
    : "desktop";

  // Geolocate via CF-IPCountry header (Cloudflare, best-effort) — this is a
  // 2-letter country code, not a city; the column is named accordingly.
  const country = req.headers.get("cf-ipcountry") ?? null;

  // Quality flags. Every request is still recorded and still redirected — a
  // filtered scan is a reporting decision, not a reason to break someone's
  // link — but bots and repeat hits are excluded from reported counts.
  const ip = req.headers.get("cf-connecting-ip")
    ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    ?? "";
  const is_bot = isBotUserAgent(ua);
  const key = await dedupKey(campaignId, screen_id, ip, ua);

  const { data: recent } = await supabase
    .from("scans")
    .select("id")
    .eq("dedup_key", key)
    .gte("scanned_at", new Date(Date.now() - DEDUP_WINDOW_MS).toISOString())
    .limit(1)
    .maybeSingle();

  const is_duplicate = Boolean(recent);

  // Insert scan record (awaited to ensure data is not lost)
  const { data: scanRow } = await supabase.from("scans").insert({
    campaign_id: campaignId,
    creative_id: creativeId,
    screen_id,
    advertiser_id,
    device_type,
    country,
    utm_source: "adgrid",
    utm_medium: "ooh",
    utm_campaign: campaignId,
    is_bot,
    is_duplicate,
    dedup_key: key,
  }).select("id").single();

  // Check scan milestones non-blocking. Bots and repeat hits must not be able
  // to trip a milestone notification.
  if (scanRow?.id && !is_bot && !is_duplicate) {
    (async () => {
      const { count } = await supabase.from("scans")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaignId)
        .eq("is_bot", false)
        .eq("is_duplicate", false);
      const total = count ?? 0;
      const MILESTONES = [100, 500, 1000, 5000];
      const hit = MILESTONES.find(m => total === m);
      if (hit) {
        const { data: bk } = await supabase.from("bookings").select("advertiser_name").eq("id", campaignId).single();
        fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-notification`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-internal-secret": Deno.env.get("INTERNAL_NOTIFICATION_SECRET") ?? "" },
          body: JSON.stringify({ userId: advertiser_id, type: "scan_milestone", data: { campaignName: bk?.advertiser_name ?? "", count: String(hit), appUrl: Deno.env.get("PUBLIC_APP_URL") ?? "" } }),
        }).catch(() => {});
      }
    })();
  }

  // Fire integrations non-blocking — must not delay redirect. A bot or a
  // repeat hit must never forward a conversion to Meta/Google.
  if (scanRow?.id && !is_bot && !is_duplicate) {
    fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/fire-integration`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("INTERNAL_NOTIFICATION_SECRET")}`,
      },
      body: JSON.stringify({
        scan_id: scanRow.id,
        advertiser_id,
        campaign_id: campaignId,
        email: null,
        consent: false,
      }),
    }).catch(() => {});
  }

  // Build destination URL with UTM params
  let dest: URL;
  try {
    dest = new URL(destination_url);
  } catch {
    return new Response("Invalid destination URL", { status: 400 });
  }
  if (dest.protocol !== "https:" && dest.protocol !== "http:") {
    return new Response("Invalid destination URL", { status: 400 });
  }
  if (!dest.searchParams.has("utm_source")) {
    dest.searchParams.set("utm_source", "adgrid");
    dest.searchParams.set("utm_medium", "ooh");
    dest.searchParams.set("utm_campaign", campaignId);
  }

  return Response.redirect(dest.toString(), 302);
});
