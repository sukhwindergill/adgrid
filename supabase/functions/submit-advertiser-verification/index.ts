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

function extractDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1 ? "" : email.slice(at + 1).trim().toLowerCase();
}

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401, headers: CORS });
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return new Response("Unauthorized", { status: 401, headers: CORS });

  const { data: profile } = await supabase.from("profiles").select("role, email").eq("id", user.id).single();
  if (profile?.role !== "advertiser") {
    return new Response(JSON.stringify({ error: "Only advertiser accounts can submit verification" }), { status: 403, headers: CORS });
  }

  if (await rateLimited(supabase, `submit-advertiser-verification:${user.id}`, { limit: 10, windowSeconds: 3600 })) {
    return rateLimitResponse(CORS);
  }

  const { companyName, businessNumber, businessDomain, docStoragePath } = await req.json();
  if (!companyName || typeof companyName !== "string" || !businessDomain || typeof businessDomain !== "string") {
    return new Response(JSON.stringify({ error: "companyName and businessDomain are required" }), { status: 400, headers: CORS });
  }

  const normalizedInputDomain = normalizeDomain(businessDomain);
  const accountDomain = extractDomain(profile?.email ?? "");
  const isDomainMatch = normalizedInputDomain.length > 0 && normalizedInputDomain === accountDomain;

  // Providing a document always routes to manual review, even on a domain
  // match -- a doc submission is explicitly the higher-trust tier per the
  // design spec, not a shortcut around it.
  const tier = isDomainMatch && !docStoragePath ? "domain_match" : "document_review";
  const status = tier === "domain_match" ? "verified" : "pending_manual";

  const { data: row, error: insertError } = await supabase
    .from("advertiser_verifications")
    .insert({
      profile_id: user.id,
      company_name: companyName,
      business_number: businessNumber ?? null,
      business_domain: normalizedInputDomain,
      doc_storage_path: docStoragePath ?? null,
      tier,
      status,
      reviewed_at: tier === "domain_match" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), { status: 500, headers: CORS });
  }

  if (tier === "domain_match") {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ is_verified_advertiser: true })
      .eq("id", user.id);
    if (profileError) {
      // The advertiser_verifications row above already committed as "verified",
      // but the profile flag failed to flip -- without a rollback this leaves an
      // orphaned verified row with no way for the advertiser to recover (a 500
      // gives no indication a row exists, and resubmitting would just create a
      // second row instead of fixing the first). Best-effort delete the row we
      // just inserted so a failed submission leaves no trace and can be cleanly
      // resubmitted. This is not a real transaction, just a compensating action,
      // matching how other edge functions in this codebase handle partial failure.
      await supabase.from("advertiser_verifications").delete().eq("id", row.id);
      return new Response(JSON.stringify({ error: profileError.message }), { status: 500, headers: CORS });
    }
  }

  return new Response(JSON.stringify({ ok: true, id: row.id, tier, status }), { headers: CORS });
});
