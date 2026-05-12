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

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Content-Type": "application/json",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401 });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return new Response("Unauthorized", { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, stripe_connect_account_id, connect_status")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "operator") {
    return new Response("Forbidden", { status: 403, headers: CORS });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "summary";

  // ── GET summary: charges from bookings + payout balance ──────────────────
  if (req.method === "GET" && action === "summary") {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("id, advertiser_name, screen_name, budget, payment_status, payment_intent_id, status, start_date")
      .in("status", ["scheduled", "active", "completed"])
      .eq("payment_status", "paid")
      .order("start_date", { ascending: false })
      .limit(50);

    const charges = (bookings ?? []).map(b => ({
      id: b.payment_intent_id ?? b.id,
      advertiser: b.advertiser_name,
      screen: b.screen_name,
      date: b.start_date,
      amount: b.budget,
      status: "paid",
    }));

    let balance = null;
    let payouts: unknown[] = [];

    if (profile.stripe_connect_account_id && profile.connect_status === "active") {
      try {
        const [bal, payoutList] = await Promise.all([
          stripe.balance.retrieve({ stripeAccount: profile.stripe_connect_account_id }),
          stripe.payouts.list({ limit: 20 }, { stripeAccount: profile.stripe_connect_account_id }),
        ]);

        balance = {
          available: bal.available.reduce((a, b) => a + b.amount, 0) / 100,
          pending:   bal.pending.reduce((a, b) => a + b.amount, 0) / 100,
          currency:  bal.available[0]?.currency ?? "gbp",
        };

        payouts = payoutList.data.map(p => ({
          id: p.id,
          amount: p.amount / 100,
          status: p.status,
          arrival_date: new Date(p.arrival_date * 1000).toISOString().split("T")[0],
          currency: p.currency,
        }));
      } catch (_e) {
        // Connect account not fully onboarded yet — return empty balance
      }
    }

    return new Response(JSON.stringify({ charges, balance, payouts, connectStatus: profile.connect_status }), {
      headers: CORS,
    });
  }

  // ── POST payout: trigger manual payout to bank ────────────────────────────
  if (req.method === "POST" && action === "payout") {
    if (!profile.stripe_connect_account_id || profile.connect_status !== "active") {
      return new Response(
        JSON.stringify({ error: "Stripe Connect account not set up or not active" }),
        { status: 400, headers: CORS },
      );
    }

    const { amount, currency = "gbp" } = await req.json();
    if (!amount || amount <= 0) {
      return new Response(JSON.stringify({ error: "amount required" }), { status: 400, headers: CORS });
    }

    try {
      const payout = await stripe.payouts.create(
        { amount: Math.round(amount * 100), currency },
        { stripeAccount: profile.stripe_connect_account_id },
      );

      return new Response(
        JSON.stringify({ success: true, payout_id: payout.id, status: payout.status, arrival_date: new Date(payout.arrival_date * 1000).toISOString().split("T")[0] }),
        { headers: CORS },
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Payout failed";
      return new Response(JSON.stringify({ error: msg }), { status: 400, headers: CORS });
    }
  }

  return new Response("Not Found", { status: 404, headers: CORS });
});
