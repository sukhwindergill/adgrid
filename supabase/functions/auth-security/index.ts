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
//   check_lockout -> { locked: boolean }, true once 5 failures for this
//                     email land within 15m
//   sign_in       -> { session } | { error }. Verifies the password itself
//                     via a request-scoped anon-key client and logs
//                     login_failed/login_success from that real outcome --
//                     see the security-audit comment below on why a
//                     client-reported outcome can no longer be trusted.
//   request_reset -> { ok: true } | { error }. Same pattern: this function
//                     itself calls resetPasswordForEmail and only logs
//                     password_reset_requested when that call actually
//                     fired, instead of trusting a client-reported "I sent
//                     one" after the fact.

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Security-audit finding: sign_in and request_reset both need to make a
// real GoTrue call (signInWithPassword / resetPasswordForEmail) themselves,
// not just log a client-reported outcome -- see the removed
// record_login_failure/record_reset_request actions below. A dedicated
// anon-key client (not the service-role one above) makes those calls with
// no elevated privilege, exactly as a browser client would; persistence is
// off since this runs in a stateless edge function, not a browser.
const anonSupabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Content-Type": "application/json",
};

const LOGIN_FAILURE_LIMIT = 5;
const LOGIN_WINDOW_MINUTES = 15;
const RESET_LIMIT = 3;
const RESET_WINDOW_MINUTES = 60;
const LOCKED_MESSAGE = "Too many failed attempts. Try again in 15 minutes.";

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
  // sweep thousands of different emails from one IP with no per-email
  // signal ever tripping. Outer per-IP guard closes that.
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

    // Security-audit finding: this used to be two client-driven calls --
    // check_lockout, then (after the client itself called
    // supabase.auth.signInWithPassword) a separate record_login_failure or
    // record_login_success POST reporting what happened. Nothing tied that
    // report to a real GoTrue result: any unauthenticated caller could POST
    // record_login_failure directly for an email it never held a password
    // for. Five such POSTs tripped check_lockout's threshold and blocked
    // that victim's own real sign-in attempts for 15 minutes -- an
    // indefinitely repeatable account-lockout griefing vector needing no
    // credential at all.
    //
    // Fix: this function now performs the sign-in itself (via the anon
    // client above) and logs strictly from what GoTrue actually returned.
    // A failure can only be recorded when GoTrue itself rejected that
    // email/password pair.
    case "sign_in": {
      const password = body.password;
      if (typeof password !== "string" || !password) {
        return new Response(JSON.stringify({ error: { message: "Password required" } }), { status: 400, headers: CORS });
      }

      const failures = await countRecentEvents(email, "login_failed", LOGIN_WINDOW_MINUTES);
      if (failures >= LOGIN_FAILURE_LIMIT) {
        return new Response(JSON.stringify({ error: { message: LOCKED_MESSAGE } }), { headers: CORS });
      }

      const { data, error } = await anonSupabase.auth.signInWithPassword({ email, password });
      if (error) {
        await logEvent("login_failed", email);
        return new Response(JSON.stringify({ error: { message: error.message } }), { headers: CORS });
      }

      await logEvent("login_success", email);
      return new Response(JSON.stringify({ session: data.session }), { headers: CORS });
    }

    // Same shape of fix as sign_in: request_reset now fires
    // resetPasswordForEmail itself and only logs a throttle-counted event
    // when that call actually happened, instead of trusting a client
    // report an attacker could send without ever triggering a real reset
    // email -- which would have let anyone lock a victim out of
    // *requesting* their own password reset for an hour at a time.
    case "request_reset": {
      const recent = await countRecentEvents(email, "password_reset_requested", RESET_WINDOW_MINUTES);
      if (recent >= RESET_LIMIT) {
        // Same shape as a normal success -- must not reveal that
        // throttling kicked in, or that becomes its own enumeration/
        // probing signal.
        return new Response(JSON.stringify({ ok: true }), { headers: CORS });
      }

      const { error } = await anonSupabase.auth.resetPasswordForEmail(email, {
        redirectTo: Deno.env.get("PUBLIC_APP_URL") ?? undefined,
      });
      if (error) {
        return new Response(JSON.stringify({ error: { message: error.message } }), { headers: CORS });
      }

      await logEvent("password_reset_requested", email);
      return new Response(JSON.stringify({ ok: true }), { headers: CORS });
    }

    default:
      return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: CORS });
  }
});
