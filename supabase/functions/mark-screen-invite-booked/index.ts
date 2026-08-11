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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: CORS });
  }
  const { token, campaign_id } = body as { token?: string; campaign_id?: string };
  if (!token || !campaign_id) {
    return new Response(JSON.stringify({ error: "token and campaign_id required" }), { status: 400, headers: CORS });
  }

  const { data: invite, error: findError } = await supabase
    .from("screen_invites")
    .select("id, status, converted_advertiser_id, operator_id, screen_id")
    .eq("token", token)
    .single();

  if (findError || !invite) {
    return new Response(JSON.stringify({ error: "Invite not found" }), { status: 404, headers: CORS });
  }
  // Only the advertiser this invite actually converted to signed_up for may
  // mark it booked -- prevents an unrelated caller from forging conversion
  // credit onto someone else's invite.
  if (invite.converted_advertiser_id !== user.id) {
    return new Response("Forbidden", { status: 403, headers: CORS });
  }
  if (invite.status === "booked") {
    return new Response(JSON.stringify({ ok: true }), { headers: CORS });
  }

  // Conditioned on still being signed_up (not already booked) to avoid the
  // same read-then-write race Task 4's review found and fixed in
  // accept-screen-invite: two near-simultaneous calls (e.g. a double-clicked
  // submit) could otherwise both pass the status !== 'booked' check above
  // and both proceed to an unconditioned update. Whichever loses the race
  // here just falls through to the same "ok:true" idempotent response as
  // the already-booked branch, rather than double-processing.
  const { data: updated, error: updateError } = await supabase
    .from("screen_invites")
    .update({ status: "booked", booked_at: new Date().toISOString(), converted_campaign_id: campaign_id })
    .eq("id", invite.id)
    .eq("status", "signed_up")
    .select("id")
    .maybeSingle();

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), { status: 500, headers: CORS });
  }
  if (!updated) {
    // Someone else's request won the race and already booked this invite.
    return new Response(JSON.stringify({ ok: true }), { headers: CORS });
  }

  const { data: screen } = await supabase.from("screens").select("name").eq("id", invite.screen_id).single();
  await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-notification`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-secret": Deno.env.get("INTERNAL_NOTIFICATION_SECRET") ?? "" },
    body: JSON.stringify({
      userId: invite.operator_id,
      type: "screen_invite_booked",
      data: { screenName: screen?.name ?? "your screen", appUrl: Deno.env.get("PUBLIC_APP_URL") ?? "" },
    }),
  }).catch(() => {});

  return new Response(JSON.stringify({ ok: true }), { headers: CORS });
});
