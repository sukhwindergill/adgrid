import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  const bearer = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(bearer);
  if (authError || !user) return new Response("Unauthorized", { status: 401, headers: CORS });

  const { token } = await req.json();
  if (!token || typeof token !== "string") {
    return new Response(JSON.stringify({ error: "invalid_token" }), { status: 400, headers: CORS });
  }

  const { data: invite, error: fetchError } = await supabase
    .from("operator_invites")
    .select("id, email, status, expires_at")
    .eq("token", token)
    .single();

  if (fetchError || !invite) {
    return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: CORS });
  }

  if (invite.status === "accepted") {
    return new Response(JSON.stringify({ error: "already_accepted" }), { status: 409, headers: CORS });
  }

  if (invite.status === "expired" || new Date(invite.expires_at) < new Date()) {
    return new Response(JSON.stringify({ error: "expired" }), { status: 410, headers: CORS });
  }

  if (invite.email.toLowerCase() !== (user.email ?? "").toLowerCase()) {
    return new Response(JSON.stringify({ error: "email_mismatch" }), { status: 403, headers: CORS });
  }

  const { error: roleError } = await supabase
    .from("profiles")
    .update({ role: "operator" })
    .eq("id", user.id);

  if (roleError) {
    return new Response(JSON.stringify({ error: roleError.message }), { status: 500, headers: CORS });
  }

  const { error: acceptError } = await supabase
    .from("operator_invites")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", invite.id);
  if (acceptError) {
    console.error(`Failed to mark invite ${invite.id} accepted after promoting user ${user.id}:`, acceptError.message);
  }

  return new Response(JSON.stringify({ ok: true }), { headers: CORS });
});
