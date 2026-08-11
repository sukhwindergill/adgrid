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

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return new Response("Unauthorized", { status: 401, headers: CORS });

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_platform_owner")
    .eq("id", user.id)
    .single();

  if (!profile?.is_platform_owner) {
    return new Response("Forbidden", { status: 403, headers: CORS });
  }

  const { email } = await req.json();
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return new Response(JSON.stringify({ error: "Invalid email" }), { status: 400, headers: CORS });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const alreadyExists = existingUsers?.users?.some(
    (u) => u.email?.toLowerCase() === normalizedEmail,
  );
  if (alreadyExists) {
    return new Response(
      JSON.stringify({ error: "A user with this email already exists." }),
      { status: 409, headers: CORS },
    );
  }

  await supabase
    .from("operator_invites")
    .update({ status: "expired" })
    .eq("email", normalizedEmail)
    .eq("status", "pending");

  const { data: invite, error: insertError } = await supabase
    .from("operator_invites")
    .insert({ email: normalizedEmail, invited_by: user.id })
    .select("token")
    .single();

  if (insertError || !invite) {
    return new Response(
      JSON.stringify({ error: insertError?.message ?? "Failed to create invite" }),
      { status: 500, headers: CORS },
    );
  }

  const appUrl = Deno.env.get("APP_URL") ?? "http://localhost:5173";
  const inviteUrl = `${appUrl}/invite/${invite.token}`;

  await supabase.auth.admin.inviteUserByEmail(normalizedEmail, {
    redirectTo: inviteUrl,
    data: { invite_token: invite.token, role: "operator" },
  });

  return new Response(JSON.stringify({ ok: true, inviteUrl }), { headers: CORS });
});
