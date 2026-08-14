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
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: CORS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401, headers: CORS });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return new Response("Unauthorized", { status: 401, headers: CORS });

  const { campaign_id } = await req.json().catch(() => ({}));
  if (!campaign_id || typeof campaign_id !== "string") {
    return new Response(JSON.stringify({ error: "campaign_id is required" }), { status: 400, headers: CORS });
  }

  // Ownership check before the privileged RPC call -- the SQL function
  // itself does not re-verify this (see the migration's comment on
  // assign_holdout_control), so this check IS the security boundary.
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, advertiser_id, holdout_enabled")
    .eq("id", campaign_id)
    .single();

  if (!booking || booking.advertiser_id !== user.id) {
    return new Response(JSON.stringify({ error: "Campaign not found" }), { status: 404, headers: CORS });
  }

  if (!booking.holdout_enabled) {
    return new Response(JSON.stringify({ error: "This campaign did not opt into a holdout test" }), { status: 400, headers: CORS });
  }

  // Idempotency guard: a double-click or retried request must not
  // re-randomize on top of an already-assigned control group, which
  // would inflate the control percentage past the intended ~20%.
  const { count: existingControlCount } = await supabase
    .from("campaign_screens")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaign_id)
    .eq("is_control", true);

  if (existingControlCount && existingControlCount > 0) {
    return new Response(JSON.stringify({ ok: true, control_count: existingControlCount, already_assigned: true }), { headers: CORS });
  }

  const { data: controlCount, error: rpcError } = await supabase.rpc("assign_holdout_control", {
    p_campaign_id: campaign_id,
  });

  if (rpcError) {
    return new Response(JSON.stringify({ error: rpcError.message }), { status: 500, headers: CORS });
  }

  return new Response(JSON.stringify({ ok: true, control_count: controlCount }), { headers: CORS });
});
