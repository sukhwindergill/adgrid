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

  const { screen_token, heartbeat_only, campaign_id, people_count,
    dwell_seconds, attention_score,
    window_start, window_end,
    avg_dwell_seconds, avg_attention_score,
    age_18_24, age_25_34, age_35_44, age_45_54, age_55_plus,
    gender_male, gender_female, gender_unknown } = body as Record<string, unknown>;

  if (!screen_token) {
    return new Response(
      JSON.stringify({ error: "screen_token required" }),
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

  // Heartbeat-only: update last_seen without inserting an impression_event
  if (heartbeat_only) {
    const { error: updateError } = await supabase
      .from("screens")
      .update({ last_seen: new Date().toISOString() })
      .eq("id", screen.id);

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), { status: 500, headers: CORS });
    }
    return new Response(JSON.stringify({ ok: true }), { headers: CORS });
  }

  // Derive window timestamps if not provided (browser player sends dwell_seconds)
  const dwellSecs = Number(dwell_seconds) || Number(avg_dwell_seconds) || 10;
  const winEnd = window_end ? new Date(window_end as string) : new Date();
  const winStart = window_start ? new Date(window_start as string) : new Date(winEnd.getTime() - dwellSecs * 1000);

  const { error: insertError } = await supabase.from("impression_events").insert({
    screen_id: screen.id,
    campaign_id: campaign_id ?? null,
    window_start: winStart.toISOString(),
    window_end: winEnd.toISOString(),
    people_count: Number(people_count) || 0,
    avg_dwell_seconds: dwellSecs,
    avg_attention_score: Number(attention_score) || Number(avg_attention_score) || 0,
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
