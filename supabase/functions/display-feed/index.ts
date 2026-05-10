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
    .select("id, name, operator_id, status, operating_hours_start, operating_hours_end")
    .eq("screen_token", screenToken)
    .single();

  if (screenError || !screen) {
    return new Response(JSON.stringify({ error: "Invalid screen token" }), { status: 404, headers: CORS });
  }

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const currentDay = dayNames[now.getDay()];

  const { data: campaigns } = await supabase
    .from("bookings")
    .select("id, advertiser_name, headline, cta, accent_color, destination_url, category, slots, duration, schedule_days, time_start, time_end")
    .eq("screen_name", screen.name)
    .in("status", ["scheduled", "active"])
    .lte("start_date", today)
    .gte("end_date", today);

  const activeCampaigns = (campaigns ?? []).filter(c => {
    const days: string[] = c.schedule_days ?? [];
    const inDay = days.length === 0 || days.includes(currentDay);
    const inTime = currentTime >= (c.time_start ?? "00:00") && currentTime <= (c.time_end ?? "23:59");
    return inDay && inTime;
  });

  // Log heartbeat (fire and forget)
  supabase.from("display_heartbeats").insert({
    screen_id: screen.id,
    campaign_id: activeCampaigns[0]?.id ?? null,
    status: activeCampaigns.length > 0 ? "playing" : "idle",
  }).then(() => {});

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
