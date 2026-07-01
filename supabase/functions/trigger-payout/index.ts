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

  // Per-currency deduplication is handled inside the transfer loop below.
  // No top-level period guard — allows retries when only some currencies succeeded.

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
    .in("screen_id", screenIds);
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

  const PLATFORM_FEE_RATE = 0.12;
  const revenueShare = profile.owner_revenue_share ?? 0.40;

  // Group by currency to avoid cross-currency aggregation
  const byCurrency = new Map<string, number>();
  for (const c of (campaigns ?? []) as { budget: number; currency?: string }[]) {
    const cur = (c.currency ?? "cad").toLowerCase();
    byCurrency.set(cur, (byCurrency.get(cur) ?? 0) + (c.budget ?? 0));
  }

  if (byCurrency.size === 0) {
    return new Response(
      JSON.stringify({ error: "Nothing to pay out for this period" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const transfers: { transferId: string; amount: number; currency: string }[] = [];
  const failures: { currency: string; error: string }[] = [];

  for (const [payoutCurrency, totalBudget] of byCurrency) {
    const payoutAmount = Math.round(totalBudget * (1 - PLATFORM_FEE_RATE) * revenueShare * 100); // cents
    if (payoutAmount <= 0) continue;

    // Skip if already transferred for this currency in this period
    const { data: existingForCurrency } = await supabase
      .from("payouts")
      .select("id")
      .eq("operator_id", user.id)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .eq("currency", payoutCurrency)
      .eq("status", "transferred")
      .maybeSingle();

    if (existingForCurrency) {
      console.log(`[trigger-payout] already transferred ${payoutCurrency} for this period — skipping`);
      continue;
    }

    try {
      const transfer = await stripe.transfers.create({
        amount: payoutAmount,
        currency: payoutCurrency,
        destination: profile.stripe_connect_account_id,
        metadata: { operator_id: user.id, period_start: periodStart, period_end: periodEnd, currency: payoutCurrency },
      });

      await supabase.from("payouts").insert({
        operator_id: user.id,
        amount: payoutAmount / 100,
        currency: payoutCurrency,
        stripe_transfer_id: transfer.id,
        status: "transferred",
        period_start: periodStart,
        period_end: periodEnd,
      });

      transfers.push({ transferId: transfer.id, amount: payoutAmount / 100, currency: payoutCurrency });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[trigger-payout] transfer failed for currency ${payoutCurrency}:`, msg);
      failures.push({ currency: payoutCurrency, error: msg });
    }
  }

  if (transfers.length === 0 && failures.length === 0) {
    return new Response(
      JSON.stringify({ error: "Nothing to pay out for this period" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const status = failures.length > 0 ? 207 : 200;
  return new Response(
    JSON.stringify({ ok: transfers.length > 0, transfers, failures }),
    { status, headers: { "Content-Type": "application/json" } }
  );
});
