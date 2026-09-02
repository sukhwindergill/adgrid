import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validatePlayBatch } from "../_shared/playValidation.ts";
import { requestTooLarge } from "../_shared/requestSize.ts";
import { rateLimited, rateLimitResponse } from "../_shared/rateLimit.ts";

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
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: CORS });
  if (requestTooLarge(req, 1048576)) return new Response(JSON.stringify({ error: "Payload too large" }), { status: 413, headers: CORS });

  let body: { screen_token?: string; plays?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: CORS });
  }

  if (!body.screen_token) {
    return new Response(JSON.stringify({ error: "screen_token required" }), { status: 400, headers: CORS });
  }

  // DisplayPlayer flushes its play buffer once per FLUSH_INTERVAL_MS (60s)
  // as a single batched POST -- ~1/min steady state. 15/min leaves headroom
  // for a page reload or a retried flush without opening the door to a
  // scripted flood.
  if (await rateLimited(supabase, `ingest-plays:${body.screen_token}`, { limit: 15, windowSeconds: 60 })) {
    return rateLimitResponse(CORS);
  }

  const { data: screen, error: screenError } = await supabase
    .from("screens")
    .select("id")
    .eq("screen_token", body.screen_token)
    .single();

  if (screenError || !screen) {
    return new Response(JSON.stringify({ error: "Invalid screen token" }), { status: 401, headers: CORS });
  }

  const { accepted, rejected } = validatePlayBatch(body.plays);

  if (accepted.length === 0) {
    return new Response(JSON.stringify({ inserted: 0, rejected }), { headers: CORS });
  }

  // Upsert on (screen_id, client_play_id) so a player retrying an unacked
  // flush cannot double-count plays.
  const { error: insertError, count } = await supabase
    .from("ad_plays")
    .upsert(
      accepted.map(p => ({ ...p, screen_id: screen.id })),
      { onConflict: "screen_id,client_play_id", ignoreDuplicates: true, count: "exact" },
    );

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), { status: 500, headers: CORS });
  }

  return new Response(JSON.stringify({ inserted: count ?? accepted.length, rejected }), { headers: CORS });
});
