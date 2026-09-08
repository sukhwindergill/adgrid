import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rateLimited, rateLimitResponse } from "../_shared/rateLimit.ts";

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
  if (!authHeader) return new Response("Unauthorized", { status: 401, headers: CORS });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return new Response("Unauthorized", { status: 401, headers: CORS });

  if (await rateLimited(supabase, `operator-billing:${user.id}`, { limit: 30, windowSeconds: 60 })) {
    return rateLimitResponse(CORS);
  }

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
    // Scope to this operator's screens only
    const { data: opScreens } = await supabase
      .from("screens")
      .select("id")
      .eq("operator_id", user.id);
    const screenIds = (opScreens ?? []).map((s: { id: string }) => s.id);

    let bookings: unknown[] = [];
    if (screenIds.length > 0) {
      const { data: csRows } = await supabase
        .from("campaign_screens")
        .select("campaign_id")
        .in("screen_id", screenIds);
      const campaignIds = (csRows ?? []).map((r: { campaign_id: string }) => r.campaign_id);

      if (campaignIds.length > 0) {
        const { data: rows } = await supabase
          .from("bookings")
          .select("id, advertiser_name, screen_name, budget, payment_status, payment_intent_id, status, start_date")
          .in("id", campaignIds)
          .in("status", ["scheduled", "active", "completed"])
          .eq("payment_status", "paid")
          .order("start_date", { ascending: false })
          .limit(50);
        bookings = rows ?? [];
      }
    }

    const charges = (bookings as Array<{payment_intent_id:string|null,id:string,advertiser_name:string,screen_name:string,start_date:string,budget:number}>).map(b => ({
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

  // ── GET tax_summary: every paid payout in one calendar year ──────────────
  // The `summary` action above caps payouts at 20 (recent-activity view) --
  // not enough to cover a full year for an operator paid weekly or
  // bi-weekly. This queries Stripe directly with a year's date range
  // instead, so nothing outside the last 20 payouts goes missing from a
  // document meant for tax filing.
  if (req.method === "GET" && action === "tax_summary") {
    const yearParam = url.searchParams.get("year");
    const year = Number(yearParam);
    if (!yearParam || !Number.isInteger(year) || year < 2000 || year > 2100) {
      return new Response(JSON.stringify({ error: "year is required and must be a valid 4-digit year" }), { status: 400, headers: CORS });
    }

    if (!profile.stripe_connect_account_id || profile.connect_status !== "active") {
      return new Response(JSON.stringify({ year, payouts: [] }), { headers: CORS });
    }

    const gte = Math.floor(Date.UTC(year, 0, 1) / 1000);
    const lte = Math.floor(Date.UTC(year + 1, 0, 1) / 1000) - 1;

    try {
      const payoutsForYear: { id: string; amount: number; status: string; arrival_date: string; currency: string }[] = [];
      let startingAfter: string | undefined;
      // Capped at 5 pages (500 payouts) -- generous for any real payout
      // cadence in a single year, and bounds the request instead of paging
      // forever if something is malformed upstream.
      for (let page = 0; page < 5; page++) {
        const list = await stripe.payouts.list(
          { limit: 100, created: { gte, lte }, starting_after: startingAfter },
          { stripeAccount: profile.stripe_connect_account_id },
        );
        for (const p of list.data) {
          payoutsForYear.push({
            id: p.id,
            amount: p.amount / 100,
            status: p.status,
            arrival_date: new Date(p.arrival_date * 1000).toISOString().split("T")[0],
            currency: p.currency,
          });
        }
        if (!list.has_more || list.data.length === 0) break;
        startingAfter = list.data[list.data.length - 1].id;
      }

      return new Response(JSON.stringify({ year, payouts: payoutsForYear }), { headers: CORS });
    } catch (_e) {
      return new Response(JSON.stringify({ year, payouts: [] }), { headers: CORS });
    }
  }

  // ── POST payout: trigger manual payout to bank ────────────────────────────
  if (req.method === "POST" && action === "payout") {
    if (!profile.stripe_connect_account_id || profile.connect_status !== "active") {
      return new Response(
        JSON.stringify({ error: "Stripe Connect account not set up or not active" }),
        { status: 400, headers: CORS },
      );
    }

    const { amount, currency = "cad" } = await req.json();
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
