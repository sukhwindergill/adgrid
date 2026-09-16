import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rateLimited, rateLimitResponse } from "../_shared/rateLimit.ts";
import { validateSetStatus, validateAddCredits, validateSetRateOverride } from "../_shared/advertiserAccountActions.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Content-Type": "application/json",
};

// Security-audit finding (20260909194813_pin_profile_admin_columns.sql)
// locked `profiles.status`, `credits` and `rate_override` so only
// service_role can change them -- any authenticated user could otherwise
// grant themselves credits or un-suspend their own account with a raw
// `.update()`. That trigger silently reverts the column instead of
// erroring, so AdvertisersView.jsx's Suspend/Reactivate, Add Credits and
// Set Custom CPM Rate actions (both single and bulk) now no-op: the UI
// shows success, nothing persists. This is the service_role-backed path
// those actions need, scoped the same way the profiles SELECT policy
// already is -- operator_has_advertiser_booking (a real booking on one of
// this operator's own screens) -- so an operator can't reach into an
// advertiser they've never actually done business with.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: CORS });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: CORS });

  if (await rateLimited(supabase, `operator-manage-advertiser:${user.id}`, { limit: 60, windowSeconds: 3600 })) {
    return rateLimitResponse(CORS);
  }

  const body = await req.json().catch(() => ({}));
  const { advertiserIds, action } = body as { advertiserIds?: unknown; action?: string };

  const ids = Array.isArray(advertiserIds) ? advertiserIds.filter((v) => typeof v === "string") : [];
  if (ids.length === 0) {
    return new Response(JSON.stringify({ error: "advertiserIds must be a non-empty array of ids" }), { status: 400, headers: CORS });
  }

  let update: Record<string, unknown>;

  if (action === "set_status") {
    const check = validateSetStatus(body.status);
    if (!check.valid) return new Response(JSON.stringify({ error: check.error }), { status: 400, headers: CORS });
    update = { status: body.status };
  } else if (action === "add_credits") {
    // Single-target only: the increment is relative to each row's current
    // balance, which a bulk "+ $X to everyone" call can't express safely
    // without a read-then-write race per row.
    if (ids.length !== 1) {
      return new Response(JSON.stringify({ error: "add_credits accepts exactly one advertiserId" }), { status: 400, headers: CORS });
    }
    const check = validateAddCredits(body.amount);
    if (!check.valid) return new Response(JSON.stringify({ error: check.error }), { status: 400, headers: CORS });

    const { data: profile, error: readErr } = await supabase
      .from("profiles")
      .select("credits")
      .eq("id", ids[0])
      .maybeSingle();
    if (readErr || !profile) {
      return new Response(JSON.stringify({ error: "Advertiser not found" }), { status: 404, headers: CORS });
    }
    update = { credits: (Number(profile.credits) || 0) + Number(body.amount) };
  } else if (action === "set_rate_override") {
    if (ids.length !== 1) {
      return new Response(JSON.stringify({ error: "set_rate_override accepts exactly one advertiserId" }), { status: 400, headers: CORS });
    }
    const check = validateSetRateOverride(body.rate ?? null);
    if (!check.valid) return new Response(JSON.stringify({ error: check.error }), { status: 400, headers: CORS });
    update = { rate_override: body.rate === undefined ? null : body.rate };
  } else {
    return new Response(JSON.stringify({ error: "action must be one of set_status, add_credits, set_rate_override" }), { status: 400, headers: CORS });
  }

  // Same relationship check the profiles SELECT policy enforces (see
  // operator_has_advertiser_booking, 20260902021656): this operator must
  // have at least one real booking from each target advertiser landing on
  // one of their own screens. Re-implemented directly against the service
  // client rather than RPC-ing the SECURITY DEFINER function, since that
  // function reads `auth.uid()` from the request's own JWT rather than a
  // parameter -- not reachable with a service-role client, and not worth
  // proxying the caller's JWT through just to reuse it. Checked as one
  // query so a bulk call can't smuggle in an advertiser the operator has
  // no relationship with alongside ones they do.
  const { data: ownBookings, error: scopeErr } = await supabase
    .from("bookings")
    .select("advertiser_id, campaign_screens!inner(screens!inner(operator_id))")
    .in("advertiser_id", ids)
    .eq("campaign_screens.screens.operator_id", user.id);
  if (scopeErr) {
    return new Response(JSON.stringify({ error: "Failed to verify advertiser relationship" }), { status: 500, headers: CORS });
  }
  const allowedIds = new Set((ownBookings ?? []).map((b) => b.advertiser_id as string));
  const deniedIds = ids.filter((id) => !allowedIds.has(id));
  if (deniedIds.length > 0) {
    return new Response(
      JSON.stringify({ error: "You don't have a booking relationship with one or more of these advertisers", deniedIds }),
      { status: 403, headers: CORS },
    );
  }

  const { error: updateErr } = await supabase.from("profiles").update(update).in("id", ids);
  if (updateErr) {
    return new Response(JSON.stringify({ error: updateErr.message }), { status: 500, headers: CORS });
  }

  return new Response(JSON.stringify({ success: true, updated: ids }), { headers: CORS });
});
