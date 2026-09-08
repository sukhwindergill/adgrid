// REST campaign API key authentication (Competitive Parity Program, Phase
// 6, G21 REST API half -- see docs/superpowers/specs/2026-09-08-rest-
// campaign-api-design.md). Every api-campaigns endpoint calls this first:
//
//   const auth = await authenticateApiKey(supabase, req);
//   if (auth instanceof Response) return auth;
//   // auth.advertiserId is now trusted
//
// so the 401 error shape is decided once, not duplicated per endpoint.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hashApiKey } from "./apiKeyHash.ts";

export interface ApiKeyAuthResult {
  advertiserId: string;
  keyId: string;
}

export interface ApiKeyRow {
  id: string;
  advertiser_id: string;
  revoked_at: string | null;
}

/** Pure: given the looked-up row (or null/undefined if no key matched the hash), decides the auth outcome. */
export function resolveApiKeyRow(row: ApiKeyRow | null | undefined): ApiKeyAuthResult | null {
  if (!row || row.revoked_at) return null;
  return { advertiserId: row.advertiser_id, keyId: row.id };
}

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "Invalid or missing API key" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

export async function authenticateApiKey(
  supabase: SupabaseClient,
  req: Request,
): Promise<ApiKeyAuthResult | Response> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const presentedKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!presentedKey) return unauthorized();

  const keyHash = await hashApiKey(presentedKey);
  const { data: row } = await supabase
    .from("api_keys")
    .select("id, advertiser_id, revoked_at")
    .eq("key_hash", keyHash)
    .maybeSingle();

  const resolved = resolveApiKeyRow(row);
  if (!resolved) return unauthorized();

  // Fire-and-forget -- must not delay the response on this write.
  supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", resolved.keyId).then(() => {});

  return resolved;
}
