import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const INTERNAL_SECRET = Deno.env.get("INTERNAL_NOTIFICATION_SECRET") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

async function notify(userId: string, type: string, data: Record<string, unknown>) {
  await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-notification`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-secret": INTERNAL_SECRET },
    body: JSON.stringify({ userId, type, data }),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const authHeader = req.headers.get("Authorization") ?? "";
  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: CORS });
  }

  const { listingId } = await req.json();
  if (!listingId) {
    return new Response(JSON.stringify({ error: "listingId required" }), { status: 400, headers: CORS });
  }

  const { data: listing } = await supabase
    .from("marketplace_listings")
    .select("id, price_cents, operator_id, status")
    .eq("id", listingId)
    .maybeSingle();

  if (!listing || listing.status !== "active") {
    return new Response(JSON.stringify({ error: "listing not available" }), { status: 409, headers: CORS });
  }

  const { data: feeConfig } = await supabase
    .from("platform_config").select("value").eq("key", "marketplace_fee_pct").maybeSingle();
  const feePct = Number(feeConfig?.value ?? 5);
  const feeCents = Math.round(listing.price_cents * (feePct / 100));

  // TODO(payments-integration): replace with the real charge call used by
  // the existing booking payment path (see screen_tokens_payments.sql /
  // bookings.payment_intent_id) once that helper's exact signature is
  // confirmed — this stub assumes success so the confirm/notify flow below
  // is fully testable independent of payment wiring.
  const paymentIntentId = `stub_${crypto.randomUUID()}`;

  const { data: bookingId, error: confirmErr } = await supabase.rpc("marketplace_confirm_booking", {
    p_listing_id: listingId,
    p_advertiser_id: user.id,
    p_fee_cents: feeCents,
  });

  if (confirmErr) {
    return new Response(JSON.stringify({ error: confirmErr.message }), { status: 409, headers: CORS });
  }

  await supabase.from("marketplace_bookings")
    .update({ payment_intent_id: paymentIntentId, payment_status: "paid" })
    .eq("id", bookingId);

  await notify(user.id, "marketplace_booking_confirmed", { listingId, bookingId, role: "advertiser" });
  await notify(listing.operator_id, "marketplace_booking_confirmed", { listingId, bookingId, role: "operator" });

  return new Response(JSON.stringify({ bookingId }), { headers: CORS });
});
