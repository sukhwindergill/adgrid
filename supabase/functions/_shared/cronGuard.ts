// Guards Edge Functions meant to be invoked only by Supabase's pg_cron
// scheduler (or another trusted internal caller), never by a public client.
// Without this, anyone who discovers the function URL can trigger bulk
// deletes / auto-approvals / notification sweeps on demand.
//
// Usage: set CRON_SECRET as a function secret, and configure the cron job
// to send it as `x-cron-secret`. Call requireCronSecret(req) first thing
// inside Deno.serve and return its response if non-null.

const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

export function requireCronSecret(req: Request): Response | null {
  if (!CRON_SECRET) {
    // Fail closed: an unset secret must never mean "open to the public".
    return new Response(JSON.stringify({ error: "Cron endpoint not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
  const provided = req.headers.get("x-cron-secret") ?? "";
  if (provided !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}
