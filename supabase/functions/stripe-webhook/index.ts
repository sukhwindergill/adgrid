import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { computeReversalDelta } from "../_shared/transferReversal.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const FUNCTIONS_URL = `${Deno.env.get("SUPABASE_URL")!}/functions/v1`;

async function notifyAdvertiser(userId: string, type: string, data: Record<string, string>) {
  await fetch(`${FUNCTIONS_URL}/send-notification`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": Deno.env.get("INTERNAL_NOTIFICATION_SECRET") ?? "",
    },
    body: JSON.stringify({ userId, type, data }),
  }).catch(() => {});
}

async function bookingForPaymentIntent(paymentIntentId: string) {
  const { data } = await supabase
    .from("bookings")
    .select("id, advertiser_id, advertiser_name, budget, currency, payment_status, status")
    .eq("payment_intent_id", paymentIntentId)
    .maybeSingle();
  return data;
}

// S18 fix: distributeOperatorCuts (charge-campaign) fires an operator Stripe
// Transfer immediately on successful charge, before a campaign even airs.
// Neither charge.refunded nor charge.dispute.created ever clawed any of that
// back. `refundedOrDisputedCents` is the total refunded/disputed so far (not
// a delta — Stripe reports cumulative amounts on both charge.amount_refunded
// and dispute.amount), so the ratio-based delta math in
// computeReversalDelta is what keeps repeated/redelivered webhooks for the
// same booking from over-reversing.
async function reverseOperatorTransfers(bookingId: string, budget: number, refundedOrDisputedCents: number) {
  const bookingCents = Math.round(budget * 100);
  if (bookingCents <= 0) return;
  const refundRatio = refundedOrDisputedCents / bookingCents;

  const { data: transfers } = await supabase
    .from("operator_transfers")
    .select("id, amount, reversed_amount, stripe_transfer_id, status")
    .eq("booking_id", bookingId)
    .not("status", "eq", "failed");

  if (!transfers || transfers.length === 0) return;

  for (const t of transfers as {
    id: string; amount: number; reversed_amount: number | null;
    stripe_transfer_id: string | null; status: string;
  }[]) {
    if (!t.stripe_transfer_id) continue;

    const { delta, newReversedAmount, newStatus } = computeReversalDelta({
      transferAmount: t.amount,
      alreadyReversed: t.reversed_amount ?? 0,
      refundRatio,
    });

    if (delta <= 0) continue; // already covered by a prior delivery of this same cumulative amount

    try {
      await stripe.transfers.createReversal(t.stripe_transfer_id, {
        amount: Math.round(delta * 100),
        metadata: { booking_id: bookingId, operator_transfer_id: t.id, reason: "refund_or_dispute" },
      }, {
        // Tied to the cumulative target, not this event's id — a webhook
        // redelivery recomputes the same target and lands on the same key.
        idempotencyKey: `reverse:${t.id}:${newReversedAmount}`,
      });

      await supabase.from("operator_transfers")
        .update({ reversed_amount: newReversedAmount, status: newStatus })
        .eq("id", t.id);
    } catch (e) {
      console.error(
        `[stripe-webhook] transfer reversal failed for operator_transfers ${t.id}:`,
        e instanceof Error ? e.message : e,
      );
      // Leave the row as-is — it still shows the pre-reversal state, which
      // reads as "needs manual attention" rather than silently succeeding.
    }
  }
}

async function pauseAndAlert(paymentIntentId: string, amount: number, currency?: string) {
  const booking = await bookingForPaymentIntent(paymentIntentId);
  if (!booking) return;

  await supabase
    .from("bookings")
    .update({ payment_status: "failed", status: "paused" })
    .eq("id", booking.id);

  await notifyAdvertiser(booking.advertiser_id, "payment_failed", {
    amount: amount.toFixed(2),
    currency: currency ?? (booking as { currency?: string }).currency ?? "cad",
    appUrl: Deno.env.get("PUBLIC_APP_URL") ?? "",
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing stripe-signature", { status: 400 });

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, WEBHOOK_SECRET);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Invalid signature";
    return new Response(`Webhook signature verification failed: ${msg}`, { status: 400 });
  }

  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const booking = await bookingForPaymentIntent(pi.id);
      if (booking && booking.payment_status !== "paid") {
        await supabase
          .from("bookings")
          .update({ payment_status: "paid", status: "scheduled" })
          .eq("id", booking.id);

        // campaign_screens status is intentionally left as-is.
        // At booking creation, CreateCampaign sets each row to 'auto_approved'
        // (if the screen's auto_approve flag is on) or 'pending' (manual review).
        // Overriding 'pending' → 'approved' here would bypass operator content review.
      }
      break;
    }

    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      await pauseAndAlert(pi.id, pi.amount / 100, pi.currency);
      break;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
      if (paymentIntentId) {
        const booking = await bookingForPaymentIntent(paymentIntentId);
        if (booking) {
          await supabase
            .from("bookings")
            .update({ payment_status: "refunded", status: "paused" })
            .eq("id", booking.id);
          // amount_refunded is cumulative (Stripe convention), matching what
          // reverseOperatorTransfers/computeReversalDelta expect.
          await reverseOperatorTransfers(booking.id, booking.budget, charge.amount_refunded);
        }
      }
      break;
    }

    case "charge.dispute.created": {
      const dispute = event.data.object as Stripe.Dispute;
      const paymentIntentId = typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id;
      if (paymentIntentId) {
        await pauseAndAlert(paymentIntentId, dispute.amount / 100, dispute.currency);
        const booking = await bookingForPaymentIntent(paymentIntentId);
        if (booking) {
          await reverseOperatorTransfers(booking.id, booking.budget, dispute.amount);
        }
      }
      break;
    }

    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "setup") break;

      // Resolve the customer's supabase user id
      const customerId = typeof session.customer === "string"
        ? session.customer
        : session.customer?.id;
      if (!customerId) break;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, preferred_currency")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();
      if (!profile) break;

      // Only auto-set if still on the default — never overwrite a manual override
      if (profile.preferred_currency !== "cad") break;

      // Expand the setup intent to get the payment method's card country
      const setupIntentId = typeof session.setup_intent === "string"
        ? session.setup_intent
        : (session.setup_intent as Stripe.SetupIntent | null)?.id;
      if (!setupIntentId) break;

      const setupIntent = await stripe.setupIntents.retrieve(setupIntentId, {
        expand: ["payment_method"],
      });

      const pm = setupIntent.payment_method as Stripe.PaymentMethod | null;
      const cardCountry = pm?.card?.country ?? null;

      const detectedCurrency = cardCountry === "US" ? "usd" : "cad";
      if (detectedCurrency === "cad") break; // already default, no write needed

      await supabase
        .from("profiles")
        .update({ preferred_currency: detectedCurrency })
        .eq("id", profile.id);

      break;
    }

    default:
      break;
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
