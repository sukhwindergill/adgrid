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

  const { returnUrl, state } = await req.json();
  if (!returnUrl) return new Response("Missing returnUrl", { status: 400 });
  if (!state) return new Response("Missing state", { status: 400 });

  // Only operators may create Connect (payout) accounts
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, stripe_connect_account_id, connect_status")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "operator") {
    return new Response("Forbidden — operators only", { status: 403 });
  }

  let accountId = profile.stripe_connect_account_id;

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

  return new Response(JSON.stringify({ url: accountLink.url }), {
    headers: { "Content-Type": "application/json" },
  });
});
