import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const FUNCTIONS_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
const OFFLINE_MINUTES = 60;
const IDLE_MINUTES = 5;

Deno.serve(async (_req: Request) => {
  const now = new Date();
  const offlineCutoff = new Date(now.getTime() - OFFLINE_MINUTES * 60 * 1000).toISOString();
  const idleCutoff = new Date(now.getTime() - IDLE_MINUTES * 60 * 1000).toISOString();

  const { data: screens } = await supabase
    .from("screens")
    .select("id, name, operator_id, last_seen, health_status")
    .not("last_seen", "is", null);

  if (!screens || screens.length === 0) {
    return new Response(JSON.stringify({ ok: true, checked: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const updates: { id: string; health_status: string; wasOnline: boolean }[] = [];

  for (const screen of screens) {
    const lastSeen = screen.last_seen as string;
    let newStatus: string;
    if (lastSeen < offlineCutoff) newStatus = "offline";
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
      await fetch(`${FUNCTIONS_URL}/send-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: screen.operator_id,
          type: "screen_offline",
          data: { screenName: screen.name },
        }),
      }).catch(e => console.error("Notification error:", e));
    }
  }

  return new Response(
    JSON.stringify({ ok: true, checked: screens.length, updated: updates.length }),
    { headers: { "Content-Type": "application/json" } },
  );
});
