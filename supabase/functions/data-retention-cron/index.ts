import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Enforces the retention windows promised in the Privacy Policy
// (src/views/legal/PrivacyPolicy.jsx, "Data retention" section):
// screen telemetry/heartbeats 12 months, QR scan events 24 months.
// Without this job those tables grew forever despite the policy promising deletion.

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const TELEMETRY_RETENTION_DAYS = 365;
const SCAN_RETENTION_DAYS = 730;

function cutoffIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

Deno.serve(async (_req: Request) => {
  const telemetryCutoff = cutoffIso(TELEMETRY_RETENTION_DAYS);
  const scanCutoff = cutoffIso(SCAN_RETENTION_DAYS);

  const { error: heartbeatErr, count: heartbeatCount } = await supabase
    .from("display_heartbeats")
    .delete({ count: "exact" })
    .lt("created_at", telemetryCutoff);

  const { error: impressionErr, count: impressionCount } = await supabase
    .from("impression_events")
    .delete({ count: "exact" })
    .lt("created_at", telemetryCutoff);

  const { error: scanErr, count: scanCount } = await supabase
    .from("scans")
    .delete({ count: "exact" })
    .lt("scanned_at", scanCutoff);

  return new Response(
    JSON.stringify({
      ok: !heartbeatErr && !impressionErr && !scanErr,
      deleted: {
        display_heartbeats: heartbeatCount ?? 0,
        impression_events: impressionCount ?? 0,
        scans: scanCount ?? 0,
      },
      errors: {
        display_heartbeats: heartbeatErr?.message ?? null,
        impression_events: impressionErr?.message ?? null,
        scans: scanErr?.message ?? null,
      },
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
