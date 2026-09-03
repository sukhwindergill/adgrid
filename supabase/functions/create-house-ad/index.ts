import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { operatorOwnsAllScreens } from "./ownership.ts";

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
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: CORS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401, headers: CORS });
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return new Response("Unauthorized", { status: 401, headers: CORS });

  const { data: callerProfile } = await supabase.from("profiles").select("role, name").eq("id", user.id).single();
  if (callerProfile?.role !== "operator") {
    return new Response(JSON.stringify({ error: "Only operators can create house ads." }), { status: 403, headers: CORS });
  }

  const body = await req.json().catch(() => null);
  if (!body?.screen_ids?.length || !body?.creative?.media_url) {
    return new Response(JSON.stringify({ error: "screen_ids and creative.media_url are required" }), { status: 400, headers: CORS });
  }
  const { screen_ids, name, creative, schedule } = body;

  // Ownership check -- the whole reason this must be a service-role
  // function and not a client insert: an operator may only create a
  // house ad on a screen they themselves own.
  const { data: ownedRows } = await supabase.from("screens").select("id, name").eq("operator_id", user.id).in("id", screen_ids);
  const ownedScreenIds = new Set((ownedRows ?? []).map((r: { id: string }) => r.id));
  if (!operatorOwnsAllScreens(screen_ids, ownedScreenIds)) {
    return new Response(JSON.stringify({ error: "One or more screens are not owned by this operator." }), { status: 403, headers: CORS });
  }

  const { data: campaignRow, error: campaignErr } = await supabase
    .from("campaigns")
    .insert({ advertiser_id: user.id, name: name || "House Ad" })
    .select("id")
    .single();
  if (campaignErr) {
    return new Response(JSON.stringify({ error: campaignErr.message }), { status: 500, headers: CORS });
  }

  const campaignId = crypto.randomUUID();
  const firstScreen = (ownedRows ?? []).find((r: { id: string }) => r.id === screen_ids[0]);

  const { error: bookingErr } = await supabase.from("bookings").insert({
    id: campaignId,
    campaign_id: campaignRow.id,
    is_house_ad: true,
    advertiser_id: user.id,
    advertiser_name: callerProfile?.name || "House Ad",
    campaign_name: name || null,
    screen_name: firstScreen?.name || "",
    city: "",
    media_url: creative.media_url,
    media_type: creative.media_type ?? "image",
    media_width: creative.media_width ?? null,
    media_height: creative.media_height ?? null,
    headline: creative.headline ?? null,
    cta_text: creative.cta_text ?? null,
    destination_url: creative.destination_url ?? null,
    accent_color: creative.accent_color ?? null,
    category: creative.category ?? null,
    qr_x: creative.qr_x ?? null,
    qr_y: creative.qr_y ?? null,
    qr_size_pct: creative.qr_size_pct ?? null,
    qr_fg_color: creative.qr_fg_color ?? null,
    qr_bg_color: creative.qr_bg_color ?? null,
    budget: 0,
    currency: "cad",
    budget_mode: "total",
    start_when: "partial",
    holdout_enabled: false,
    start_date: schedule?.start_date ?? null,
    end_date: schedule?.end_date ?? null,
    schedule_days: schedule?.schedule_days ?? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    time_start: schedule?.time_start ?? "07:00",
    time_end: schedule?.time_end ?? "22:00",
    dayparting: schedule?.dayparting ?? null,
    duration: schedule?.duration ?? 15,
    slots: schedule?.slots ?? 10,
    status: "scheduled",
    payment_status: "paid",
    impressions: 0,
    spent: 0,
    scans: 0,
  });
  if (bookingErr) {
    return new Response(JSON.stringify({ error: bookingErr.message }), { status: 500, headers: CORS });
  }

  const screenRows = screen_ids.map((screen_id: string) => ({
    campaign_id: campaignId,
    screen_id,
    status: "auto_approved", // the operator's own screen -- no advertiser-review step applies
  }));
  const { error: screenErr } = await supabase.from("campaign_screens").insert(screenRows);
  if (screenErr) {
    return new Response(JSON.stringify({ error: screenErr.message }), { status: 500, headers: CORS });
  }

  return new Response(JSON.stringify({ success: true, campaign_id: campaignId }), { headers: CORS });
});
