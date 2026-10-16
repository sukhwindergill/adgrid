// TV-style screen pairing. See _shared/screenPairing.ts for the flow.
//
//   POST { action: "create" }                         public  -> { code, device_secret, expires_at }
//   POST { action: "poll", code, device_secret }      public  -> { status: pending|expired|claimed, screen_token? }
//   POST { action: "claim", code, screen_id }         auth    -> { ok, screen_id, screen_name }
//
// pairing_codes is service-role only (RLS on, no policies), so every read
// and write goes through here.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rateLimited, rateLimitResponse, clientIp } from "../_shared/rateLimit.ts";
import {
  createPairing,
  pollPairing,
  claimPairing,
  type PairingStore,
  type PairingRow,
} from "../_shared/screenPairing.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Content-Type": "application/json",
};

const store: PairingStore = {
  async insertCode(row) {
    // Expired codes would otherwise sit on their primary key forever; clear
    // them on the way in so the code space keeps recycling.
    await supabase.from("pairing_codes").delete().lt("expires_at", new Date().toISOString());
    const { error } = await supabase.from("pairing_codes").insert(row);
    if (!error) return true;
    if (error.code === "23505") return false;
    throw new Error(error.message);
  },
  async getCode(code) {
    const { data, error } = await supabase
      .from("pairing_codes")
      .select("code, secret_hash, expires_at, claimed_screen_id, claimed_at")
      .eq("code", code)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as PairingRow | null;
  },
  async claimCode(code, screenId, userId, now) {
    const { data, error } = await supabase
      .from("pairing_codes")
      .update({ claimed_screen_id: screenId, claimed_by: userId, claimed_at: now.toISOString() })
      .eq("code", code)
      .is("claimed_screen_id", null)
      .gt("expires_at", now.toISOString())
      .select("code");
    if (error) throw new Error(error.message);
    return (data ?? []).length > 0;
  },
  async markDelivered(code, now) {
    await supabase
      .from("pairing_codes")
      .update({ delivered_at: now.toISOString() })
      .eq("code", code)
      .is("delivered_at", null);
  },
  async getScreen(screenId) {
    const { data } = await supabase
      .from("screens")
      .select("id, name, operator_id")
      .eq("id", screenId)
      .maybeSingle();
    return data;
  },
  async getScreenToken(screenId) {
    const { data } = await supabase
      .from("screens")
      .select("screen_token")
      .eq("id", screenId)
      .maybeSingle();
    return data?.screen_token ? String(data.screen_token) : null;
  },
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: CORS });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const now = new Date();
  const ip = clientIp(req);

  try {
    if (body.action === "create") {
      // Public: one venue with several screens behind one NAT is normal,
      // and an unattended display re-requests every 15 minutes, so the cap
      // is per-IP but generous. It's there to stop code-space flooding.
      if (await rateLimited(supabase, `screen-pairing:create:${ip}`, { limit: 20, windowSeconds: 600 })) {
        return rateLimitResponse(CORS);
      }
      const r = await createPairing(store, now);
      return json(r.status, r.body);
    }

    if (body.action === "poll") {
      // Displays poll every ~3s (20/min each); leave room for a handful of
      // screens per venue.
      if (await rateLimited(supabase, `screen-pairing:poll:${ip}`, { limit: 240, windowSeconds: 60 })) {
        return rateLimitResponse(CORS);
      }
      const r = await pollPairing(store, { code: body.code, device_secret: body.device_secret }, now);
      return json(r.status, r.body);
    }

    if (body.action === "claim") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return json(401, { error: "Unauthorized" });
      const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      if (authError || !user) return json(401, { error: "Unauthorized" });

      // Per-user cap so a signed-in account can't brute-force live codes
      // (31^6 ≈ 887M combinations, a few dozen live at once).
      if (await rateLimited(supabase, `screen-pairing:claim:${user.id}`, { limit: 20, windowSeconds: 600 })) {
        return rateLimitResponse(CORS);
      }
      const r = await claimPairing(store, { code: body.code, screen_id: body.screen_id, user_id: user.id }, now);
      return json(r.status, r.body);
    }

    return json(400, { error: "Unknown action" });
  } catch (e) {
    console.error("[screen-pairing]", e);
    return json(500, { error: "Pairing failed, try again" });
  }
});
