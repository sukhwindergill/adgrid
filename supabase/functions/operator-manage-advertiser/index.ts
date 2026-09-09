import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rateLimited, rateLimitResponse } from "../_shared/rateLimit.ts";

// Product-audit finding: AdvertisersView.jsx's status/credits/rate-override
// actions were all direct `supabase.from("profiles").update(...)` calls
// against another user's row. The only UPDATE policy on profiles is
// "Users can update own profile" (id = auth.uid()) -- an operator acting on
// an advertiser's row never matches it, so every one of these calls was
// silently no-op-ing under RLS (no error, zero rows affected) in
// production: suspend/reactivate, add-credits, and CPM-rate-override on
// the Advertisers page have never actually worked for any operator.
//
// This is a real relationship, not a blanket "any operator, any user" grant
// (see the send-notification fix for why that distinction matters): the
// caller must be the operator of a screen the advertiser has actually
// booked, checked via the same operator_has_advertiser_booking() the
// existing SELECT policy on profiles already relies on.
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Content-Type": "application/json",
};

const VALID_STATUSES = new Set(["active", "suspended"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: CORS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });

  const { data: callerProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (callerProfile?.role !== "operator") {
    return new Response(JSON.stringify({ error: "Only operators can manage advertiser accounts." }), { status: 403, headers: CORS });
  }

  if (await rateLimited(supabase, `operator-manage-advertiser:${user.id}`, { limit: 60, windowSeconds: 3600 })) {
    return rateLimitResponse(CORS);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: CORS });
  }

  const { action } = body;
  const advertiserIds: string[] =
    Array.isArray(body.advertiser_ids) ? body.advertiser_ids.filter((id): id is string => typeof id === "string")
    : typeof body.advertiser_id === "string" ? [body.advertiser_id]
    : [];

  if (advertiserIds.length === 0) {
    return new Response(JSON.stringify({ error: "advertiser_id or advertiser_ids is required" }), { status: 400, headers: CORS });
  }
  // Same headroom rationale as create-house-ad's screen_ids cap -- bounds a
  // pathological bulk-action request rather than any real usage pattern.
  if (advertiserIds.length > 100) {
    return new Response(JSON.stringify({ error: "Too many advertiser_ids (max 100)." }), { status: 400, headers: CORS });
  }

  // Verify the relationship for every target id before writing any of
  // them -- an all-or-nothing check, so a bulk action never partially
  // applies to advertisers this operator has no relationship with.
  //
  // Reimplemented rather than calling the existing
  // operator_has_advertiser_booking() RPC: that function reads
  // auth.uid() internally, which is only populated from a caller's own
  // JWT -- called through this service-role client it would evaluate to
  // null and the check would always fail. Same join, with the operator id
  // passed explicitly instead.
  const { data: opScreens } = await supabase.from("screens").select("id").eq("operator_id", user.id);
  const opScreenIds = (opScreens ?? []).map((s: { id: string }) => s.id);
  if (opScreenIds.length === 0) {
    return new Response(JSON.stringify({ error: "You have no screens." }), { status: 403, headers: CORS });
  }
  const { data: bookedRows } = await supabase
    .from("campaign_screens")
    .select("campaign_id")
    .in("screen_id", opScreenIds);
  const bookedCampaignIds = [...new Set((bookedRows ?? []).map((r: { campaign_id: string }) => r.campaign_id))];
  const { data: relatedBookings } = bookedCampaignIds.length > 0
    ? await supabase.from("bookings").select("id, advertiser_id").in("id", bookedCampaignIds).in("advertiser_id", advertiserIds)
    : { data: [] as { advertiser_id: string }[] };
  const relatedAdvertiserIds = new Set((relatedBookings ?? []).map((b: { advertiser_id: string }) => b.advertiser_id));

  for (const advertiserId of advertiserIds) {
    if (!relatedAdvertiserIds.has(advertiserId)) {
      return new Response(
        JSON.stringify({ error: `Advertiser ${advertiserId} has never booked on one of your screens.` }),
        { status: 403, headers: CORS },
      );
    }
  }

  if (action === "set_status") {
    const { status } = body;
    if (typeof status !== "string" || !VALID_STATUSES.has(status)) {
      return new Response(JSON.stringify({ error: "status must be 'active' or 'suspended'" }), { status: 400, headers: CORS });
    }
    const { error } = await supabase.from("profiles").update({ status }).in("id", advertiserIds);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS });
    return new Response(JSON.stringify({ ok: true }), { headers: CORS });
  }

  if (action === "add_credits") {
    if (advertiserIds.length !== 1) {
      return new Response(JSON.stringify({ error: "add_credits supports a single advertiser_id" }), { status: 400, headers: CORS });
    }
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return new Response(JSON.stringify({ error: "amount must be a positive number" }), { status: 400, headers: CORS });
    }
    const { data: profile, error: fetchErr } = await supabase.from("profiles").select("credits").eq("id", advertiserIds[0]).single();
    if (fetchErr || !profile) return new Response(JSON.stringify({ error: "Advertiser not found" }), { status: 404, headers: CORS });
    const newCredits = Number(profile.credits ?? 0) + amount;
    const { error } = await supabase.from("profiles").update({ credits: newCredits }).eq("id", advertiserIds[0]);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS });
    return new Response(JSON.stringify({ ok: true, credits: newCredits }), { headers: CORS });
  }

  if (action === "set_rate") {
    if (advertiserIds.length !== 1) {
      return new Response(JSON.stringify({ error: "set_rate supports a single advertiser_id" }), { status: 400, headers: CORS });
    }
    const rate = body.rate === null || body.rate === undefined ? null : Number(body.rate);
    if (rate !== null && (!Number.isFinite(rate) || rate < 0)) {
      return new Response(JSON.stringify({ error: "rate must be a non-negative number or null" }), { status: 400, headers: CORS });
    }
    const { error } = await supabase.from("profiles").update({ rate_override: rate }).eq("id", advertiserIds[0]);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS });
    return new Response(JSON.stringify({ ok: true, rate_override: rate }), { headers: CORS });
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: CORS });
});
