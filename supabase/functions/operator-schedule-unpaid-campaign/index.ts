import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rateLimited, rateLimitResponse } from "../_shared/rateLimit.ts";

// Platform-audit finding: ApprovalQueue.jsx's "Approve without charging"
// fallback (offered when charge-campaign reports no payment method on
// file, single-campaign and bulk paths both) calls
// `supabase.from("bookings").update({ status: "scheduled" }).eq("id", ...)`
// directly from the operator's client. bookings.status has NO client
// UPDATE grant at all -- REVOKE UPDATE (..., status, ...) ON bookings FROM
// authenticated (20260611000002/3_lock_bookings_update*.sql) -- so this
// call has failed with a column-privilege error on every single call, for
// every operator, since those migrations landed. The UI does check the
// error and show it (`if (dbErr) { setActionErr(...) }`), so this isn't
// the silent-no-op class exactly -- it's a completely broken feature:
// "approve without charging" has never worked at all.
//
// This is a real relationship, not a blanket grant: the caller must own at
// least one screen actually booked on this campaign, verified server-side
// via campaign_screens -- the same join pattern operator-manage-advertiser
// uses for its own operator/advertiser relationship check.
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

  const { data: callerProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (callerProfile?.role !== "operator") {
    return new Response(JSON.stringify({ error: "Only operators can approve campaigns." }), { status: 403, headers: CORS });
  }

  if (await rateLimited(supabase, `operator-schedule-unpaid-campaign:${user.id}`, { limit: 60, windowSeconds: 3600 })) {
    return rateLimitResponse(CORS);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: CORS });
  }

  const campaignIds: string[] =
    Array.isArray(body.campaign_ids) ? body.campaign_ids.filter((id): id is string => typeof id === "string")
    : typeof body.campaign_id === "string" ? [body.campaign_id]
    : [];

  if (campaignIds.length === 0) {
    return new Response(JSON.stringify({ error: "campaign_id or campaign_ids is required" }), { status: 400, headers: CORS });
  }
  if (campaignIds.length > 100) {
    return new Response(JSON.stringify({ error: "Too many campaign_ids (max 100)." }), { status: 400, headers: CORS });
  }

  const { data: opScreens } = await supabase.from("screens").select("id").eq("operator_id", user.id);
  const opScreenIds = new Set((opScreens ?? []).map((s: { id: string }) => s.id));
  if (opScreenIds.size === 0) {
    return new Response(JSON.stringify({ error: "You have no screens." }), { status: 403, headers: CORS });
  }

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, status, payment_status, start_when")
    .in("id", campaignIds);
  const bookingById = new Map((bookings ?? []).map((b: { id: string }) => [b.id, b]));

  const { data: csRows } = await supabase
    .from("campaign_screens")
    .select("campaign_id, screen_id, status")
    .in("campaign_id", campaignIds);
  const rowsByCampaign = new Map<string, { screen_id: string; status: string }[]>();
  for (const row of (csRows ?? []) as { campaign_id: string; screen_id: string; status: string }[]) {
    const list = rowsByCampaign.get(row.campaign_id) ?? [];
    list.push(row);
    rowsByCampaign.set(row.campaign_id, list);
  }

  const results: { campaign_id: string; ok: boolean; error?: string }[] = [];

  for (const campaignId of campaignIds) {
    const booking = bookingById.get(campaignId) as { id: string; status: string; payment_status: string; start_when: string } | undefined;
    if (!booking) { results.push({ campaign_id: campaignId, ok: false, error: "Campaign not found" }); continue; }

    const rows = rowsByCampaign.get(campaignId) ?? [];
    const opHasScreen = rows.some((r) => opScreenIds.has(r.screen_id));
    if (!opHasScreen) { results.push({ campaign_id: campaignId, ok: false, error: "Not one of your campaigns" }); continue; }

    if (booking.payment_status === "paid") {
      results.push({ campaign_id: campaignId, ok: false, error: "Already paid" });
      continue;
    }

    // Re-derive "all clear" server-side rather than trusting the client's
    // own computation -- a start_when='partial' campaign can schedule with
    // screens still pending; anything else needs every screen off 'pending'.
    const stillPending = rows.some((r) => r.status === "pending");
    const allClear = booking.start_when === "partial" || !stillPending;
    if (!allClear) {
      results.push({ campaign_id: campaignId, ok: false, error: "Not all screens have been reviewed yet" });
      continue;
    }

    const { error } = await supabase.from("bookings").update({ status: "scheduled" }).eq("id", campaignId);
    results.push({ campaign_id: campaignId, ok: !error, error: error?.message });
  }

  return new Response(JSON.stringify({ results }), { headers: CORS });
});
