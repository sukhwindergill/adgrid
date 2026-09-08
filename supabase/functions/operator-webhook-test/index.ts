// "Send test event" for the operator webhook integration
// (docs/superpowers/specs/2026-09-08-operator-webhook-integration-design.md).
// Unlike the fire-and-forget dispatch from send-notification, this call is
// synchronous so IntegrationsView.jsx can show success/failure immediately
// -- it fires the same screen_registered payload shape and signing logic
// as fireOperatorWebhook, but reports the delivery outcome back to the
// caller instead of swallowing it.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rateLimited, rateLimitResponse } from "../_shared/rateLimit.ts";
import { buildWebhookBody, signWebhookBody } from "../_shared/operatorWebhook.ts";

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
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401, headers: CORS });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return new Response("Unauthorized", { status: 401, headers: CORS });

  if (await rateLimited(supabase, `operator-webhook-test:${user.id}`, { limit: 10, windowSeconds: 60 })) {
    return rateLimitResponse(CORS);
  }

  const { data: hook } = await supabase
    .from("operator_webhooks")
    .select("webhook_url, secret")
    .eq("operator_id", user.id)
    .maybeSingle();

  if (!hook) {
    return new Response(JSON.stringify({ ok: false, error: "No webhook configured" }), { status: 400, headers: CORS });
  }

  const body = buildWebhookBody("screen_registered", { test: true, message: "AdGrid test event" });
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (hook.secret) {
    headers["X-AdGrid-Signature"] = await signWebhookBody(hook.secret, body);
  }

  try {
    const res = await fetch(hook.webhook_url, { method: "POST", headers, body });
    return new Response(JSON.stringify({ ok: res.ok, status: res.status }), { headers: CORS });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "Delivery failed" }),
      { headers: CORS },
    );
  }
});
