import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rateLimited, rateLimitResponse } from "../_shared/rateLimit.ts";

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

  const { email, role, orgProfileId } = await req.json().catch(() => ({}));
  if (!email || !orgProfileId) return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: CORS });

  // Caller must be the org owner
  if (user.id !== orgProfileId) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: CORS });
  }

  // Mail-bombing / enumeration guard on the invite-send action.
  if (await rateLimited(supabase, `invite-team-member:${user.id}`, { limit: 20, windowSeconds: 3600 })) {
    return rateLimitResponse(CORS);
  }

  const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email);
  if (inviteError) {
    return new Response(JSON.stringify({ error: inviteError.message }), {
      status: 400, headers: CORS,
    });
  }

  const { error: memberError } = await supabase.from("team_members").insert({
    org_profile_id: orgProfileId,
    user_profile_id: inviteData.user.id,
    role: role ?? "viewer",
  });

  // The auth invite above already went out (or was a resend) even on
  // failure here -- report it so the caller doesn't believe the org
  // membership was created when it wasn't (e.g. this person is already
  // on the team and hit the org_profile_id/user_profile_id unique
  // constraint).
  if (memberError) {
    const alreadyMember = memberError.code === "23505";
    return new Response(
      JSON.stringify({ error: alreadyMember ? "This person is already on your team." : memberError.message }),
      { status: alreadyMember ? 409 : 500, headers: CORS },
    );
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: CORS,
  });
});
