import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  const jwt = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !user) return new Response("Unauthorized", { status: 401, headers: CORS });

  // Guard the JSON parse -- an unguarded req.json() throws on a malformed
  // body and skips straight past the CORS headers. Same bug class already
  // fixed in ingest-impressions and record-screen-invite-view.
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
    .select("id, screen_id, status")
    .eq("token", token)
    .single();

  if (findError || !invite) {
    return new Response(JSON.stringify({ error: "Invite not found" }), { status: 404, headers: CORS });
  }

  // Only pending/viewed invites can convert to signed_up. An already-booked
  // invite is terminal; re-accepting a signed_up one (e.g. a retry) is a
  // harmless no-op that returns the same screen_id rather than erroring.
  if (invite.status === "signed_up" || invite.status === "booked") {
    const { data: screen } = await supabase.from("screens").select("id, name").eq("id", invite.screen_id).single();
    return new Response(JSON.stringify({ screen_id: invite.screen_id, screen_name: screen?.name ?? "" }), { headers: CORS });
  }

  // Condition the update on the invite still being in a pre-signup state,
  // and check whether a row actually came back. Invite links are public
  // URLs that can be opened from two sessions/devices at once; without this
  // guard two near-simultaneous calls both read the invite as still
  // pending, both fall through to an unconditioned update, and whichever
  // commits last silently overwrites converted_advertiser_id -- handing
  // referral credit to the wrong user with no signal to either caller.
  const { data: updated, error: updateError } = await supabase
    .from("screen_invites")
    .update({
      status: "signed_up",
      signed_up_at: new Date().toISOString(),
      converted_advertiser_id: user.id,
    })
    .eq("id", invite.id)
    .in("status", ["pending", "viewed"])
    .select("id")
    .maybeSingle();

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), { status: 500, headers: CORS });
  }

  if (!updated) {
    // Someone else's request won the race and already converted this
    // invite between our SELECT and this UPDATE -- treat it the same as
    // the already-signed_up/booked branch: safe no-op, return whatever
    // the invite now points to (not necessarily this caller).
    const { data: screen } = await supabase.from("screens").select("id, name").eq("id", invite.screen_id).single();
    return new Response(JSON.stringify({ screen_id: invite.screen_id, screen_name: screen?.name ?? "" }), { headers: CORS });
  }

  const { data: screen } = await supabase.from("screens").select("id, name, operator_id").eq("id", invite.screen_id).single();

  // Notify the inviting operator, in-app only (email is unreliable right
  // now -- see design spec's Non-Goals). Fire-and-forget: a notification
  // failure must never block the invitee's own signup flow. Awaited (with
  // the .catch already swallowing errors) so the isolate isn't recycled
  // before the background request completes, matching charge-campaign /
  // stripe-webhook / run-automation-rules.
  if (screen?.operator_id) {
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": Deno.env.get("INTERNAL_NOTIFICATION_SECRET") ?? "" },
      body: JSON.stringify({
        userId: screen.operator_id,
        type: "screen_invite_signed_up",
        data: { screenName: screen.name ?? "your screen", appUrl: Deno.env.get("PUBLIC_APP_URL") ?? "" },
      }),
    }).catch(() => {});
  }

  return new Response(JSON.stringify({ screen_id: invite.screen_id, screen_name: screen?.name ?? "" }), { headers: CORS });
});
