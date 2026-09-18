// REST campaign API (Competitive Parity Program, Phase 6, G21 REST API
// half -- see docs/superpowers/specs/2026-09-08-rest-campaign-api-design.md).
//
// Every write endpoint reuses the same bookings/campaign_screens insert
// shape and the same charge-campaign Stripe flow the dashboard already
// uses -- this is a new entry point into existing rules, not new
// business logic. v1 scope: one creative per campaign (no multi-
// creative/holdout-group parity with the full CreateCampaign wizard --
// see the spec's Non-goals).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rateLimited, rateLimitResponse } from "../_shared/rateLimit.ts";
import { authenticateApiKey } from "../_shared/apiKeyAuth.ts";
import { validateCreateCampaignBody, canEditCampaign, canCancelCampaign } from "../_shared/apiCampaignRules.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const INTERNAL_SECRET = Deno.env.get("INTERNAL_NOTIFICATION_SECRET") ?? "";
const JSON_HEADERS = { "Content-Type": "application/json" };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

const CAMPAIGN_FIELDS = "id, campaign_name, advertiser_name, city, status, payment_status, budget, currency, start_date, end_date, media_url, media_type, destination_url, duration, slots, impressions, spent, scans, created_at";

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  // Strip the functions/v1/api-campaigns prefix; everything after that is
  // this API's own /v1/campaigns... path space.
  const path = url.pathname.replace(/^.*\/api-campaigns/, "");
  const segments = path.split("/").filter(Boolean); // e.g. ["v1","campaigns",":id","submit"]

  if (segments[0] !== "v1" || segments[1] !== "campaigns") {
    return json({ error: "Not found" }, 404);
  }
  const campaignId = segments[2] ?? null;
  const action = segments[3] ?? null; // "submit" | "cancel" | "delivery"

  const auth = await authenticateApiKey(supabase, req);
  if (auth instanceof Response) return auth;
  const { advertiserId } = auth;

  if (await rateLimited(supabase, `api-campaigns:${advertiserId}`, { limit: 120, windowSeconds: 60 })) {
    return rateLimitResponse(JSON_HEADERS);
  }

  // GET /v1/campaigns
  if (req.method === "GET" && !campaignId) {
    const status = url.searchParams.get("status");
    let query = supabase.from("bookings").select(CAMPAIGN_FIELDS).eq("advertiser_id", advertiserId).order("created_at", { ascending: false });
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return json({ error: error.message }, 500);
    return json({ campaigns: data ?? [] });
  }

  // GET /v1/campaigns/:id
  if (req.method === "GET" && campaignId && !action) {
    const { data, error } = await supabase.from("bookings").select(CAMPAIGN_FIELDS).eq("id", campaignId).eq("advertiser_id", advertiserId).maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!data) return json({ error: "Campaign not found" }, 404);
    return json({ campaign: data });
  }

  // GET /v1/campaigns/:id/delivery
  if (req.method === "GET" && campaignId && action === "delivery") {
    const { data: campaign } = await supabase.from("bookings").select("id, budget, spent, impressions, scans").eq("id", campaignId).eq("advertiser_id", advertiserId).maybeSingle();
    if (!campaign) return json({ error: "Campaign not found" }, 404);
    const { data: daily } = await supabase.from("campaign_delivery_daily").select("day, impressions, plays").eq("campaign_id", campaignId);
    return json({
      campaign_id: campaignId,
      budget: campaign.budget,
      spent: campaign.spent,
      impressions: campaign.impressions,
      scans: campaign.scans,
      daily: daily ?? [],
    });
  }

  // POST /v1/campaigns
  if (req.method === "POST" && !campaignId) {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    const errors = validateCreateCampaignBody(body);
    if (errors.length > 0) return json({ error: "Invalid campaign", details: errors }, 400);

    const { data: advertiser } = await supabase.from("profiles").select("name, preferred_currency").eq("id", advertiserId).maybeSingle();
    const { data: screens } = await supabase.from("screens").select("id, name, auto_approve").in("id", body.screen_ids as string[]);
    if (!screens || screens.length === 0) return json({ error: "No matching screens found" }, 400);

    const newCampaignId = crypto.randomUUID();
    const { error: insertErr } = await supabase.from("bookings").insert({
      id: newCampaignId,
      advertiser_id: advertiserId,
      campaign_name: typeof body.name === "string" ? body.name : null,
      advertiser_name: advertiser?.name ?? "Advertiser",
      screen_name: screens[0].name,
      city: typeof body.city === "string" ? body.city : "",
      budget: body.budget,
      currency: advertiser?.preferred_currency ?? "cad",
      start_date: body.start_date,
      end_date: body.end_date,
      media_url: body.media_url,
      media_type: body.media_type,
      destination_url: typeof body.destination_url === "string" ? body.destination_url : null,
      duration: typeof body.duration === "number" ? body.duration : 15,
      slots: 10,
      status: "pending_review",
      payment_status: "unpaid",
      impressions: 0,
      spent: 0,
      scans: 0,
    });
    if (insertErr) return json({ error: insertErr.message }, 500);

    const screenRows = screens.map((s) => ({
      campaign_id: newCampaignId,
      screen_id: s.id,
      status: s.auto_approve ? "auto_approved" : "pending",
    }));
    const { error: screensErr } = await supabase.from("campaign_screens").insert(screenRows);
    if (screensErr) return json({ error: screensErr.message }, 500);

    return json({ campaign_id: newCampaignId }, 201);
  }

  // PATCH /v1/campaigns/:id
  if (req.method === "PATCH" && campaignId && !action) {
    const { data: campaign } = await supabase.from("bookings").select("id, payment_status").eq("id", campaignId).eq("advertiser_id", advertiserId).maybeSingle();
    if (!campaign) return json({ error: "Campaign not found" }, 404);
    if (!canEditCampaign(campaign.payment_status)) {
      return json({ error: `Campaign cannot be edited once payment_status is "${campaign.payment_status}"` }, 409);
    }
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    const allowedFields = ["budget", "start_date", "end_date", "media_url", "media_type", "destination_url", "duration", "campaign_name"];
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) if (field in body) updates[field] = body[field];
    if (Object.keys(updates).length === 0) return json({ error: "No editable fields provided" }, 400);

    const { error } = await supabase.from("bookings").update(updates).eq("id", campaignId);
    if (error) return json({ error: error.message }, 500);
    return json({ campaign_id: campaignId, updated: true });
  }

  // POST /v1/campaigns/:id/submit -- charges via the same off-session
  // Stripe flow the dashboard's "Pay & Launch" button already triggers.
  if (req.method === "POST" && campaignId && action === "submit") {
    const { data: campaign } = await supabase.from("bookings").select("id").eq("id", campaignId).eq("advertiser_id", advertiserId).maybeSingle();
    if (!campaign) return json({ error: "Campaign not found" }, 404);

    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/charge-campaign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": INTERNAL_SECRET },
      body: JSON.stringify({ campaign_id: campaignId }),
    });
    const result = await res.json().catch(() => ({}));
    return json(result, res.status);
  }

  // POST /v1/campaigns/:id/cancel
  if (req.method === "POST" && campaignId && action === "cancel") {
    const { data: campaign } = await supabase.from("bookings").select("id, status, payment_status").eq("id", campaignId).eq("advertiser_id", advertiserId).maybeSingle();
    if (!campaign) return json({ error: "Campaign not found" }, 404);
    if (!canCancelCampaign(campaign.status, campaign.payment_status)) {
      return json({ error: `Campaign cannot be cancelled once it is "${campaign.status}"` }, 409);
    }
    // bookings_status_check has no 'cancelled' value -- 'completed' is the
    // schema's only terminal status (same fix as manage-campaign-status's
    // 'cancel' action / PR #249). This update was constraint-violating on
    // every call, 500ing for every external API consumer that tried it.
    const { error } = await supabase.from("bookings").update({ status: "completed" }).eq("id", campaignId);
    if (error) return json({ error: error.message }, 500);
    return json({ campaign_id: campaignId, cancelled: true });
  }

  return json({ error: "Not found" }, 404);
});
