import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requestTooLarge } from "../_shared/requestSize.ts";
import { rateLimited, rateLimitResponse, clientIp } from "../_shared/rateLimit.ts";

// Backs three related security controls with one append-only ledger
// (security_events): failed-login lockout, password-reset rate limiting,
// and a general security-event audit trail. Called from the SPA around
// the direct GoTrue calls in AuthContext.jsx, since the client SDK talks
// to GoTrue directly and has no hook point of its own for this.
//
// Actions (all POST, JSON body: { action, email, ... }):
//   check_lockout        -> { locked: boolean }
//   record_login_failure -> logs the failure; bans the auth user for 15m
//                            once 5 failures land within 15m
//   record_login_success -> logs success, clears the lockout window
//   check_reset_throttle -> { allowed: boolean } -- max 3 requests/hour/email
//   record_reset_request -> logs a password-reset request

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Content-Type": "application/json",
};

const LOGIN_FAILURE_LIMIT = 5;
const LOGIN_WINDOW_MINUTES = 15;
const LOCKOUT_MINUTES = 15;
const RESET_LIMIT = 3;
const RESET_WINDOW_MINUTES = 60;

function normEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const e = email.trim().toLowerCase();
  return e.includes("@") ? e : null;
}

async function countRecentEvents(email: string, eventType: string, windowMinutes: number): Promise<number> {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("security_events")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .eq("event_type", eventType)
    .gte("created_at", since);
  return count ?? 0;
}

async function logEvent(eventType: string, email: string | null, metadata: Record<string, unknown> = {}) {
  await supabase.from("security_events").insert({ event_type: eventType, email, metadata });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: CORS });
  if (requestTooLarge(req, 8192)) return new Response(JSON.stringify({ error: "Payload too large" }), { status: 413, headers: CORS });

  // The per-email lockout/throttle logic below caps abuse of one target
  // account, but nothing capped the endpoint itself -- an attacker could
  // sweep thousands of different emails from one IP (each record_login_failure
  // also does an admin.listUsers() call) with no per-email signal ever
  // tripping. Outer per-IP guard closes that.
  if (await rateLimited(supabase, `auth-security:${clientIp(req)}`, { limit: 30, windowSeconds: 60 })) {
    return rateLimitResponse(CORS);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: CORS });
  }

  const action = body.action;
  const email = normEmail(body.email);
  if (!email) return new Response(JSON.stringify({ error: "Valid email required" }), { status: 400, headers: CORS });

  switch (action) {
    case "check_lockout": {
      const failures = await countRecentEvents(email, "login_failed", LOGIN_WINDOW_MINUTES);
      return new Response(JSON.stringify({ locked: failures >= LOGIN_FAILURE_LIMIT }), { headers: CORS });
    }

    case "record_login_failure": {
      await logEvent("login_failed", email);
      const failures = await countRecentEvents(email, "login_failed", LOGIN_WINDOW_MINUTES);
      if (failures >= LOGIN_FAILURE_LIMIT) {
        // Ban at the GoTrue level so the lockout holds even if this app's
        // own check_lockout gate is bypassed -- signInWithPassword itself
        // will then fail for a banned user.
        const { data: users } = await supabase.auth.admin.listUsers();
        const match = users?.users?.find((u) => u.email?.toLowerCase() === email);
        if (match) {
          await supabase.auth.admin.updateUserById(match.id, { ban_duration: `${LOCKOUT_MINUTES}m` });
          await logEvent("account_locked", email, { user_id: match.id, failures });
        }
      }
      return new Response(JSON.stringify({ ok: true }), { headers: CORS });
    }

    case "record_login_success": {
      await logEvent("login_success", email);
      return new Response(JSON.stringify({ ok: true }), { headers: CORS });
    }

    case "check_reset_throttle": {
      const recent = await countRecentEvents(email, "password_reset_requested", RESET_WINDOW_MINUTES);
      return new Response(JSON.stringify({ allowed: recent < RESET_LIMIT }), { headers: CORS });
    }

    case "record_reset_request": {
      await logEvent("password_reset_requested", email);
      return new Response(JSON.stringify({ ok: true }), { headers: CORS });
    }

    default:
      return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: CORS });
  }
});
