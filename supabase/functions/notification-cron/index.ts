import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const FUNCTIONS_URL = `${Deno.env.get("SUPABASE_URL")!}/functions/v1`;

async function sendExpoPushToOperator(
  supabaseClient: ReturnType<typeof createClient>,
  operatorId: string,
  title: string,
  body: string,
  data: Record<string, string> = {}
): Promise<void> {
  const { data: tokens } = await supabaseClient
    .from("push_tokens")
    .select("expo_token")
    .eq("operator_id", operatorId);

  if (!tokens || tokens.length === 0) return;

  const messages = tokens.map(({ expo_token }: { expo_token: string }) => ({
    to: expo_token,
    sound: "default",
    title,
    body,
    data,
  }));

  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(messages),
  });
}

async function sendNotification(userId: string, type: string, data: Record<string, string>) {
  await fetch(`${FUNCTIONS_URL}/send-notification`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": Deno.env.get("INTERNAL_NOTIFICATION_SECRET") ?? "",
    },
    body: JSON.stringify({ userId, type, data }),
  });
}

Deno.serve(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const pendingOnly = body?.mode === "pending_only";

  const today = new Date();
  const isMonday = today.getDay() === 1;

  if (!pendingOnly) {
  // ── Low budget alerts (daily) ────────────────────────────────
  const { data: campaigns } = await supabase
    .from("bookings")
    .select("id, advertiser_id, advertiser_name, budget, spent")
    .eq("status", "active");

  const lowBudgetCampaigns = (campaigns ?? []).filter((c) => {
    if (!c.budget || c.budget <= 0) return false;
    return (c.spent ?? 0) / c.budget >= 0.8;
  });

  for (const c of lowBudgetCampaigns) {
    const todayStr = today.toISOString().slice(0, 10);
    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", c.advertiser_id)
      .eq("type", "low_budget")
      .gte("created_at", `${todayStr}T00:00:00Z`)
      .maybeSingle();

    if (!existing) {
      await sendNotification(c.advertiser_id, "low_budget", {
        campaignName: c.advertiser_name ?? "",
        appUrl: "",
      });
    }
  }

  // ── Weekly reports (Mondays only) ───────────────────────────
  if (isMonday) {
    const { data: advertisers } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "advertiser");

    for (const adv of advertisers ?? []) {
      const { data: advCampaigns } = await supabase
        .from("bookings")
        .select("id, status, budget")
        .eq("advertiser_id", adv.id)
        .eq("status", "active");

      // Skip advertisers with no active campaigns — nothing useful to report
      if (!advCampaigns || advCampaigns.length === 0) continue;

      const { data: scans } = await supabase
        .from("scans")
        .select("id")
        .eq("advertiser_id", adv.id)
        .gte("scanned_at", new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString());

      const totalSpend = advCampaigns.reduce(
        (s: number, c: { budget: number }) => s + (c.budget ?? 0), 0
      );

      await sendNotification(adv.id, "weekly_report", {
        totalScans: String((scans ?? []).length),
        activeCampaigns: String(advCampaigns.length),
        totalSpend: totalSpend.toFixed(2),
        appUrl: "",
      });
    }

    const { data: operators } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "operator");

    for (const op of operators ?? []) {
      const { data: opScreens } = await supabase
        .from("screens")
        .select("id")
        .eq("operator_id", op.id);

      const screenIds = (opScreens ?? []).map((s: { id: string }) => s.id);
      let revenue = 0;

      if (screenIds.length > 0) {
        const { data: csRows } = await supabase
          .from("campaign_screens")
          .select("campaign_id")
          .in("screen_id", screenIds)
          .in("status", ["approved", "auto_approved"]);
        const campaignIds = (csRows ?? []).map((r: { campaign_id: string }) => r.campaign_id);
        if (campaignIds.length > 0) {
          const { data: opCampaigns } = await supabase
            .from("bookings")
            .select("budget")
            .in("id", campaignIds)
            .eq("status", "active");
          revenue = (opCampaigns ?? []).reduce(
            (s: number, c: { budget: number }) => s + (c.budget ?? 0), 0
          ) * 0.4;
        }
      }

      await sendNotification(op.id, "weekly_revenue", {
        revenue: revenue.toFixed(2),
        screenCount: String((opScreens ?? []).length),
        appUrl: "",
      });
    }
  }
  } // end !pendingOnly

  // ── Pending approval push notifications ─────────────────────
  // Find campaign_screens that became pending in the last 2 minutes
  // (cron runs every minute; 2-minute window avoids missing rows on slow runs)
  const twoMinutesAgo = new Date(today.getTime() - 2 * 60 * 1000).toISOString();

  const { data: pendingScreens } = await supabase
    .from("campaign_screens")
    .select("screen_id")
    .eq("status", "pending")
    .gte("updated_at", twoMinutesAgo);

  for (const ps of pendingScreens ?? []) {
    try {
      const { data: screenData } = await supabase
        .from("screens")
        .select("operator_id, name")
        .eq("id", ps.screen_id)
        .single();

      if (screenData) {
        await sendExpoPushToOperator(
          supabase,
          screenData.operator_id,
          "New ad awaiting approval",
          `An ad is waiting for your review on ${screenData.name}`,
          { screen: "approvals" }
        );
      }
    } catch (_err) {
      // Non-blocking: push failure should not stop the cron job
    }
  }

  // ── Stale heartbeat alerts (screens silent > 30 min) ────────
  if (!pendingOnly) {
  const staleThreshold = new Date(today.getTime() - 30 * 60 * 1000);

  const { data: screens } = await supabase
    .from("screens")
    .select("id, name, operator_id")
    .neq("status", "pending");

  for (const screen of screens ?? []) {
    const { data: lastBeat } = await supabase
      .from("display_heartbeats")
      .select("created_at")
      .eq("screen_id", screen.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lastBeat || new Date(lastBeat.created_at) >= staleThreshold) continue;

    const minutesSilent = Math.round((today.getTime() - new Date(lastBeat.created_at).getTime()) / 60000);
    const todayStr = today.toISOString().slice(0, 10);
    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", screen.operator_id)
      .eq("type", "screen_offline")
      .gte("created_at", `${todayStr}T00:00:00Z`)
      .maybeSingle();

    if (!existing) {
      await sendNotification(screen.operator_id, "screen_offline", {
        screenName: screen.name ?? "",
        minutes: String(minutesSilent),
        appUrl: "",
      });
    }
  }
  } // end !pendingOnly

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
