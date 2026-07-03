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

  // Clamp untrusted values — the screen token is a shared secret sent from the
  // field agent, so bound every numeric field to a sane range to stop a leaked
  // token from poisoning analytics with absurd counts.
  const clampInt = (v: unknown, max: number) => {
    const n = Math.floor(Number(v) || 0);
    return Math.min(Math.max(n, 0), max);
  };
  const clampFloat = (v: unknown, max: number) => {
    const n = Number(v) || 0;
    return Math.min(Math.max(n, 0), max);
  };
  const MAX_PEOPLE = 5000;

  // Derive window timestamps if not provided (browser player sends dwell_seconds)
  const dwellSecs = clampFloat(Number(dwell_seconds) || Number(avg_dwell_seconds) || 10, 86400);
  const winEnd = window_end ? new Date(window_end as string) : new Date();
  const winStart = window_start ? new Date(window_start as string) : new Date(winEnd.getTime() - dwellSecs * 1000);

  const { error: insertError } = await supabase.from("impression_events").insert({
    screen_id: screen.id,
    campaign_id: campaign_id ?? null,
    window_start: winStart.toISOString(),
    window_end: winEnd.toISOString(),
    people_count: clampInt(people_count, MAX_PEOPLE),
    avg_dwell_seconds: dwellSecs,
    avg_attention_score: clampFloat(Number(attention_score) || Number(avg_attention_score) || 0, 1),
    age_18_24: clampInt(age_18_24, MAX_PEOPLE),
    age_25_34: clampInt(age_25_34, MAX_PEOPLE),
    age_35_44: clampInt(age_35_44, MAX_PEOPLE),
    age_45_54: clampInt(age_45_54, MAX_PEOPLE),
    age_55_plus: clampInt(age_55_plus, MAX_PEOPLE),
    gender_male: clampInt(gender_male, MAX_PEOPLE),
    gender_female: clampInt(gender_female, MAX_PEOPLE),
    gender_unknown: clampInt(gender_unknown, MAX_PEOPLE),
  });

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), { status: 500, headers: CORS });
  }

  return new Response(JSON.stringify({ success: true }), { headers: CORS });
});
