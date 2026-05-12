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

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    return new Response(JSON.stringify({ invoices: [], paymentMethods: [], portalUrl: null }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const customerId = profile.stripe_customer_id;

  const [invoicesList, paymentMethodsList, portalSession] = await Promise.all([
    stripe.invoices.list({ customer: customerId, limit: 24 }),
    stripe.paymentMethods.list({ customer: customerId, type: "card" }),
    stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: req.headers.get("origin") ?? Deno.env.get("SITE_URL")!,
    }),
  ]);

  const invoices = invoicesList.data.map((inv) => ({
    id: inv.id,
    date: inv.created,
    description: inv.description ?? "AdGrid Campaign",
    amount: inv.amount_paid / 100,
    currency: inv.currency,
    status: inv.status,
    pdf: inv.invoice_pdf,
  }));

  const paymentMethods = paymentMethodsList.data.map((pm) => ({
    id: pm.id,
    brand: pm.card?.brand ?? "card",
    last4: pm.card?.last4 ?? "****",
    expMonth: pm.card?.exp_month,
    expYear: pm.card?.exp_year,
  }));

  return new Response(JSON.stringify({ invoices, paymentMethods, portalUrl: portalSession.url }), {
    headers: { "Content-Type": "application/json" },
  });
});
