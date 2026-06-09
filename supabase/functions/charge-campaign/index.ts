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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401 });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return new Response("Unauthorized", { status: 401 });

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const { campaign_id } = await req.json();
  if (!campaign_id) {
    return new Response(JSON.stringify({ error: "campaign_id required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, budget, advertiser_id, advertiser_name, screen_name, payment_status")
    .eq("id", campaign_id)
    .single();

  if (bookingError || !booking) {
    return new Response(JSON.stringify({ error: "Campaign not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Either the operator approving the campaign, or the advertiser who owns it, may trigger the charge
  const isOwner = booking.advertiser_id === user.id;
  if (callerProfile?.role !== "operator" && !isOwner) {
    return new Response("Forbidden", { status: 403 });
  }

  if (booking.payment_status === "paid") {
    return new Response(JSON.stringify({ error: "Campaign already paid" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: advertiser } = await supabase
    .from("profiles")
    .select("stripe_customer_id, email")
    .eq("id", booking.advertiser_id)
    .single();

  if (!advertiser?.stripe_customer_id) {
    return new Response(
      JSON.stringify({ error: "Advertiser has no payment account. Ask them to set up billing first." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const paymentMethods = await stripe.paymentMethods.list({
    customer: advertiser.stripe_customer_id,
    type: "card",
    limit: 1,
  });

  if (paymentMethods.data.length === 0) {
    return new Response(
      JSON.stringify({ error: "Advertiser has no card on file. Ask them to add a payment method in billing settings." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const paymentMethodId = paymentMethods.data[0].id;
  const amountPence = Math.round(booking.budget * 100);

  let paymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.create({
      amount: amountPence,
      currency: "gbp",
      customer: advertiser.stripe_customer_id,
      payment_method: paymentMethodId,
      confirm: true,
      off_session: true,
      description: `AdGrid: ${booking.advertiser_name} — ${booking.screen_name}`,
      metadata: { campaign_id: booking.id, advertiser_id: booking.advertiser_id },
    }, {
      idempotencyKey: `charge-campaign:${booking.id}`,
    });
  } catch (stripeErr: unknown) {
    const msg = stripeErr instanceof Error ? stripeErr.message : "Payment failed";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (paymentIntent.status !== "succeeded") {
    return new Response(
      JSON.stringify({ error: `Payment not completed (status: ${paymentIntent.status})` }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  await supabase
    .from("bookings")
    .update({
      status: "scheduled",
      payment_intent_id: paymentIntent.id,
      payment_status: "paid",
    })
    .eq("id", campaign_id);

  // Approve any pending campaign_screens rows so display-feed can serve the campaign
  await supabase
    .from("campaign_screens")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("campaign_id", campaign_id)
    .eq("status", "pending");

  return new Response(
    JSON.stringify({ success: true, payment_intent_id: paymentIntent.id }),
    { headers: { "Content-Type": "application/json" } },
  );
});
