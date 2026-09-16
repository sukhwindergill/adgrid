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

const FUNCTIONS_URL = `${Deno.env.get("SUPABASE_URL")!}/functions/v1`;

async function sendNotification(userId: string, type: string, data: Record<string, string>) {
  await fetch(`${FUNCTIONS_URL}/send-notification`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": Deno.env.get("INTERNAL_NOTIFICATION_SECRET") ?? "",
    },
    body: JSON.stringify({ userId, type, data }),
  }).catch(() => {});
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401, headers: CORS });
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return new Response("Unauthorized", { status: 401, headers: CORS });

  const { data: reviewer } = await supabase.from("profiles").select("is_platform_owner").eq("id", user.id).single();
  if (!reviewer?.is_platform_owner) {
    return new Response("Forbidden", { status: 403, headers: CORS });
  }

  if (await rateLimited(supabase, `manual-review-advertiser:${user.id}`, { limit: 60, windowSeconds: 3600 })) {
    return rateLimitResponse(CORS);
  }

  const { verificationId, decision, notes } = await req.json();
  if (!verificationId || !decision) {
    return new Response(JSON.stringify({ error: "Missing verificationId or decision" }), { status: 400, headers: CORS });
  }
  if (!["approved", "rejected"].includes(decision)) {
    return new Response(JSON.stringify({ error: "decision must be 'approved' or 'rejected'" }), { status: 400, headers: CORS });
  }

  const { data: verification, error: fetchError } = await supabase
    .from("advertiser_verifications")
    .select("id, profile_id, status")
    .eq("id", verificationId)
    .single();
  if (fetchError || !verification) {
    return new Response(JSON.stringify({ error: "Verification not found" }), { status: 404, headers: CORS });
  }
  if (verification.status !== "pending_manual") {
    return new Response(JSON.stringify({ error: "This verification has already been reviewed" }), { status: 409, headers: CORS });
  }

  const newStatus = decision === "approved" ? "verified" : "rejected";
  const { error: updateError } = await supabase
    .from("advertiser_verifications")
    .update({
      status: newStatus,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: decision === "rejected" ? (notes ?? null) : null,
    })
    .eq("id", verificationId);
  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), { status: 500, headers: CORS });
  }

  // Derive the profile flag from the advertiser's LATEST verification row,
  // not just this decision -- history is kept (a rejection doesn't overwrite
  // an earlier row, resubmission creates a new one), so reviewing an older
  // row must never clobber a newer row's outcome. Since the 409 guard above
  // only allows reviewing a row that was still pending_manual, the row just
  // updated is normally the latest one anyway; this query is the safe
  // general rule if that ever isn't true.
  const { data: latest, error: latestError } = await supabase
    .from("advertiser_verifications")
    .select("status")
    .eq("profile_id", verification.profile_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (latestError || !latest) {
    return new Response(JSON.stringify({ error: latestError?.message ?? "Could not determine latest verification" }), { status: 500, headers: CORS });
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ is_verified_advertiser: latest.status === "verified" })
    .eq("id", verification.profile_id);
  if (profileError) {
    return new Response(JSON.stringify({ error: profileError.message }), { status: 500, headers: CORS });
  }

  const appUrl = `${Deno.env.get("PUBLIC_APP_URL") ?? ""}/app/settings`;
  if (decision === "approved") {
    await sendNotification(verification.profile_id, "advertiser_verification_approved", { appUrl });
  } else {
    await sendNotification(verification.profile_id, "advertiser_verification_rejected", { appUrl, reason: notes ?? "" });
  }

  return new Response(JSON.stringify({ ok: true }), { headers: CORS });
});
