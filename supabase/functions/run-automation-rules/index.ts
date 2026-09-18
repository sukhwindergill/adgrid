import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { evaluateRule, shouldNotify } from "../_shared/ruleEvaluator.ts";
import { flightProgress, pacingRatio } from "../_shared/pacing.ts";
import { requireCronSecret } from "../_shared/cronGuard.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const FUNCTIONS_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
const INTERNAL_SECRET = Deno.env.get("INTERNAL_NOTIFICATION_SECRET") ?? "";
const APP_URL = Deno.env.get("PUBLIC_APP_URL") ?? "";
const CORS = { "Content-Type": "application/json" };

// Which notification each metric sends when it fires with action = 'notify'.
const METRIC_NOTIFICATION: Record<string, string> = {
  offline_screen_minutes: "screen_offline_during_flight",
  pacing_ratio: "campaign_pacing_behind",
  cost_per_scan: "cost_per_scan_high",
  billable_scans: "cost_per_scan_high",
  plays: "cost_per_scan_high",
  delivery_pct: "campaign_pacing_behind",
};

async function notify(userId: string, type: string, data: Record<string, string>) {
  if (!userId) return;
  await fetch(`${FUNCTIONS_URL}/send-notification`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-secret": INTERNAL_SECRET },
    body: JSON.stringify({ userId, type, data }),
  }).catch(() => {});
}

interface SnapshotBundle {
  metrics: Record<string, number | null>;
  offlineScreenName: string;
  elapsedPct: number;
  spentPct: number;
}

Deno.serve(async (req: Request) => {
  const denied = requireCronSecret(req);
  if (denied) return denied;

  const now = new Date();

  const { data: rules } = await supabase
    .from("automation_rules")
    .select("id, owner_id, owner_side, name, metric, comparator, threshold, action, scope_campaign_id, enabled, last_fired_at")
    .eq("enabled", true);

  if (!rules || rules.length === 0) {
    return new Response(JSON.stringify({ ok: true, rules: 0, fired: 0 }), { headers: CORS });
  }

  // Every campaign currently in flight. A rule can only be about a live
  // campaign — alerting on a finished one is noise.
  const { data: campaigns } = await supabase
    .from("bookings")
    .select("id, advertiser_id, campaign_name, advertiser_name, budget, spent, currency, start_date, end_date, status")
    .in("status", ["scheduled", "active"]);

  const liveCampaigns = campaigns ?? [];
  let firedCount = 0;

  // Snapshot cache: one build per campaign, reused across that campaign's rules.
  const snapshots = new Map<string, SnapshotBundle>();

  async function snapshotFor(campaign: Record<string, unknown>): Promise<SnapshotBundle> {
    const id = campaign.id as string;
    const cached = snapshots.get(id);
    if (cached) return cached;

    const { data: delivery } = await supabase
      .from("campaign_delivery_daily")
      .select("plays, billable_scans")
      .eq("campaign_id", id);

    const plays = (delivery ?? []).reduce((a, r) => a + (Number(r.plays) || 0), 0);
    const billableScans = (delivery ?? []).reduce((a, r) => a + (Number(r.billable_scans) || 0), 0);

    const spent = Number(campaign.spent) || 0;
    const budget = Number(campaign.budget) || 0;
    const progress = flightProgress(campaign.start_date as string, campaign.end_date as string, now);

    // Longest current offline stretch across this campaign's booked screens.
    const { data: cs } = await supabase
      .from("campaign_screens")
      .select("screen_id")
      .eq("campaign_id", id)
      .in("status", ["approved", "auto_approved"]);

    let offlineMinutes: number | null = null;
    let offlineScreenName = "";
    const screenIds = (cs ?? []).map(r => r.screen_id as string);
    if (screenIds.length > 0) {
      const { data: screens } = await supabase
        .from("screens")
        .select("id, name, health_status, last_seen")
        .in("id", screenIds)
        .eq("health_status", "offline");

      for (const s of screens ?? []) {
        if (!s.last_seen) continue;
        const mins = Math.round((now.getTime() - new Date(s.last_seen as string).getTime()) / 60000);
        if (offlineMinutes === null || mins > offlineMinutes) {
          offlineMinutes = mins;
          offlineScreenName = (s.name as string) ?? (s.id as string);
        }
      }
      // No offline screen is a real measurement of zero, not missing data.
      if (offlineMinutes === null) offlineMinutes = 0;
    }

    const { data: healthRow } = await supabase
      .from("campaign_delivery_health")
      .select("delivery_pct")
      .eq("campaign_id", id)
      .maybeSingle();

    const bundle: SnapshotBundle = {
      metrics: {
        plays,
        billable_scans: billableScans,
        // Null, not Infinity, when there are no scans yet — a campaign with
        // zero scans on day one must not trip a cost-per-scan rule.
        cost_per_scan: billableScans > 0 ? spent / billableScans : null,
        pacing_ratio: pacingRatio(spent, budget, progress),
        offline_screen_minutes: offlineMinutes,
        delivery_pct: healthRow?.delivery_pct != null ? Number(healthRow.delivery_pct) : null,
      },
      offlineScreenName,
      elapsedPct: Math.round(progress * 100),
      spentPct: budget > 0 ? Math.round((spent / budget) * 100) : 0,
    };

    snapshots.set(id, bundle);
    return bundle;
  }

  // Security-audit finding: this used to trust rule.scope_campaign_id on
  // its own (`c.id === rule.scope_campaign_id`, no ownership check at
  // all) -- since RLS's own INSERT/UPDATE check on automation_rules only
  // verifies owner_id = auth.uid(), a rule scoped to ANY campaign in the
  // system, with a trivially-true condition, let any advertiser pause any
  // OTHER advertiser's live campaign on every cron run. Re-verify real
  // ownership here too (RLS now checks it at write time as well, but
  // service_role writes bypass RLS, and a row could predate that fix) --
  // an operator-owned rule needs a screen the campaign targets; an
  // advertiser-owned rule needs to be the campaign's own advertiser.
  const opScreensByOwner = new Map<string, Set<string>>();
  async function operatorScreenIds(operatorId: string): Promise<Set<string>> {
    const cached = opScreensByOwner.get(operatorId);
    if (cached) return cached;
    const { data } = await supabase.from("screens").select("id").eq("operator_id", operatorId);
    const ids = new Set((data ?? []).map(s => s.id as string));
    opScreensByOwner.set(operatorId, ids);
    return ids;
  }
  async function campaignOwnedByRule(campaign: Record<string, unknown>, rule: Record<string, unknown>): Promise<boolean> {
    if (rule.owner_side === "operator") {
      const { data: cs } = await supabase.from("campaign_screens").select("screen_id").eq("campaign_id", campaign.id as string);
      const screenIds = (cs ?? []).map(r => r.screen_id as string);
      if (screenIds.length === 0) return false;
      const owned = await operatorScreenIds(rule.owner_id as string);
      return screenIds.some(id => owned.has(id));
    }
    return campaign.advertiser_id === rule.owner_id;
  }

  for (const rule of rules) {
    // Which campaigns this rule covers.
    const candidateScope = rule.scope_campaign_id
      ? liveCampaigns.filter(c => c.id === rule.scope_campaign_id)
      : liveCampaigns.filter(c => c.advertiser_id === rule.owner_id);
    const scoped = [];
    for (const c of candidateScope) {
      if (await campaignOwnedByRule(c as Record<string, unknown>, rule as Record<string, unknown>)) scoped.push(c);
    }

    for (const campaign of scoped) {
      const snapshot = await snapshotFor(campaign as Record<string, unknown>);
      const result = evaluateRule(rule, snapshot.metrics);
      if (!result.fired) continue;
      if (!shouldNotify(rule, now)) continue;

      const campaignLabel = (campaign.campaign_name ?? campaign.advertiser_name ?? campaign.id) as string;
      const currency = String(campaign.currency ?? "CAD").toUpperCase();

      if (rule.action === "pause_campaign") {
        await supabase.from("bookings").update({ status: "paused" }).eq("id", campaign.id);
        await notify(rule.owner_id as string, "rule_paused_campaign", {
          campaignName: campaignLabel,
          ruleName: rule.name as string,
          metric: rule.metric as string,
          value: String(result.value),
          appUrl: APP_URL,
        });
      } else {
        const type = METRIC_NOTIFICATION[rule.metric as string] ?? "campaign_pacing_behind";
        await notify(rule.owner_id as string, type, {
          campaignName: campaignLabel,
          screenName: snapshot.offlineScreenName,
          offlineMinutes: String(snapshot.metrics.offline_screen_minutes ?? 0),
          spentPct: String(snapshot.spentPct),
          elapsedPct: String(snapshot.elapsedPct),
          costPerScan: `${Number(result.value ?? 0).toFixed(2)} ${currency}`,
          threshold: `${Number(rule.threshold).toFixed(2)} ${currency}`,
          appUrl: APP_URL,
        });
      }

      await supabase
        .from("automation_rules")
        .update({ last_fired_at: now.toISOString(), last_fired_value: result.value })
        .eq("id", rule.id);

      firedCount++;
      break; // one notification per rule per run, even across several campaigns
    }
  }

  return new Response(JSON.stringify({ ok: true, rules: rules.length, fired: firedCount }), { headers: CORS });
});
