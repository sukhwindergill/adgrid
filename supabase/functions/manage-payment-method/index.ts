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
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401, headers: CORS });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return new Response("Unauthorized", { status: 401, headers: CORS });

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    return new Response(JSON.stringify({ error: "No billing account on file." }), { status: 404, headers: CORS });
  }
  const customerId = profile.stripe_customer_id;

  const { action, payment_method_id } = await req.json().catch(() => ({}));
  if (!payment_method_id || typeof payment_method_id !== "string") {
    return new Response(JSON.stringify({ error: "payment_method_id is required" }), { status: 400, headers: CORS });
  }
  if (action !== "set_default" && action !== "detach") {
    return new Response(JSON.stringify({ error: "action must be 'set_default' or 'detach'" }), { status: 400, headers: CORS });
  }

  try {
    // Ownership check -- a payment method belongs to exactly one customer;
    // never let a caller act on a card that isn't attached to their own
    // Stripe customer, regardless of what id they pass in.
    const pm = await stripe.paymentMethods.retrieve(payment_method_id);
    if (pm.customer !== customerId) {
      return new Response(JSON.stringify({ error: "Payment method not found." }), { status: 404, headers: CORS });
    }

    if (action === "set_default") {
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: payment_method_id },
      });
    } else {
      // Detaching the current default is allowed -- Stripe just clears
      // invoice_settings.default_payment_method, future charges use whatever
      // card is attached next (or fail cleanly if none is).
      await stripe.paymentMethods.detach(payment_method_id);
    }

    return new Response(JSON.stringify({ ok: true }), { headers: CORS });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update payment method";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: CORS });
  }
});
