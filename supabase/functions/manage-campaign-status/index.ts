import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rateLimited, rateLimitResponse } from "../_shared/rateLimit.ts";

// Product-audit finding: CampaignDetail.jsx's Danger Zone (Pause/Resume/
// Cancel Campaign) called onUpdate({...c, status: ...}) -> App.jsx's
// updateCampaign, which -- per its own comment -- only ever writes to the
// server for the "becomingActive" (payment) transition and otherwise just
// calls setCampaigns/setDetail with the new status: a pure client-side
// state mutation with NO backend write at all. CampaignRow.jsx's own
// "Cancel" button was worse: it called bookings.update({status:'cancelled'})
// directly, which fails outright (authenticated has no column-level UPDATE
// grant on bookings.status, AND 'cancelled' isn't even a value the
// bookings_status_check constraint allows) with the resulting error
// silently swallowed (`if (error) return;`, no toast).
//
// Net effect either way: clicking Pause/Resume/Cancel showed the advertiser
// a confident status change with zero persistence. The campaign kept
// running -- and, if active, kept being billed/delivered -- exactly as
// before, with no error and no indication anything had failed.
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Content-Type": "application/json",
};

// bookings_status_check has no 'cancelled' value -- 'completed' is the only
// terminal status the schema allows, and is what the Danger Zone's own
// "Cancel Campaign" copy already maps to.
const ACTIONS = new Set(["pause", "resume", "cancel"]);
const PAUSABLE_FROM = new Set(["active", "scheduled"]);
const CANCELLABLE_FROM = new Set(["pending_review", "active", "paused", "scheduled"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: CORS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });

  if (await rateLimited(supabase, `manage-campaign-status:${user.id}`, { limit: 30, windowSeconds: 3600 })) {
    return rateLimitResponse(CORS);
  }

  const { campaign_id, action } = await req.json().catch(() => ({}));
  if (!campaign_id || typeof campaign_id !== "string" || !ACTIONS.has(action)) {
    return new Response(JSON.stringify({ error: "campaign_id and a valid action ('pause', 'resume', or 'cancel') are required" }), { status: 400, headers: CORS });
  }

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, advertiser_id, status, start_date")
    .eq("id", campaign_id)
    .maybeSingle();

  if (!booking) {
    return new Response(JSON.stringify({ error: "Campaign not found" }), { status: 404, headers: CORS });
  }
  // Only the advertiser who owns this campaign may pause/resume/cancel it --
  // never the operator whose screen it happens to run on (see the shared
  // CampaignDetail component's own header comment: this Danger Zone tab is
  // not currently gated to isAdvertiserView, but the server boundary is
  // what actually has to hold regardless of what the client renders).
  if (booking.advertiser_id !== user.id) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: CORS });
  }

  let newStatus: string;
  if (action === "pause") {
    if (!PAUSABLE_FROM.has(booking.status)) {
      return new Response(JSON.stringify({ error: `Cannot pause a campaign with status '${booking.status}'` }), { status: 409, headers: CORS });
    }
    newStatus = "paused";
  } else if (action === "resume") {
    if (booking.status !== "paused") {
      return new Response(JSON.stringify({ error: `Cannot resume a campaign with status '${booking.status}'` }), { status: 409, headers: CORS });
    }
    // Mirror notification-cron's own scheduled->active transition: only
    // "active" once the start date has actually arrived.
    const today = new Date().toISOString().slice(0, 10);
    newStatus = booking.start_date && booking.start_date <= today ? "active" : "scheduled";
  } else {
    if (!CANCELLABLE_FROM.has(booking.status)) {
      return new Response(JSON.stringify({ error: `Cannot cancel a campaign with status '${booking.status}'` }), { status: 409, headers: CORS });
    }
    newStatus = "completed";
  }

  const { error: updateError } = await supabase
    .from("bookings")
    .update({ status: newStatus })
    .eq("id", campaign_id);

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), { status: 500, headers: CORS });
  }

  return new Response(JSON.stringify({ ok: true, status: newStatus }), { headers: CORS });
});
