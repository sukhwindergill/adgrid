import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isBreached, hoursRemaining, policyApproves, shouldSweep } from "../_shared/approvalSla.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const FUNCTIONS_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
const INTERNAL_SECRET = Deno.env.get("INTERNAL_NOTIFICATION_SECRET") ?? "";
const APP_URL = Deno.env.get("PUBLIC_APP_URL") ?? "";
const WARN_AT_HOURS = 4;
const CORS = { "Content-Type": "application/json" };

async function notify(userId: string, type: string, data: Record<string, string>) {
  if (!userId) return;
  await fetch(`${FUNCTIONS_URL}/send-notification`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-secret": INTERNAL_SECRET },
    body: JSON.stringify({ userId, type, data }),
  }).catch(() => {});
}

Deno.serve(async (_req: Request) => {
  const now = new Date();

  const { data: pending } = await supabase
    .from("campaign_screens")
    .select("id, campaign_id, screen_id, status, review_due_at")
    .eq("status", "pending");
  // NOTE: campaign status is filtered per-row below via shouldSweep rather
  // than here, so the response can report how many rows were skipped for not
  // being in flight instead of silently omitting them.

  if (!pending || pending.length === 0) {
    return new Response(JSON.stringify({ ok: true, pending: 0, autoApproved: 0, expired: 0, warned: 0 }), { headers: CORS });
  }

  const campaignIds = [...new Set(pending.map(p => p.campaign_id as string))];
  const screenIds = [...new Set(pending.map(p => p.screen_id as string))];

  const { data: campaigns } = await supabase
    .from("bookings")
    .select("id, advertiser_id, billed_to_profile_id, campaign_name, advertiser_name, category, budget, currency, status, payment_status")
    .in("id", campaignIds);

  const { data: screens } = await supabase
    .from("screens")
    .select("id, name, operator_id, review_sla_hours")
    .in("id", screenIds);

  const campaignById = new Map((campaigns ?? []).map(c => [c.id as string, c]));
  const screenById = new Map((screens ?? []).map(s => [s.id as string, s]));

  const operatorIds = [...new Set((screens ?? []).map(s => s.operator_id as string).filter(Boolean))];
  const { data: policies } = operatorIds.length
    ? await supabase
        .from("operator_approval_rules")
        .select("operator_id, enabled, auto_approve_categories, min_completed_campaigns")
        .in("operator_id", operatorIds)
    : { data: [] as Record<string, unknown>[] };
  const policyByOperator = new Map((policies ?? []).map(p => [p.operator_id as string, p]));

  // Completed-campaign counts per advertiser, for the history requirement.
  const advertiserIds = [...new Set((campaigns ?? []).map(c => c.advertiser_id as string).filter(Boolean))];
  const completedByAdvertiser = new Map<string, number>();
  for (const advertiserId of advertiserIds) {
    const { count } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("advertiser_id", advertiserId)
      .eq("status", "completed");
    completedByAdvertiser.set(advertiserId, count ?? 0);
  }

  let autoApproved = 0;
  let expired = 0;
  let warned = 0;

  // ── Pass 1: apply auto-approve policies ──────────────────────────────────
  // Policies run BEFORE expiry so a row the operator would have auto-approved
  // is never dropped in the same sweep.
  const stillPending: typeof pending = [];

  let skippedNotInFlight = 0;

  for (const row of pending) {
    const campaign = campaignById.get(row.campaign_id as string);
    const screen = screenById.get(row.screen_id as string);
    if (!campaign || !screen) continue;

    // Only campaigns where approval still means something. See shouldSweep.
    if (!shouldSweep(campaign.status as string)) { skippedNotInFlight++; continue; }

    const policy = policyByOperator.get(screen.operator_id as string);
    const decision = policyApproves(policy as never, {
      category: campaign.category as string,
      completedCampaigns: completedByAdvertiser.get(campaign.advertiser_id as string) ?? 0,
    });

    if (decision.approved) {
      await supabase
        .from("campaign_screens")
        .update({ status: "auto_approved", approved_at: now.toISOString() })
        .eq("id", row.id);
      autoApproved++;
    } else {
      stillPending.push(row);
    }
  }

  // ── Pass 2: warn, then expire what is past due ───────────────────────────
  for (const row of stillPending) {
    const campaign = campaignById.get(row.campaign_id as string);
    const screen = screenById.get(row.screen_id as string);
    if (!campaign || !screen) continue;

    const slaHours = Number(screen.review_sla_hours) || 24;
    const dueAt = row.review_due_at as string | null;

    if (!isBreached(dueAt, now)) {
      // Nudge the operator as the deadline approaches.
      const left = hoursRemaining(dueAt, now);
      if (left !== null && left <= WARN_AT_HOURS && screen.operator_id) {
        await notify(screen.operator_id as string, "approval_sla_approaching", {
          campaignName: (campaign.campaign_name ?? campaign.advertiser_name ?? campaign.id) as string,
          screenName: (screen.name as string) ?? (screen.id as string),
          hoursLeft: String(left),
          appUrl: APP_URL,
        });
        warned++;
      }
      continue;
    }

    // Past due. Drop the screen so the campaign is not held hostage.
    await supabase
      .from("campaign_screens")
      .update({ status: "expired", expired_at: now.toISOString(), reject_reason: "Not reviewed within the operator's SLA" })
      .eq("id", row.id);
    expired++;

    // Credit the advertiser for this screen's share — only on a paid campaign,
    // and only via the credits ledger. There is no automated Stripe refund
    // path in this codebase (stripe-refund is retired), so do not attempt one.
    let creditLabel = "No charge";
    if (campaign.payment_status === "paid") {
      const { count: totalScreens } = await supabase
        .from("campaign_screens")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaign.id);

      const share = (totalScreens ?? 0) > 0 ? Number(campaign.budget) / (totalScreens as number) : 0;
      const credit = Math.round(share * 100) / 100;

      if (credit > 0) {
        const billedTo = (campaign.billed_to_profile_id ?? campaign.advertiser_id) as string;
        const { data: profile } = await supabase.from("profiles").select("credits").eq("id", billedTo).single();
        const newBalance = Number(profile?.credits ?? 0) + credit;
        const { error } = await supabase.from("profiles").update({ credits: newBalance }).eq("id", billedTo);
        if (!error) creditLabel = `${credit.toFixed(2)} ${String(campaign.currency ?? "CAD").toUpperCase()}`;
      }
    }

    await notify((campaign.billed_to_profile_id ?? campaign.advertiser_id) as string, "screen_dropped_sla", {
      campaignName: (campaign.campaign_name ?? campaign.advertiser_name ?? campaign.id) as string,
      screenName: (screen.name as string) ?? (screen.id as string),
      slaHours: String(slaHours),
      creditAmount: creditLabel,
      appUrl: APP_URL,
    });

    if (screen.operator_id) {
      await notify(screen.operator_id as string, "operator_missed_sla", {
        campaignName: (campaign.campaign_name ?? campaign.advertiser_name ?? campaign.id) as string,
        screenName: (screen.name as string) ?? (screen.id as string),
        slaHours: String(slaHours),
        appUrl: APP_URL,
      });
    }
  }

  return new Response(
    JSON.stringify({ ok: true, pending: pending.length, autoApproved, expired, warned, skippedNotInFlight }),
    { headers: CORS },
  );
});
