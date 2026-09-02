import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rateLimited, rateLimitResponse } from "../_shared/rateLimit.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Content-Type": "application/json",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401, headers: CORS });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return new Response("Unauthorized", { status: 401, headers: CORS });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: CORS });
  }
  const { screen_id } = body as Record<string, unknown>;
  if (!screen_id) {
    return new Response(JSON.stringify({ error: "screen_id required" }), { status: 400, headers: CORS });
  }

  // Only the operator who owns this screen may invite advertisers to it.
  const { data: screen, error: screenError } = await supabase
    .from("screens")
    .select("id, operator_id")
    .eq("id", screen_id)
    .single();

  if (screenError || !screen) {
    return new Response(JSON.stringify({ error: "Screen not found" }), { status: 404, headers: CORS });
  }
  if (screen.operator_id !== user.id) {
    return new Response("Forbidden — you don't own this screen", { status: 403, headers: CORS });
  }

  if (await rateLimited(supabase, `create-screen-invite:${user.id}`, { limit: 30, windowSeconds: 3600 })) {
    return rateLimitResponse(CORS);
  }

  const { data: invite, error: insertError } = await supabase
    .from("screen_invites")
    .insert({ screen_id, operator_id: user.id })
    .select("token")
    .single();

  if (insertError || !invite) {
    return new Response(
      JSON.stringify({ error: insertError?.message ?? "Failed to create invite" }),
      { status: 500, headers: CORS },
    );
  }

  const origin = req.headers.get("origin") ?? Deno.env.get("APP_URL") ?? "http://localhost:5173";
  const url = `${origin}/invite/screen/${invite.token}`;

  return new Response(JSON.stringify({ token: invite.token, url }), { headers: CORS });
});
