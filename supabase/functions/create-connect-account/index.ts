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
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

Deno.serve(async (req: Request) => {
  // B17: every browser call here carries an Authorization header, which
  // forces a CORS preflight OPTIONS request first. Without this branch the
  // preflight fell into the auth check below (which requires a real bearer
  // token no preflight ever sends) and 401'd — the browser then aborted the
  // real POST entirely. This is the same bug class as B9
  // (send-notification): "Connect with Stripe" has never actually reached
  // this function in production, for any operator, which is the real root
  // cause behind connect_status staying null for every operator to date.
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  // B: every error path below used to return plain text, not JSON. The
  // client always calls res.json() on the response -- a plain-text body
  // makes that throw an uncaught SyntaxError instead of surfacing the real
  // error, which left the "Connect with Stripe" button stuck on
  // "Redirecting to Stripe…" forever with no feedback. Every response here
  // is JSON now so res.json() never blows up, no matter which branch fires.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });

  if (await rateLimited(supabase, `create-connect-account:${user.id}`, { limit: 20, windowSeconds: 3600 })) {
    return rateLimitResponse(CORS);
  }

  const { returnUrl, state } = await req.json();
  if (!returnUrl) return new Response(JSON.stringify({ error: "Missing returnUrl" }), { status: 400, headers: CORS });
  if (!state) return new Response(JSON.stringify({ error: "Missing state" }), { status: 400, headers: CORS });

  // Only operators may create Connect (payout) accounts
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, stripe_connect_account_id, connect_status")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "operator") {
    return new Response(JSON.stringify({ error: "Forbidden — operators only" }), { status: 403, headers: CORS });
  }

  let accountId = profile.stripe_connect_account_id;

  try {
    if (!accountId) {
      const account = await stripe.accounts.create({ type: "express" });
      accountId = account.id;

      await supabase
        .from("profiles")
        .update({ stripe_connect_account_id: accountId, connect_status: "pending" })
        .eq("id", user.id);
    }

    // Generate onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: returnUrl + "?connect=refresh",
      return_url: returnUrl + "?connect=success&state=" + encodeURIComponent(state),
      type: "account_onboarding",
    });

    return new Response(JSON.stringify({ url: accountLink.url }), { headers: CORS });
  } catch (e) {
    // Previously an uncaught Stripe error here fell through to Deno's
    // default 500, which carries none of the CORS headers above -- the
    // browser would show a generic "CORS error" instead of the real
    // message, exactly the class of bug this whole file was already fixing.
    console.error("[create-connect-account] Stripe error:", e instanceof Error ? e.message : e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Could not start Stripe Connect onboarding" }),
      { status: 502, headers: CORS },
    );
  }
});
