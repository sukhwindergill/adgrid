import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rateLimited, rateLimitResponse } from "../_shared/rateLimit.ts";
import { validateDisputeResolution } from "../_shared/disputeResolution.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Content-Type": "application/json",
};

// Resolves an advertiser-filed dispute (spec #2). Platform-owner only, same
// role gate as invite-operator. The actual money movement is a real Stripe
// refund via payment_intent_id -- the existing charge.refunded webhook
// (stripe-webhook/index.ts) picks that up and reverses the operator's
// transfer proportionally on its own (transferReversal.ts). This function
// does not duplicate that reversal logic; it only issues the refund and
// records the resolution, so there is one place, not two, deciding how
// much of an operator's payout to claw back.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401, headers: CORS });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return new Response("Unauthorized", { status: 401, headers: CORS });

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_platform_owner")
    .eq("id", user.id)
    .single();

  if (!profile?.is_platform_owner) {
    return new Response("Forbidden", { status: 403, headers: CORS });
  }

  // Triggers a real Stripe refund -- cap repeated calls per admin.
  if (await rateLimited(supabase, `resolve-dispute:${user.id}`, { limit: 30, windowSeconds: 3600 })) {
    return rateLimitResponse(CORS);
  }

  const { dispute_id, resolution, amount, note } = await req.json();
  if (!dispute_id || !resolution) {
    return new Response(JSON.stringify({ error: "dispute_id and resolution are required" }), { status: 400, headers: CORS });
  }

  const { data: dispute } = await supabase
    .from("disputes")
    .select("id, booking_id, status")
    .eq("id", dispute_id)
    .single();

  if (!dispute) {
    return new Response(JSON.stringify({ error: "Dispute not found" }), { status: 404, headers: CORS });
  }
  if (dispute.status === "resolved") {
    return new Response(JSON.stringify({ error: "Dispute is already resolved" }), { status: 409, headers: CORS });
  }

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, budget, payment_intent_id, payment_status")
    .eq("id", dispute.booking_id)
    .single();

  if (!booking) {
    return new Response(JSON.stringify({ error: "Underlying booking not found" }), { status: 404, headers: CORS });
  }

  const check = validateDisputeResolution({ resolution, amount, bookingBudget: Number(booking.budget) || 0 });
  if (!check.valid) {
    return new Response(JSON.stringify({ error: check.error }), { status: 400, headers: CORS });
  }

  let refundId: string | null = null;
  if (check.refundCents !== null && check.refundCents > 0) {
    if (!booking.payment_intent_id) {
      return new Response(JSON.stringify({ error: "Booking has no payment on file to refund" }), { status: 400, headers: CORS });
    }
    if (booking.payment_status !== "paid" && booking.payment_status !== "refunded") {
      return new Response(JSON.stringify({ error: `Booking payment_status is '${booking.payment_status}', not refundable` }), { status: 400, headers: CORS });
    }
    try {
      const refund = await stripe.refunds.create({
        payment_intent: booking.payment_intent_id,
        amount: check.refundCents,
      }, {
        idempotencyKey: `dispute-refund:${dispute.id}`,
      });
      refundId = refund.id;
      // The charge.refunded webhook (fired by this API call) is what marks
      // bookings.payment_status = 'refunded' and reverses the operator's
      // transfer -- this function doesn't touch either directly, so there
      // is exactly one place that logic lives.
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Refund failed";
      return new Response(JSON.stringify({ error: msg }), { status: 502, headers: CORS });
    }
  }

  const { error: updateError } = await supabase
    .from("disputes")
    .update({
      status: "resolved",
      resolution,
      resolution_note: note ?? null,
      resolved_amount: check.refundCents !== null ? check.refundCents / 100 : null,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", dispute.id);

  if (updateError) {
    // The Stripe refund (if any) already succeeded at this point -- surface
    // the DB failure distinctly so ops knows the money moved even though
    // the record didn't save, rather than silently looking unresolved.
    return new Response(
      JSON.stringify({ error: `Refund succeeded but saving the resolution failed: ${updateError.message}`, refund_id: refundId }),
      { status: 500, headers: CORS },
    );
  }

  return new Response(JSON.stringify({ success: true, refund_id: refundId }), { headers: CORS });
});
