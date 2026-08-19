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
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: CORS });

  // Public/unauthenticated endpoint hit from the invite landing page before
  // the visitor has signed up. Guard the JSON parse — an unguarded req.json()
  // throws on a malformed body and skips straight past the CORS headers,
  // which is exactly the bug class already fixed in ingest-impressions.
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: CORS });
  }

  const { token } = body;
  if (!token) return new Response(JSON.stringify({ error: "token required" }), { status: 400, headers: CORS });

  const { data: invite, error: findError } = await supabase
    .from("screen_invites")
    .select("id, status, view_count")
    .eq("token", token)
    .single();

  if (findError || !invite) {
    return new Response(JSON.stringify({ error: "Invite not found" }), { status: 404, headers: CORS });
  }

  // A booked invite is a terminal state -- don't keep counting views or
  // resurface it as "just viewed" once it's already converted.
  if (invite.status === "booked") {
    return new Response(JSON.stringify({ ok: true, status: invite.status }), { headers: CORS });
  }

  const update: Record<string, unknown> = { view_count: invite.view_count + 1 };
  if (invite.status === "pending") {
    update.status = "viewed";
    update.viewed_at = new Date().toISOString();
  }

  const { error: updateError } = await supabase.from("screen_invites").update(update).eq("id", invite.id);
  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), { status: 500, headers: CORS });
  }

  return new Response(JSON.stringify({ ok: true, status: update.status ?? invite.status }), { headers: CORS });
});
