import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Content-Type": "application/json",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const url = new URL(req.url);
  const screenToken = url.searchParams.get("token");

  if (!screenToken) {
    return new Response(JSON.stringify({ error: "token required" }), { status: 400, headers: CORS });
  }

  const { data: screen, error: screenError } = await supabase
    .from("screens")
    .select("id, name, operator_id, status, operating_hours_start, operating_hours_end, timezone")
    .eq("screen_token", screenToken)
    .single();

  if (screenError || !screen) {
    return new Response(JSON.stringify({ error: "Invalid screen token" }), { status: 404, headers: CORS });
  }

  const tz = (screen.timezone as string | null) ?? "America/Toronto";
  const now = new Date();

  // Derive local date/time/day in the screen's own timezone
  const localParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
    weekday: "short",
  }).formatToParts(now);

  const get = (type: string) => localParts.find((p) => p.type === type)?.value ?? "";
  const today = `${get("year")}-${get("month")}-${get("day")}`;
  const currentTime = `${get("hour").padStart(2, "0")}:${get("minute").padStart(2, "0")}`;
  const dayNames: Record<string, string> = { Sun: "Sun", Mon: "Mon", Tue: "Tue", Wed: "Wed", Thu: "Thu", Fri: "Fri", Sat: "Sat" };
  const currentDay = dayNames[get("weekday")] ?? get("weekday");

  // Enforce operating hours — return empty feed outside configured window
  const opStart = screen.operating_hours_start as string | null;
  const opEnd   = screen.operating_hours_end   as string | null;
  if (opStart && opEnd && (currentTime < opStart || currentTime > opEnd)) {
    return new Response(
      JSON.stringify({ screen_id: screen.id, screen_name: screen.name, current_time: currentTime, campaigns: [] }),
      { headers: CORS },
    );
  }

  // Step 1: find approved campaign_screens for this screen (includes per-screen creative overrides)
  const { data: csRows } = await supabase
    .from("campaign_screens")
    .select("campaign_id, status, headline, cta_text, accent_color, destination_url, media_url, media_type")
    .eq("screen_id", screen.id)
    .in("status", ["approved", "auto_approved"]);

  const activeCampaigns: Record<string, unknown>[] = [];

  if (csRows && csRows.length > 0) {
    const campaignIds = csRows.map((r) => r.campaign_id);

    // Step 2: fetch bookings for those campaigns filtered by date and live status
    const { data: bookings } = await supabase
      .from("bookings")
      .select("id, advertiser_name, headline, cta_text, accent_color, destination_url, category, media_url, media_type, slots, duration, schedule_days, time_start, time_end")
      .in("id", campaignIds)
      .in("status", ["scheduled", "active"])
      .eq("payment_status", "paid")
      .lte("start_date", today)
      .gte("end_date", today);

    if (bookings) {
      const csMap = new Map(csRows.map((r) => [r.campaign_id, r]));

      for (const b of bookings) {
        const cs = csMap.get(b.id);
        const days: string[] = (b.schedule_days as string[]) ?? [];
        const inDay = days.length === 0 || days.includes(currentDay);
        const inTime = currentTime >= ((b.time_start as string) ?? "00:00") && currentTime <= ((b.time_end as string) ?? "23:59");
        if (!inDay || !inTime) continue;
        // Apply per-screen creative overrides from campaign_screens
        activeCampaigns.push({
          ...b,
          cta: cs?.cta_text || b.cta_text,
          headline: cs?.headline || b.headline,
          accent_color: cs?.accent_color || b.accent_color,
          destination_url: cs?.destination_url || b.destination_url,
          media_url: cs?.media_url || b.media_url,
          media_type: cs?.media_type || b.media_type,
        });
      }
    }
  }

  // Log heartbeat + keep last_seen fresh (fire and forget).
  // last_seen update ensures idle screens (no active campaigns) still show as
  // online in the operator dashboard — impression ingest only fires when playing.
  const now_iso = new Date().toISOString();
  supabase.from("display_heartbeats").insert({
    screen_id: screen.id,
    campaign_id: activeCampaigns.length === 1 ? (activeCampaigns[0].id as string) : null,
    status: activeCampaigns.length > 0 ? "playing" : "idle",
  }).then(() => {});
  supabase.from("screens").update({ last_seen: now_iso }).eq("id", screen.id).then(() => {});

  return new Response(
    JSON.stringify({
      screen_id: screen.id,
      screen_name: screen.name,
      current_time: currentTime,
      campaigns: activeCampaigns,
    }),
    { headers: CORS },
  );
});
