import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Called right after a password change (see AuthContext.updatePassword).
// supabase.auth.updateUser() only rotates the *current* browser's tokens --
// any other device/browser that was already signed in keeps a valid
// refresh token indefinitely. If an account was compromised, changing the
// password should kick every other session out immediately; that requires
// the admin API (service_role), which only an Edge Function can hold.

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
  if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });

  // Global scope revokes every refresh token for this user, including the
  // caller's own -- the client always follows this with its own local
  // signOut(), so that's expected, not a bug.
  const { error } = await supabase.auth.admin.signOut(user.id, "global");
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS });
  }

  await supabase.from("security_events").insert({
    event_type: "password_changed",
    email: user.email ?? null,
    user_id: user.id,
  });

  return new Response(JSON.stringify({ ok: true }), { headers: CORS });
});
