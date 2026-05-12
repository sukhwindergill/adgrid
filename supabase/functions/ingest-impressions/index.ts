import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Content-Type": "application/json",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: CORS });
  }

  const { screen_token, window_start, window_end, people_count,
    avg_dwell_seconds, avg_attention_score,
    age_18_24, age_25_34, age_35_44, age_45_54, age_55_plus,
    gender_male, gender_female, gender_unknown } = body as Record<string, unknown>;

  if (!screen_token || !window_start || !window_end) {
    return new Response(
      JSON.stringify({ error: "screen_token, window_start, window_end required" }),
      { status: 400, headers: CORS },
    );
  }

  // Validate screen token
  const { data: screen, error: screenError } = await supabase
    .from("screens")
    .select("id")
    .eq("screen_token", screen_token)
    .single();

  if (screenError || !screen) {
    return new Response(JSON.stringify({ error: "Invalid screen token" }), { status: 401, headers: CORS });
  }

  // Find which campaign was active during this window (if any)
  const windowMid = new Date(
    (new Date(window_start as string).getTime() + new Date(window_end as string).getTime()) / 2
  ).toISOString().split("T")[0];

  const { data: activeCampaign } = await supabase
    .from("bookings")
    .select("id")
    .eq("screen_id", screen.id)
    .in("status", ["scheduled", "active"])
    .lte("start_date", windowMid)
    .gte("end_date", windowMid)
    .limit(1)
    .maybeSingle();

  const { error: insertError } = await supabase.from("impression_events").insert({
    screen_id: screen.id,
    campaign_id: activeCampaign?.id ?? null,
    window_start,
    window_end,
    people_count: Number(people_count) || 0,
    avg_dwell_seconds: Number(avg_dwell_seconds) || 0,
    avg_attention_score: Number(avg_attention_score) || 0,
    age_18_24: Number(age_18_24) || 0,
    age_25_34: Number(age_25_34) || 0,
    age_35_44: Number(age_35_44) || 0,
    age_45_54: Number(age_45_54) || 0,
    age_55_plus: Number(age_55_plus) || 0,
    gender_male: Number(gender_male) || 0,
    gender_female: Number(gender_female) || 0,
    gender_unknown: Number(gender_unknown) || 0,
  });

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), { status: 500, headers: CORS });
  }

  return new Response(JSON.stringify({ success: true }), { headers: CORS });
});
