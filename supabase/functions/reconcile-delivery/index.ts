import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { expectedPlays, reconciliationWindow } from "../_shared/deliveryExpectation.ts";
import { shortfallPct, dailyBudgetShare, creditAmount, SHORTFALL_THRESHOLD } from "../_shared/makegood.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const FUNCTIONS_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
const INTERNAL_SECRET = Deno.env.get("INTERNAL_NOTIFICATION_SECRET") ?? "";
const APP_URL = Deno.env.get("PUBLIC_APP_URL") ?? "";

// How far back to re-check. Covers a cron outage without rescanning history.
const LOOKBACK_DAYS = 7;

const CORS = { "Content-Type": "application/json" };

/** Today's date in a given IANA timezone, as YYYY-MM-DD. */
function todayInTz(tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
  }
}

function addDays(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function daysBetweenInclusive(start: string, end: string): number {
  const a = new Date(`${start}T00:00:00Z`).getTime();
  const b = new Date(`${end}T00:00:00Z`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

async function notify(userId: string, type: string, data: Record<string, string>) {
  if (!userId) return;
  await fetch(`${FUNCTIONS_URL}/send-notification`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-secret": INTERNAL_SECRET },
    body: JSON.stringify({ userId, type, data }),
  }).catch(() => {});
}

Deno.serve(async (_req: Request) => {
  // Only paid campaigns can be credited — there is nothing to give back on an
  // unpaid one.
  const { data: campaigns } = await supabase
    .from("bookings")
    .select("id, advertiser_id, billed_to_profile_id, campaign_name, advertiser_name, budget, currency, start_date, end_date, schedule_days, time_start, time_end, duration, slots, status, payment_status")
    .eq("payment_status", "paid")
    .in("status", ["scheduled", "active", "completed"]);

  if (!campaigns || campaigns.length === 0) {
    return new Response(JSON.stringify({ ok: true, campaigns: 0, rows: 0, credited: 0 }), { headers: CORS });
  }

  let rowsWritten = 0;
  let creditsIssued = 0;

  for (const campaign of campaigns) {
    // Only screens that were actually cleared to play can under-deliver.
    const { data: campaignScreens } = await supabase
      .from("campaign_screens")
      .select("screen_id, status")
      .eq("campaign_id", campaign.id)
      .in("status", ["approved", "auto_approved"]);

    const screenIds = (campaignScreens ?? []).map(cs => cs.screen_id as string);
    if (screenIds.length === 0) continue;

    const { data: screens } = await supabase
      .from("screens")
      .select("id, name, operator_id, timezone, operating_hours_start, operating_hours_end")
      .in("id", screenIds);

    if (!screens || screens.length === 0) continue;

    const flightDays = daysBetweenInclusive(campaign.start_date as string, campaign.end_date as string);
    const screenDayBudget = dailyBudgetShare(campaign.budget as number, flightDays, screens.length);
    const billedTo = (campaign.billed_to_profile_id ?? campaign.advertiser_id) as string;
    const campaignLabel = (campaign.campaign_name ?? campaign.advertiser_name ?? campaign.id) as string;

    for (const screen of screens) {
      const tz = (screen.timezone as string) ?? "UTC";
      const today = todayInTz(tz);

      // Closed days only: strictly before today in the screen's timezone.
      // See reconciliationWindow's tests for the boundary cases.
      const { firstDay, lastDay, hasWork } = reconciliationWindow(
        campaign as { start_date: string | null; end_date: string | null },
        today,
        LOOKBACK_DAYS,
      );
      if (!hasWork) continue;

      const { data: delivered } = await supabase
        .from("campaign_delivery_daily")
        .select("day, plays")
        .eq("campaign_id", campaign.id)
        .eq("screen_id", screen.id)
        .gte("day", firstDay)
        .lte("day", lastDay);

      const deliveredByDay = new Map<string, number>();
      for (const row of delivered ?? []) {
        deliveredByDay.set(row.day as string, Number(row.plays) || 0);
      }

      for (let day = firstDay; day <= lastDay; day = addDays(day, 1)) {
        const expectation = expectedPlays(campaign, screen, day);
        if (!expectation.scheduled) continue; // nothing owed on an unscheduled day

        const deliveredPlays = deliveredByDay.get(day) ?? 0;
        const shortfall = shortfallPct(deliveredPlays, expectation.expectedPlays);
        const credit = creditAmount(shortfall, screenDayBudget);

        // Attribute the cause. A screen with no heartbeat at all that day was
        // dark; anything else is under-delivery we cannot blame on downtime.
        let reason = "met";
        if (shortfall >= SHORTFALL_THRESHOLD) {
          const { count: heartbeats } = await supabase
            .from("display_heartbeats")
            .select("id", { count: "exact", head: true })
            .eq("screen_id", screen.id)
            .gte("created_at", `${day}T00:00:00Z`)
            .lt("created_at", `${addDays(day, 1)}T00:00:00Z`);
          reason = (heartbeats ?? 0) === 0 ? "screen_offline" : "underdelivered";
        }

        // Upsert the reconciliation row. Never touch credited_at here — credit
        // issuance below owns it, so a recompute cannot double-credit.
        const { data: existing } = await supabase
          .from("delivery_reconciliation")
          .select("id, credited_at")
          .eq("campaign_id", campaign.id)
          .eq("screen_id", screen.id)
          .eq("day", day)
          .maybeSingle();

        const row = {
          campaign_id: campaign.id,
          screen_id: screen.id,
          day,
          expected_plays: expectation.expectedPlays,
          delivered_plays: deliveredPlays,
          shortfall_pct: shortfall,
          screen_day_budget: screenDayBudget,
          credit_amount: credit,
          currency: campaign.currency,
          reason,
          credited_to: credit > 0 ? billedTo : null,
        };

        if (existing) {
          await supabase.from("delivery_reconciliation").update(row).eq("id", existing.id);
        } else {
          await supabase.from("delivery_reconciliation").insert(row);
        }
        rowsWritten++;

        // Issue the credit exactly once per reconciliation row.
        if (credit > 0 && !existing?.credited_at) {
          const { data: profile } = await supabase
            .from("profiles").select("credits").eq("id", billedTo).single();

          const newBalance = Number(profile?.credits ?? 0) + credit;
          const { error: creditError } = await supabase
            .from("profiles").update({ credits: newBalance }).eq("id", billedTo);

          if (!creditError) {
            await supabase
              .from("delivery_reconciliation")
              .update({ credited_at: new Date().toISOString() })
              .eq("campaign_id", campaign.id)
              .eq("screen_id", screen.id)
              .eq("day", day);
            creditsIssued++;

            await notify(billedTo, "delivery_shortfall_credited", {
              campaignName: campaignLabel,
              day,
              creditAmount: `${credit.toFixed(2)} ${String(campaign.currency ?? "CAD").toUpperCase()}`,
              deliveredPlays: String(deliveredPlays),
              expectedPlays: String(expectation.expectedPlays),
              appUrl: APP_URL,
            });

            if (reason === "screen_offline" && screen.operator_id) {
              await notify(screen.operator_id as string, "screen_downtime_attributed", {
                screenName: (screen.name as string) ?? screen.id,
                day,
                missedPlays: String(expectation.expectedPlays - deliveredPlays),
                deliveredPlays: String(deliveredPlays),
                expectedPlays: String(expectation.expectedPlays),
                appUrl: APP_URL,
              });
            }
          }
        }
      }
    }
  }

  return new Response(
    JSON.stringify({ ok: true, campaigns: campaigns.length, rows: rowsWritten, credited: creditsIssued }),
    { headers: CORS },
  );
});
