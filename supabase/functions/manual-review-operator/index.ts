import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  // Only platform owners can perform manual reviews
  const { data: reviewer } = await supabase
    .from("profiles")
    .select("is_platform_owner")
    .eq("id", user.id)
    .single();

  if (!reviewer?.is_platform_owner) {
    return new Response("Forbidden", { status: 403 });
  }

  const { operatorId, decision, notes } = await req.json();
  if (!operatorId || !decision) {
    return new Response(JSON.stringify({ error: "Missing operatorId or decision" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!["approved", "rejected"].includes(decision)) {
    return new Response(JSON.stringify({ error: "decision must be 'approved' or 'rejected'" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const newStatus = decision === "approved" ? "verified" : "rejected";

  const profileUpdate: Record<string, unknown> = { verification_status: newStatus };
  if (decision === "approved") profileUpdate.verified_at = new Date().toISOString();
  if (decision === "rejected") profileUpdate.verification_rejection_reason = notes ?? null;

  const { error: profileError } = await supabase
    .from("profiles")
    .update(profileUpdate)
    .eq("id", operatorId);

  if (profileError) {
    return new Response(JSON.stringify({ error: profileError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Update the most recent pending identity_verification record
  await supabase
    .from("identity_verifications")
    .update({
      status: decision === "approved" ? "verified" : "rejected",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      notes: notes ?? null,
    })
    .eq("operator_id", operatorId)
    .in("status", ["pending", "requires_input"])
    .order("created_at", { ascending: false })
    .limit(1);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
