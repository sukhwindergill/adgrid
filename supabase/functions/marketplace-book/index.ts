import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const INTERNAL_SECRET = Deno.env.get("INTERNAL_NOTIFICATION_SECRET") ?? "";

// AdGrid has no per-listing currency column today (checked: neither
// marketplace_listings nor marketplace_bookings has one) and the
// listing-creation UI only ever shows plain "$" -- matches the rest of the
// platform's CAD default (see bookings.currency ?? "cad" in stripe-webhook).
const MARKETPLACE_CURRENCY = "cad";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

async function notify(userId: string, type: string, data: Record<string, unknown>) {
  const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-notification`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-secret": INTERNAL_SECRET },
    body: JSON.stringify({ userId, type, data }),
  });
  if (!res.ok) {
    console.error(`notify failed: type=${type} userId=${userId} status=${res.status}`);
  }
}

// Pays the operator their full listed price (platform_fee_cents is what the
// advertiser paid *on top* -- see MarketplaceListingDetail's "total ${price
// + fee}" copy -- not a cut taken out of the operator's share, unlike
// charge-campaign's PLATFORM_FEE_RATE). Mirrors charge-campaign's
// distributeOperatorCuts in shape (idempotency key, transfer-then-log,
// failure notification) but for exactly one operator, since marketplace
// bookings are same-operator-only.
async function transferOperatorPayout(
  bookingId: string,
  operatorId: string,
  priceCents: number,
): Promise<void> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_connect_account_id, connect_status")
    .eq("id", operatorId)
    .maybeSingle();

  if (!profile?.stripe_connect_account_id || profile.connect_status !== "active") {
    console.warn(`[marketplace-book] operator ${operatorId} has no active Connect account — skipping transfer for booking ${bookingId}`);
    // Previously this returned here with no trace anywhere: no transfer row,
    // no notification -- the operator's Bookings view would show the
    // advertiser's payment as "Paid" with nothing to suggest their own
    // payout never happened. Log it as pending_connect and tell them, same
    // as a real transfer failure below -- the fix is the same either way
    // (finish Connect onboarding), so the message can be too.
    await supabase.from("marketplace_operator_transfers").upsert(
      {
        booking_id: bookingId,
        operator_id: operatorId,
        amount: priceCents / 100,
        currency: MARKETPLACE_CURRENCY,
        stripe_transfer_id: null,
        status: "pending_connect",
      },
      { onConflict: "booking_id" },
    );
    await notify(operatorId, "payout_transfer_failed", {
      amount: (priceCents / 100).toFixed(2),
      currency: MARKETPLACE_CURRENCY,
      appUrl: Deno.env.get("PUBLIC_APP_URL") ?? "",
    });
    return;
  }

  const idempotencyKey = `marketplace-transfer:${bookingId}`;

  try {
    const transfer = await stripe.transfers.create(
      {
        amount: priceCents,
        currency: MARKETPLACE_CURRENCY,
        destination: profile.stripe_connect_account_id,
        metadata: { marketplace_booking_id: bookingId, operator_id: operatorId },
      },
      { idempotencyKey },
    );

    await supabase.from("marketplace_operator_transfers").upsert(
      {
        booking_id: bookingId,
        operator_id: operatorId,
        amount: priceCents / 100,
        currency: MARKETPLACE_CURRENCY,
        stripe_transfer_id: transfer.id,
        status: "transferred",
      },
      { onConflict: "booking_id" },
    );
  } catch (e) {
    console.error(`[marketplace-book] transfer failed for booking ${bookingId}:`, e instanceof Error ? e.message : e);
    await supabase.from("marketplace_operator_transfers").upsert(
      {
        booking_id: bookingId,
        operator_id: operatorId,
        amount: priceCents / 100,
        currency: MARKETPLACE_CURRENCY,
        stripe_transfer_id: null,
        status: "failed",
      },
      { onConflict: "booking_id" },
    );
    await notify(operatorId, "payout_transfer_failed", {
      amount: (priceCents / 100).toFixed(2),
      currency: MARKETPLACE_CURRENCY,
      appUrl: Deno.env.get("PUBLIC_APP_URL") ?? "",
    });
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const authHeader = req.headers.get("Authorization") ?? "";
  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: CORS });
  }

  const { listingId, autoRenew } = await req.json();
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
  // Advertiser pays price + fee on top (matches MarketplaceListingDetail's
  // displayed total); the operator later gets the full listing price,
  // unreduced by the fee -- see transferOperatorPayout above.
  const totalCents = listing.price_cents + feeCents;

  const { data: advertiser } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!advertiser?.stripe_customer_id) {
    return new Response(
      JSON.stringify({ error: "You don't have a payment method on file yet. Add one in Billing settings, then try again." }),
      { status: 400, headers: CORS },
    );
  }

  const paymentMethods = await stripe.paymentMethods.list({
    customer: advertiser.stripe_customer_id,
    type: "card",
    limit: 1,
  });

  if (paymentMethods.data.length === 0) {
    return new Response(
      JSON.stringify({ error: "You don't have a card on file yet. Add one in Billing settings, then try again." }),
      { status: 400, headers: CORS },
    );
  }

  const paymentMethodId = paymentMethods.data[0].id;

  // Charge BEFORE confirming the booking. If this fails, the listing was
  // never touched -- it's still 'active' and bookable by anyone, exactly as
  // if this request never happened. Confirming first (the original stubbed
  // flow's order) would have left a "confirmed but never actually paid"
  // booking locking the listing with no way to release it -- there's no
  // marketplace booking cancellation path today.
  let paymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: MARKETPLACE_CURRENCY,
      customer: advertiser.stripe_customer_id,
      payment_method: paymentMethodId,
      confirm: true,
      off_session: true,
      description: `AdGrid Marketplace: listing ${listingId}`,
      metadata: { marketplace_listing_id: listingId, advertiser_id: user.id },
    }, {
      // Stable per (listing, advertiser) pair, not per-request -- a network
      // retry of the same booking attempt must not double-charge; a genuinely
      // new attempt on a *different* listing gets its own key.
      idempotencyKey: `marketplace-book:${listingId}:${user.id}`,
    });
  } catch (stripeErr: unknown) {
    const msg = stripeErr instanceof Error ? stripeErr.message : "Payment failed";
    return new Response(JSON.stringify({ error: msg }), { status: 400, headers: CORS });
  }

  if (paymentIntent.status === "requires_action" || paymentIntent.status === "requires_payment_method") {
    return new Response(
      JSON.stringify({
        error: "Your card requires additional authentication. Please update your payment method in Billing settings and try again.",
        requires_action: true,
      }),
      { status: 402, headers: CORS },
    );
  }

  if (paymentIntent.status !== "succeeded") {
    return new Response(
      JSON.stringify({ error: `Payment not completed (status: ${paymentIntent.status})` }),
      { status: 400, headers: CORS },
    );
  }

  // Payment is captured. Now atomically claim the listing -- marketplace_confirm_booking
  // locks the row (SELECT ... FOR UPDATE) and re-checks status='active' itself,
  // so a listing booked by someone else in the moment between our check above
  // and now is still caught here, not just by the exclusion constraint.
  const { data: bookingId, error: confirmErr } = await supabase.rpc("marketplace_confirm_booking", {
    p_listing_id: listingId,
    p_advertiser_id: user.id,
    p_fee_cents: feeCents,
  });

  if (confirmErr) {
    // We already charged a real card for a listing that turned out to be
    // unavailable (lost a race to another booking, or was cancelled in the
    // last moment) -- refund immediately rather than leaving the advertiser
    // charged for nothing.
    try {
      await stripe.refunds.create({ payment_intent: paymentIntent.id });
    } catch (refundErr) {
      console.error(
        `[marketplace-book] listing ${listingId} became unavailable after charging payment_intent ${paymentIntent.id}, ` +
        `AND the refund attempt itself failed -- needs manual refund:`,
        refundErr instanceof Error ? refundErr.message : refundErr,
      );
    }
    return new Response(
      JSON.stringify({ error: "This listing was just booked by someone else. Your card was not charged (or has been refunded)." }),
      { status: 409, headers: CORS },
    );
  }

  const { error: paymentUpdateErr } = await supabase.from("marketplace_bookings")
    .update({
      payment_intent_id: paymentIntent.id,
      payment_status: "paid",
      advertiser_auto_renew: !!autoRenew,
    })
    .eq("id", bookingId);
  if (paymentUpdateErr) {
    // The booking row is already confirmed and the charge already succeeded
    // at this point -- can't roll either back here -- but we must not tell
    // the client this booking is good and fire "confirmed" notifications
    // when its payment bookkeeping is broken. Surface the failure instead of
    // silently returning 200.
    console.error(`marketplace_bookings payment_status update failed: bookingId=${bookingId} error=${paymentUpdateErr.message}`);
    return new Response(
      JSON.stringify({ error: "booking confirmed and payment captured, but the payment record update failed", bookingId }),
      { status: 500, headers: CORS },
    );
  }

  // Fire and forget so a transfer hiccup doesn't block the advertiser's
  // success response -- mirrors charge-campaign's distributeOperatorCuts.
  transferOperatorPayout(bookingId, listing.operator_id, listing.price_cents).catch((e) =>
    console.error("[marketplace-book] operator transfer error:", e)
  );

  await notify(user.id, "marketplace_booking_confirmed", { listingId, bookingId, role: "advertiser" });
  await notify(listing.operator_id, "marketplace_booking_confirmed", { listingId, bookingId, role: "operator" });

  return new Response(JSON.stringify({ bookingId }), { headers: CORS });
});
