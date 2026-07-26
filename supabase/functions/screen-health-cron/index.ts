import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const FUNCTIONS_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
const INTERNAL_SECRET = Deno.env.get("INTERNAL_NOTIFICATION_SECRET") ?? "";
const APP_URL = Deno.env.get("PUBLIC_APP_URL") ?? "";
const OFFLINE_MINUTES = 60;
const IDLE_MINUTES = 5;

Deno.serve(async (_req: Request) => {
  const now = new Date();
  const offlineCutoff = new Date(now.getTime() - OFFLINE_MINUTES * 60 * 1000).toISOString();
  const idleCutoff = new Date(now.getTime() - IDLE_MINUTES * 60 * 1000).toISOString();

  const { data: screens } = await supabase
    .from("screens")
    .select("id, name, operator_id, last_seen, health_status");
  // Screens that have NEVER connected are included on purpose. Filtering them
  // out left a screen with last_seen = NULL sitting on whatever health_status
  // it was seeded with — production had one reading "online" that had never
  // contacted the platform at all.

  if (!screens || screens.length === 0) {
    return new Response(JSON.stringify({ ok: true, checked: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const updates: { id: string; health_status: string; wasOnline: boolean }[] = [];

  for (const screen of screens) {
    const lastSeen = screen.last_seen as string | null;
    let newStatus: string;
    // A screen that has never checked in is offline, not online. Comparing a
    // null lastSeen against the cutoffs would yield false for every branch and
    // silently fall through to "online".
    if (!lastSeen) newStatus = "offline";
    else if (lastSeen < offlineCutoff) newStatus = "offline";
    else if (lastSeen < idleCutoff) newStatus = "idle";
    else newStatus = "online";

    if (newStatus !== screen.health_status) {
      updates.push({
        id: screen.id,
        health_status: newStatus,
        wasOnline: screen.health_status === "online" || screen.health_status === "idle",
      });
    }
  }

  for (const u of updates) {
    await supabase.from("screens").update({ health_status: u.health_status }).eq("id", u.id);

    if (u.health_status === "offline" && u.wasOnline) {
      const screen = screens.find(s => s.id === u.id);
      if (!screen?.operator_id) continue;
      const minutesSilent = screen.last_seen
        ? Math.round((now.getTime() - new Date(screen.last_seen as string).getTime()) / 60000)
        : OFFLINE_MINUTES;
      // send-notification requires the internal secret header (or a user JWT);
      // without it the call 401s and the alert is silently dropped.
      await fetch(`${FUNCTIONS_URL}/send-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": INTERNAL_SECRET,
        },
        body: JSON.stringify({
          userId: screen.operator_id,
          type: "screen_offline",
          data: { screenName: screen.name, minutes: String(minutesSilent), appUrl: APP_URL },
        }),
      }).catch(e => console.error("Notification error:", e));
    }
  }

  return new Response(
    JSON.stringify({ ok: true, checked: screens.length, updated: updates.length }),
    { headers: { "Content-Type": "application/json" } },
  );
});
