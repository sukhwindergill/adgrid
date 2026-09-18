import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rateLimited, rateLimitResponse } from "../_shared/rateLimit.ts";
import { ACTIONS, resolveNewStatus } from "../_shared/campaignStatusRules.ts";

// Product-audit finding: CampaignDetail.jsx's Danger Zone (Pause/Resume/
// Cancel Campaign) calls onUpdate({...c, status: ...}) -> App.jsx's
// updateCampaign, which -- per its own comment -- only ever writes to the
// server for the "becomingActive" (payment) transition and otherwise just
// calls setCampaigns/setDetail with the new status: a pure client-side
// state mutation with NO backend write at all. CampaignRow.jsx's own
// "Cancel" button was worse: it called bookings.update({status:'cancelled'})
// directly, which fails outright (authenticated has no column-level UPDATE
// grant on bookings.status, AND 'cancelled' isn't even a value the
// bookings_status_check constraint allows -- 'completed' is the schema's
// only terminal status) with the resulting error silently swallowed
// (`if (error) return;`, no toast).
//
// Net effect either way: clicking Pause/Resume/Cancel showed a confident
// status change with zero persistence. The campaign kept running -- and,
// if active, kept being billed/delivered -- exactly as before, with no
// error and no indication anything had failed.
//
// Both the advertiser who owns the campaign AND an operator running it on
// one of their own screens can reach this Danger Zone (the settings tab is
// not gated to isAdvertiserView), so authorization here accepts either --
// matching operator-schedule-unpaid-campaign's own dual-ownership pattern.
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
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: CORS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });

  if (await rateLimited(supabase, `manage-campaign-status:${user.id}`, { limit: 30, windowSeconds: 3600 })) {
    return rateLimitResponse(CORS);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: CORS });
  }
  const { campaign_id: campaignId, action } = body as { campaign_id?: string; action?: string };
  if (!campaignId || typeof campaignId !== "string" || !action || !ACTIONS.has(action)) {
    return new Response(JSON.stringify({ error: "campaign_id and a valid action ('pause', 'resume', or 'cancel') are required" }), { status: 400, headers: CORS });
  }

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, advertiser_id, status, start_date")
    .eq("id", campaignId)
    .maybeSingle();

  if (!booking) {
    return new Response(JSON.stringify({ error: "Campaign not found" }), { status: 404, headers: CORS });
  }

  const isOwningAdvertiser = booking.advertiser_id === user.id;
  let isRunningOperator = false;
  if (!isOwningAdvertiser) {
    const { data: csRows } = await supabase
      .from("campaign_screens")
      .select("screen_id")
      .eq("campaign_id", campaignId);
    const screenIds = (csRows ?? []).map((r: { screen_id: string }) => r.screen_id);
    if (screenIds.length > 0) {
      const { data: opScreens } = await supabase
        .from("screens")
        .select("id")
        .eq("operator_id", user.id)
        .in("id", screenIds)
        .limit(1);
      isRunningOperator = (opScreens?.length ?? 0) > 0;
    }
  }
  if (!isOwningAdvertiser && !isRunningOperator) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: CORS });
  }

  const today = new Date().toISOString().slice(0, 10);
  const resolved = resolveNewStatus(action, booking.status, booking.start_date, today);
  if (!resolved.ok) {
    return new Response(JSON.stringify({ error: resolved.error }), { status: 409, headers: CORS });
  }

  const { error: updateError } = await supabase
    .from("bookings")
    .update({ status: resolved.status })
    .eq("id", campaignId);

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), { status: 500, headers: CORS });
  }

  return new Response(JSON.stringify({ ok: true, status: resolved.status }), { headers: CORS });
});
