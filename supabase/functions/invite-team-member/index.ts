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

  const { email, role, orgProfileId } = await req.json();
  if (!email || !orgProfileId) return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: CORS });

  // Caller must be the org owner
  if (user.id !== orgProfileId) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: CORS });
  }

  const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email);
  if (inviteError) {
    return new Response(JSON.stringify({ error: inviteError.message }), {
      status: 400, headers: CORS,
    });
  }

  await supabase.from("team_members").insert({
    org_profile_id: orgProfileId,
    user_profile_id: inviteData.user.id,
    role: role ?? "viewer",
  });

  return new Response(JSON.stringify({ ok: true }), {
    headers: CORS,
  });
});
