// Fixed-window rate limiting backed by the `check_rate_limit` Postgres
// function (see migrations/20260901180000_rate_limits.sql). Atomic across
// concurrent Edge Function invocations since the increment happens in a
// single UPSERT, unlike an in-memory counter which resets per-instance and
// can't be trusted across Deno's distributed edge runtime.
//
// Usage: call rateLimited(supabase, key, opts) right after auth (key it on
// user.id) or right after parsing the identifying param for public routes
// (key it on IP or the token/screen_token itself). Return 429 if it's true.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface RateLimitOpts {
  limit: number;
  windowSeconds: number;
}

export async function rateLimited(
  supabase: SupabaseClient,
  key: string,
  opts: RateLimitOpts,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_key: key,
    p_limit: opts.limit,
    p_window_seconds: opts.windowSeconds,
  });
  if (error) {
    // Fail open on infra error -- a broken limiter must not take down the
    // whole endpoint, but log it since it means the limiter is blind.
    console.error(`[rateLimit] check_rate_limit failed for key=${key}:`, error.message);
    return false;
  }
  return data === false;
}

// Best-effort caller IP for unauthenticated routes. Supabase Edge Functions
// run behind a proxy that sets x-forwarded-for; unset locally/in tests.
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "unknown";
}

export function rateLimitResponse(cors: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: "Too many requests" }), {
    status: 429,
    headers: cors,
  });
}
