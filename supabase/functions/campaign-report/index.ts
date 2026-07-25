import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isTokenUsable } from "../_shared/shareToken.ts";

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

  const url = new URL(req.url);
  const token = url.searchParams.get("t");
  if (!token) return new Response(JSON.stringify({ error: "Missing token" }), { status: 400, headers: CORS });

  const { data: row } = await supabase
    .from("campaign_share_tokens")
    .select("token, campaign_id, expires_at, revoked_at, view_count")
    .eq("token", token)
    .maybeSingle();

  const verdict = isTokenUsable(row);
  if (!verdict.usable) {
    // Deliberately uniform: distinguishing "not found" from "revoked" would
    // let someone probe which tokens ever existed.
    return new Response(
      JSON.stringify({ error: "This report link is no longer available" }),
      { status: 404, headers: CORS },
    );
  }

  const campaignId = row!.campaign_id as string;

  // Aggregate delivery only. No advertiser identity, no budget or spend, no
  // operator revenue, no scan log — a share link is for showing results, not
  // exposing the account behind them.
  const { data: campaign } = await supabase
    .from("bookings")
    .select("id, campaign_name, advertiser_name, category, start_date, end_date, currency")
    .eq("id", campaignId)
    .single();

  const { data: delivery } = await supabase
    .from("campaign_delivery_daily")
    .select("day, plays, impressions, basis, billable_scans")
    .eq("campaign_id", campaignId)
    .order("day", { ascending: true });

  const { data: health } = await supabase
    .from("campaign_delivery_health")
    .select("expected_plays, delivered_plays, delivery_pct, offline_days")
    .eq("campaign_id", campaignId)
    .maybeSingle();

  const rows = delivery ?? [];
  const totals = {
    plays: rows.reduce((a, r) => a + (Number(r.plays) || 0), 0),
    impressions: rows.reduce((a, r) => a + (Number(r.impressions) || 0), 0),
    scans: rows.reduce((a, r) => a + (Number(r.billable_scans) || 0), 0),
    basis: rows.length === 0 ? "none"
      : rows.every(r => r.basis === "measured") ? "measured"
      : rows.some(r => r.basis === "measured") ? "mixed" : "modelled",
  };

  // Fire-and-forget view accounting; never block the response on it.
  supabase
    .from("campaign_share_tokens")
    .update({ view_count: (Number(row!.view_count) || 0) + 1, last_viewed_at: new Date().toISOString() })
    .eq("token", token)
    .then(() => {});

  return new Response(JSON.stringify({
    campaign: {
      name: campaign?.campaign_name ?? campaign?.advertiser_name ?? campaignId,
      category: campaign?.category ?? null,
      start_date: campaign?.start_date ?? null,
      end_date: campaign?.end_date ?? null,
      currency: campaign?.currency ?? null,
    },
    totals,
    daily: rows,
    health: health ?? null,
  }), { headers: CORS });
});
