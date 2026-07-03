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

const WEBHOOK_SECRET = Deno.env.get("STRIPE_IDENTITY_WEBHOOK_SECRET")!;

Deno.serve(async (req: Request) => {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig!, WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  const session = event.data.object as Stripe.Identity.VerificationSession;
  const operatorId = session.metadata?.operator_id;

  if (!operatorId) {
    console.warn("No operator_id in session metadata:", session.id);
    return new Response("OK", { status: 200 });
  }

  if (event.type === "identity.verification_session.verified") {
    await supabase
      .from("profiles")
      .update({ verification_status: "verified", verified_at: new Date().toISOString() })
      .eq("id", operatorId);

    await supabase
      .from("identity_verifications")
      .update({ status: "verified" })
      .eq("stripe_session_id", session.id);

  } else if (event.type === "identity.verification_session.requires_input") {
    await supabase
      .from("profiles")
      .update({ verification_status: "pending_manual" })
      .eq("id", operatorId);

    await supabase
      .from("identity_verifications")
      .update({ status: "requires_input" })
      .eq("stripe_session_id", session.id);

  } else if (event.type === "identity.verification_session.canceled") {
    await supabase
      .from("profiles")
      .update({ verification_status: "unverified" })
      .eq("id", operatorId);

    await supabase
      .from("identity_verifications")
      .update({ status: "canceled" })
      .eq("stripe_session_id", session.id);
  }

  return new Response("OK", { status: 200 });
});
