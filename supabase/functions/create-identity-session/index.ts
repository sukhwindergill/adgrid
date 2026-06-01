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
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401 });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return new Response("Unauthorized", { status: 401 });

  const { returnUrl } = await req.json();
  if (!returnUrl) return new Response("Missing returnUrl", { status: 400 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, verification_status, email, name")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "operator") {
    return new Response("Only operators can start identity verification", { status: 403 });
  }

  if (profile?.verification_status === "verified") {
    return new Response(
      JSON.stringify({ error: "Already verified" }),
      { status: 409, headers: { "Content-Type": "application/json" } },
    );
  }

  // Create Stripe Identity VerificationSession
  const session = await stripe.identity.verificationSessions.create({
    type: "document",
    metadata: { operator_id: user.id },
    options: {
      document: {
        allowed_types: ["driving_license", "passport", "id_card"],
        require_id_number: false,
        require_live_capture: true,
        require_matching_selfie: true,
      },
    },
    return_url: `${returnUrl}?identity=complete`,
  });

  // Record the attempt in identity_verifications
  await supabase.from("identity_verifications").insert({
    operator_id: user.id,
    verification_type: "stripe_identity",
    stripe_session_id: session.id,
    status: "pending",
  });

  // Update profile to pending_stripe
  await supabase
    .from("profiles")
    .update({
      verification_status: "pending_stripe",
      stripe_identity_session_id: session.id,
    })
    .eq("id", user.id);

  return new Response(
    JSON.stringify({ url: session.url, sessionId: session.id }),
    { headers: { "Content-Type": "application/json" } },
  );
});
