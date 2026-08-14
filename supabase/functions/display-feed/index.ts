import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { expandCreativeAssignments } from "../_shared/creativeSelection.ts";
import { clampDurationToScreen } from "../_shared/adDuration.ts";

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
    .select("id, name, operator_id, status, operating_hours_start, operating_hours_end, timezone, max_ad_duration")
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
      .select("id, advertiser_name, headline, cta_text, accent_color, destination_url, category, media_url, media_type, qr_x, qr_y, qr_size_pct, qr_fg_color, qr_bg_color, slots, duration, schedule_days, time_start, time_end")
      .in("id", campaignIds)
      .in("status", ["scheduled", "active"])
      .eq("payment_status", "paid")
      .lte("start_date", today)
      .gte("end_date", today);

    // Step 3: this screen's explicit creative assignments (Phase 1 schema),
    // grouped by which targeting group (booking) they belong to. A booking
    // with no rows here falls all the way through to its own single
    // creative fields, unchanged from today.
    const { data: ccsRows } = await supabase
      .from("campaign_creative_screens")
      .select("creative_id, weight")
      .eq("screen_id", screen.id);

    const creativesByTargeting = new Map<string, { creative_id: string; weight: number; media_url: string | null; media_type: string | null; headline: string | null; cta_text: string | null; destination_url: string | null; accent_color: string | null; qr_x: number | null; qr_y: number | null; qr_size_pct: number | null; qr_fg_color: string | null; qr_bg_color: string | null }[]>();

    if (ccsRows && ccsRows.length > 0) {
      const creativeIds = ccsRows.map((r) => r.creative_id);
      const { data: creatives } = await supabase
        .from("campaign_creatives")
        .select("id, targeting_id, status, media_url, media_type, headline, cta_text, destination_url, accent_color, qr_x, qr_y, qr_size_pct, qr_fg_color, qr_bg_color")
        .in("id", creativeIds)
        .eq("status", "active");

      const weightById = new Map(ccsRows.map((r) => [r.creative_id, r.weight as number]));
      for (const cr of creatives ?? []) {
        const list = creativesByTargeting.get(cr.targeting_id as string) ?? [];
        list.push({
          creative_id: cr.id as string,
          weight: weightById.get(cr.id as string) ?? 100,
          media_url: cr.media_url as string | null,
          media_type: cr.media_type as string | null,
          headline: cr.headline as string | null,
          cta_text: cr.cta_text as string | null,
          destination_url: cr.destination_url as string | null,
          accent_color: cr.accent_color as string | null,
          qr_x: cr.qr_x as number | null,
          qr_y: cr.qr_y as number | null,
          qr_size_pct: cr.qr_size_pct as number | null,
          qr_fg_color: cr.qr_fg_color as string | null,
          qr_bg_color: cr.qr_bg_color as string | null,
        });
        creativesByTargeting.set(cr.targeting_id as string, list);
      }
    }

    if (bookings) {
      const csMap = new Map(csRows.map((r) => [r.campaign_id, r]));

      for (const b of bookings) {
        const cs = csMap.get(b.id);
        const days: string[] = (b.schedule_days as string[]) ?? [];
        const inDay = days.length === 0 || days.includes(currentDay);
        const inTime = currentTime >= ((b.time_start as string) ?? "00:00") && currentTime <= ((b.time_end as string) ?? "23:59");
        if (!inDay || !inTime) continue;

        const assignments = creativesByTargeting.get(b.id as string) ?? [];

        if (assignments.length === 0) {
          // Unchanged from today: per-screen override falls back to the booking's own fields.
          activeCampaigns.push({
            ...b,
            creative_id: null,
            cta: cs?.cta_text || b.cta_text,
            headline: cs?.headline || b.headline,
            accent_color: cs?.accent_color || b.accent_color,
            destination_url: cs?.destination_url || b.destination_url,
            media_url: cs?.media_url || b.media_url,
            media_type: cs?.media_type || b.media_type,
            duration: clampDurationToScreen(b.duration as number, screen.max_ad_duration as number | null),
          });
          continue;
        }

        // One or more creatives explicitly assigned to this screen — expand by
        // weight and push one array entry per slot. The legacy per-screen
        // override columns on campaign_screens are not consulted here; the
        // new campaign_creatives fields are the sole source once they exist.
        const creativeById = new Map(assignments.map((a) => [a.creative_id, a]));
        const order = expandCreativeAssignments(assignments.map((a) => ({ creative_id: a.creative_id, weight: a.weight })));

        for (const creativeId of order) {
          const cr = creativeById.get(creativeId)!;
          activeCampaigns.push({
            ...b,
            creative_id: creativeId,
            cta: cr.cta_text || b.cta_text,
            headline: cr.headline || b.headline,
            accent_color: cr.accent_color || b.accent_color,
            destination_url: cr.destination_url || b.destination_url,
            media_url: cr.media_url || b.media_url,
            media_type: cr.media_type || b.media_type,
            qr_x: cr.qr_x ?? b.qr_x,
            qr_y: cr.qr_y ?? b.qr_y,
            qr_size_pct: cr.qr_size_pct ?? b.qr_size_pct,
            qr_fg_color: cr.qr_fg_color ?? b.qr_fg_color,
            qr_bg_color: cr.qr_bg_color ?? b.qr_bg_color,
            duration: clampDurationToScreen(b.duration as number, screen.max_ad_duration as number | null),
          });
        }
      }
    }
  }

  // Log heartbeat + keep last_seen fresh (fire and forget).
  // last_seen update ensures idle screens (no active campaigns) still show as
  // online in the operator dashboard — impression ingest only fires when playing.
  const now_iso = new Date().toISOString();
  const activeBookingIds = new Set(activeCampaigns.map((c) => c.id as string));
  supabase.from("display_heartbeats").insert({
    screen_id: screen.id,
    campaign_id: activeBookingIds.size === 1 ? [...activeBookingIds][0] : null,
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
