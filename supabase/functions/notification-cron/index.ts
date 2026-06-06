import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const FUNCTIONS_URL = `${Deno.env.get("SUPABASE_URL")!}/functions/v1`;

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

Deno.serve(async (_req: Request) => {
  const today = new Date();
  const isMonday = today.getDay() === 1;

  // ── Low budget alerts (daily) ────────────────────────────────
  const { data: campaigns } = await supabase
    .from("bookings")
    .select("id, advertiser_id, advertiser_name, start_date, end_date, budget")
    .eq("status", "active");

  const lowBudgetCampaigns = (campaigns ?? []).filter((c) => {
    const start = new Date(c.start_date).getTime();
    const end = new Date(c.end_date).getTime();
    const now = today.getTime();
    const total = end - start;
    if (total <= 0) return false;
    return (now - start) / total >= 0.8;
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

      const { data: scans } = await supabase
        .from("scans")
        .select("id")
        .eq("advertiser_id", adv.id)
        .gte("scanned_at", new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString());

      const totalSpend = (advCampaigns ?? []).reduce(
        (s: number, c: { budget: number }) => s + (c.budget ?? 0), 0
      );

      await sendNotification(adv.id, "weekly_report", {
        totalScans: String((scans ?? []).length),
        activeCampaigns: String((advCampaigns ?? []).length),
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

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
