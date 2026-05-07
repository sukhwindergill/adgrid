import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const campaignId = url.searchParams.get("c");

  if (!campaignId) {
    return new Response("Missing campaign id", { status: 400 });
  }

  // Look up campaign
  const { data: campaign, error } = await supabase
    .from("bookings")
    .select("destination_url, screen_id, advertiser_id")
    .eq("id", campaignId)
    .single();

  if (error || !campaign) {
    return new Response("Campaign not found", { status: 404 });
  }

  const { destination_url, screen_id, advertiser_id } = campaign;

  // Derive device type from User-Agent
  const ua = req.headers.get("user-agent") ?? "";
  const device_type = /mobile|android|iphone|ipad/i.test(ua)
    ? "mobile"
    : "desktop";

  // Geolocate via CF-IPCountry header (Cloudflare, best-effort)
  const city = req.headers.get("cf-ipcountry") ?? null;

  // Insert scan record (awaited to ensure data is not lost)
  const { data: scanRow } = await supabase.from("scans").insert({
    campaign_id: campaignId,
    screen_id,
    advertiser_id,
    device_type,
    city,
    utm_source: "adgrid",
    utm_medium: "ooh",
    utm_campaign: campaignId,
  }).select("id").single();

  // Fire integrations non-blocking — must not delay redirect
  if (scanRow?.id) {
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
  const dest = new URL(destination_url);
  if (!dest.searchParams.has("utm_source")) {
    dest.searchParams.set("utm_source", "adgrid");
    dest.searchParams.set("utm_medium", "ooh");
    dest.searchParams.set("utm_campaign", campaignId);
  }

  return Response.redirect(dest.toString(), 302);
});
