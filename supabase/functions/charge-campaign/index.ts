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

const FUNCTIONS_URL = `${Deno.env.get("SUPABASE_URL")!}/functions/v1`;

const PLATFORM_FEE_RATE = 0.12;

async function distributeOperatorCuts(
  bookingId: string,
  budget: number,
  currency: string,
): Promise<void> {
  // 1. Find all screens for this campaign
  const { data: csRows } = await supabase
    .from("campaign_screens")
    .select("screen_id")
    .eq("campaign_id", bookingId);

  if (!csRows || csRows.length === 0) return;

  const screenIds = csRows.map((r: { screen_id: string }) => r.screen_id);
  const totalScreens = screenIds.length;

  // 2. Fetch operator info for each screen
  const { data: screenRows } = await supabase
    .from("screens")
    .select("id, operator_id")
    .in("id", screenIds);

  if (!screenRows || screenRows.length === 0) return;

  // 3. Group screens by operator
  const byOperator = new Map<string, number>();
  for (const s of screenRows as { id: string; operator_id: string }[]) {
    if (!s.operator_id) continue;
    byOperator.set(s.operator_id, (byOperator.get(s.operator_id) ?? 0) + 1);
  }

  if (byOperator.size === 0) return;

  // 4. Fetch operator profiles (Connect account + revenue share)
  const operatorIds = [...byOperator.keys()];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, stripe_connect_account_id, connect_status, owner_revenue_share")
    .in("id", operatorIds);

  if (!profiles) return;

  // 5. For each operator, compute their cut and create a Stripe Transfer
  const netBudget = budget * (1 - PLATFORM_FEE_RATE);

  for (const profile of profiles as {
    id: string;
    stripe_connect_account_id: string | null;
    connect_status: string | null;
    owner_revenue_share: number | null;
  }[]) {
    if (!profile.stripe_connect_account_id || profile.connect_status !== "active") {
      console.warn(`[charge-campaign] operator ${profile.id} has no active Connect account — skipping transfer`);
      continue;
    }

    const operatorScreenCount = byOperator.get(profile.id) ?? 0;
    if (operatorScreenCount === 0) continue;

    const revenueShare = profile.owner_revenue_share ?? 0.40;
    const operatorCut = netBudget * revenueShare * (operatorScreenCount / totalScreens);
    const amountCents = Math.round(operatorCut * 100);

    if (amountCents <= 0) continue;

    // Idempotency key prevents double-transfer if this runs twice
    const idempotencyKey = `operator-transfer:${bookingId}:${profile.id}`;

    try {
      const transfer = await stripe.transfers.create(
        {
          amount: amountCents,
          currency,
          destination: profile.stripe_connect_account_id,
          metadata: {
            booking_id: bookingId,
            operator_id: profile.id,
            screen_count: String(operatorScreenCount),
            total_screens: String(totalScreens),
          },
        },
        { idempotencyKey },
      );

      // Log the transfer — upsert so re-runs don't duplicate rows
      await supabase.from("operator_transfers").upsert(
        {
          booking_id: bookingId,
          operator_id: profile.id,
          amount: amountCents / 100,
          currency,
          stripe_transfer_id: transfer.id,
          status: "transferred",
          screen_count: operatorScreenCount,
          total_screens: totalScreens,
        },
        { onConflict: "booking_id,operator_id" },
      );
    } catch (e) {
      console.error(
        `[charge-campaign] transfer failed for operator ${profile.id}:`,
        e instanceof Error ? e.message : e,
      );
      // Log the failure so it can be retried via admin flow
      await supabase.from("operator_transfers").upsert(
        {
          booking_id: bookingId,
          operator_id: profile.id,
          amount: amountCents / 100,
          currency,
          stripe_transfer_id: null,
          status: "failed",
          screen_count: operatorScreenCount,
          total_screens: totalScreens,
        },
        { onConflict: "booking_id,operator_id" },
      );
    }
  }
}

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
    .select("id, budget, currency, advertiser_id, advertiser_name, screen_name, payment_status")
    .eq("id", campaign_id)
    .single();

  if (bookingError || !booking) {
    return new Response(JSON.stringify({ error: "Campaign not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // The advertiser who owns the campaign may trigger the charge.
  // Operators may also trigger it, but only if they own at least one screen
  // in this campaign — prevents any operator charging any advertiser's card.
  const isOwner = booking.advertiser_id === user.id;
  if (!isOwner) {
    if (callerProfile?.role !== "operator") {
      return new Response("Forbidden", { status: 403 });
    }
    const { data: opScreens } = await supabase
      .from("screens")
      .select("id")
      .eq("operator_id", user.id);
    const opScreenIds = (opScreens ?? []).map((s) => s.id);
    const { data: operatorLink } = opScreenIds.length > 0
      ? await supabase
          .from("campaign_screens")
          .select("id")
          .eq("campaign_id", campaign_id)
          .in("screen_id", opScreenIds)
          .limit(1)
          .maybeSingle()
      : { data: null };
    if (!operatorLink) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  // Atomic lock: flip payment_status to 'charging' only if currently not paid/charging.
  // Concurrent requests both reading 'unpaid' would race; only one UPDATE wins.
  const { data: locked } = await supabase
    .from("bookings")
    .update({ payment_status: "charging" })
    .eq("id", campaign_id)
    .not("payment_status", "in", '("paid","charging")')
    .select("id")
    .maybeSingle();

  if (!locked) {
    // Either already paid or another request is mid-flight
    return new Response(
      JSON.stringify({ error: "Campaign is already paid or a payment is in progress." }),
      { status: 409, headers: { "Content-Type": "application/json" } },
    );
  }

  const { data: advertiser } = await supabase
    .from("profiles")
    .select("stripe_customer_id, email")
    .eq("id", booking.advertiser_id)
    .single();

  if (!advertiser?.stripe_customer_id) {
    // Revert lock so the charge can be retried after billing setup
    await supabase.from("bookings").update({ payment_status: booking.payment_status }).eq("id", campaign_id);
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
    await supabase.from("bookings").update({ payment_status: booking.payment_status }).eq("id", campaign_id);
    return new Response(
      JSON.stringify({ error: "Advertiser has no card on file. Ask them to add a payment method in billing settings." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const paymentMethodId = paymentMethods.data[0].id;
  const amountCents = Math.round(booking.budget * 100);
  const currency = booking.currency ?? "cad";

  let paymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency,
      customer: advertiser.stripe_customer_id,
      payment_method: paymentMethodId,
      confirm: true,
      off_session: true,
      description: `AdGrid: ${booking.advertiser_name} — ${booking.screen_name}`,
      metadata: { campaign_id: booking.id, advertiser_id: booking.advertiser_id },
    }, {
      idempotencyKey: `charge-campaign:${booking.id}:${paymentMethodId}`,
    });
  } catch (stripeErr: unknown) {
    const msg = stripeErr instanceof Error ? stripeErr.message : "Payment failed";
    await supabase
      .from("bookings")
      .update({ payment_status: "failed", status: "paused" })
      .eq("id", campaign_id);
    await notifyAdvertiser(booking.advertiser_id, "payment_failed", {
      amount: booking.budget.toFixed(2),
      currency,
      appUrl: Deno.env.get("PUBLIC_APP_URL") ?? "",
    });
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 3DS / requires_action: card needs authentication — send advertiser to billing to re-attempt
  if (paymentIntent.status === "requires_action" || paymentIntent.status === "requires_payment_method") {
    await supabase
      .from("bookings")
      .update({ payment_status: "failed", status: "paused", payment_intent_id: paymentIntent.id })
      .eq("id", campaign_id);
    await notifyAdvertiser(booking.advertiser_id, "payment_authentication_required", {
      amount: booking.budget.toFixed(2),
      currency,
      appUrl: Deno.env.get("PUBLIC_APP_URL") ?? "",
    });
    return new Response(
      JSON.stringify({
        error: "Your card requires additional authentication. Please update your payment method in billing settings and try again.",
        requires_action: true,
      }),
      { status: 402, headers: { "Content-Type": "application/json" } },
    );
  }

  if (paymentIntent.status !== "succeeded") {
    await supabase
      .from("bookings")
      .update({ payment_status: "failed", status: "paused" })
      .eq("id", campaign_id);
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
      currency,
    })
    .eq("id", campaign_id);

  // Distribute operator cuts — fire and forget so a transfer hiccup
  // doesn't block the advertiser's success response.
  distributeOperatorCuts(campaign_id, booking.budget, currency).catch((e) =>
    console.error("[charge-campaign] operator transfer error:", e)
  );

  return new Response(
    JSON.stringify({ success: true, payment_intent_id: paymentIntent.id }),
    { headers: { "Content-Type": "application/json" } },
  );
});
