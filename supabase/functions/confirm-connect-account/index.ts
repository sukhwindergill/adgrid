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
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

// B16: the client used to set connect_status = 'active' the instant the
// browser landed back on Stripe's return_url, with no check that the
// account actually finished onboarding. Stripe's own docs are explicit
// that the return_url fires regardless of completion -- an operator who
// closes the KYC form early lands back here looking "connected." This
// function is the real verification step: call the Stripe API directly and
// only mark active when the account can actually receive transfers.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: CORS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401, headers: CORS });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return new Response("Unauthorized", { status: 401, headers: CORS });

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_connect_account_id")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_connect_account_id) {
    return new Response(JSON.stringify({ error: "No Connect account on file" }), { status: 400, headers: CORS });
  }

  let account;
  try {
    account = await stripe.accounts.retrieve(profile.stripe_connect_account_id);
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Could not verify account with Stripe" }),
      { status: 502, headers: CORS },
    );
  }

  // charges_enabled + payouts_enabled is what actually gates a real
  // Transfer succeeding (see charge-campaign's distributeOperatorCuts) --
  // details_submitted alone isn't enough (Stripe can still be reviewing).
  const active = !!(account.charges_enabled && account.payouts_enabled);
  const newStatus = active ? "active" : account.details_submitted ? "restricted" : "pending";

  await supabase.from("profiles").update({ connect_status: newStatus }).eq("id", user.id);

  return new Response(
    JSON.stringify({
      connectStatus: newStatus,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
    }),
    { headers: CORS },
  );
});
