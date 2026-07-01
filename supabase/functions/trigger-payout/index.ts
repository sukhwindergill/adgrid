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
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401 });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return new Response("Unauthorized", { status: 401 });

  const { periodStart, periodEnd } = await req.json();
  if (!periodStart || !periodEnd) {
    return new Response("Missing periodStart or periodEnd", { status: 400 });
  }

  // Get operator profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_connect_account_id, connect_status, owner_revenue_share")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_connect_account_id || profile.connect_status !== "active") {
    return new Response(
      JSON.stringify({ error: "Stripe Connect account not active" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Check for existing payout in this period (prevent double-pay)
  const { data: existingPayout } = await supabase
    .from("payouts")
    .select("id")
    .eq("operator_id", user.id)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .eq("status", "transferred")
    .maybeSingle();

  if (existingPayout) {
    return new Response(
      JSON.stringify({ error: "Payout already exists for this period" }),
      { status: 409, headers: { "Content-Type": "application/json" } }
    );
  }

  // Get operator's screens
  const { data: operatorScreens } = await supabase
    .from("screens")
    .select("id")
    .eq("operator_id", user.id);

  const screenIds = (operatorScreens ?? []).map((s: { id: string }) => s.id);

  if (screenIds.length === 0) {
    return new Response(
      JSON.stringify({ error: "No screens found for this operator" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Resolve campaign IDs on operator's screens via campaign_screens
  const { data: csRows } = await supabase
    .from("campaign_screens")
    .select("campaign_id")
    .in("screen_id", screenIds)
    .in("status", ["approved", "auto_approved"]);
  const campaignIds = (csRows ?? []).map((r: { campaign_id: string }) => r.campaign_id);

  // Sum campaign budgets within period
  const { data: campaigns } = campaignIds.length > 0
    ? await supabase
        .from("bookings")
        .select("budget, currency")
        .in("id", campaignIds)
        .gte("start_date", periodStart)
        .lte("end_date", periodEnd)
        .eq("payment_status", "paid")
    : { data: [] };

  const totalBudget = (campaigns ?? []).reduce(
    (sum: number, c: { budget: number }) => sum + (c.budget ?? 0),
    0
  );

  // Derive currency from first paid booking (all should match for one operator)
  const payoutCurrency = (campaigns as { currency?: string }[])[0]?.currency ?? "cad";

  const PLATFORM_FEE_RATE = 0.12;

  const revenueShare = profile.owner_revenue_share ?? 0.40;
  // Match charge-campaign math: budget × (1 - platformFee) × revenueShare
  const payoutAmount = Math.round(totalBudget * (1 - PLATFORM_FEE_RATE) * revenueShare * 100); // cents

  if (payoutAmount <= 0) {
    return new Response(
      JSON.stringify({ error: "Nothing to pay out for this period" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Create Stripe Transfer
  const transfer = await stripe.transfers.create({
    amount: payoutAmount,
    currency: payoutCurrency,
    destination: profile.stripe_connect_account_id,
    metadata: { operator_id: user.id, period_start: periodStart, period_end: periodEnd },
  });

  // Log payout
  await supabase.from("payouts").insert({
    operator_id: user.id,
    amount: payoutAmount / 100,
    currency: payoutCurrency,
    stripe_transfer_id: transfer.id,
    status: "transferred",
    period_start: periodStart,
    period_end: periodEnd,
  });

  return new Response(
    JSON.stringify({ ok: true, transferId: transfer.id, amount: payoutAmount / 100 }),
    { headers: { "Content-Type": "application/json" } }
  );
});
