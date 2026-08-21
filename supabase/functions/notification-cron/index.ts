import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireCronSecret } from "../_shared/cronGuard.ts";

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

// Marketplace: remind on bookings expiring within 3 days (once), and
// auto-rebook when both operator (listing.auto_renew) and advertiser
// (booking.advertiser_auto_renew) opted in. Never rebooks on one-sided
// consent — see 2026-08-21-marketplace-exclusivity-design.md §6.
async function runMarketplaceExpiryPass() {
  const todayDate = new Date().toISOString().slice(0, 10);

  const { data: expiring } = await supabase
    .from("marketplace_listings")
    .select("id, screen_id, operator_id, end_date, auto_renew, reminder_sent_at, marketplace_bookings(id, advertiser_id, advertiser_auto_renew, price_cents, status)")
    .eq("status", "booked")
    .gte("end_date", todayDate)
    .lte("end_date", new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
    .is("reminder_sent_at", null);

  for (const listing of expiring ?? []) {
    try {
      const booking = (listing.marketplace_bookings ?? []).find(
        (b: { status: string }) => b.status !== "cancelled"
      );
      if (!booking) continue;

      await sendNotification(booking.advertiser_id, "marketplace_booking_expiring", {
        listingId: listing.id,
      });
      await supabase
        .from("marketplace_listings")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", listing.id);

      if (listing.auto_renew && booking.advertiser_auto_renew) {
        // The exclusion constraint on marketplace_listings uses an inclusive
        // daterange ('[]') and covers 'draft'/'active'/'booked' rows, so the
        // old (still 'booked') listing's range [old_start, old_end] and a
        // naive new range [old_end, old_end+14] would share the day old_end
        // and collide. Transition the old listing out of the filtered
        // statuses AND start the new listing the day after old_end so the
        // two ranges never overlap under either condition alone.
        const start = new Date(new Date(listing.end_date).getTime() + 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);
        const durationDays = 14; // matches the original window length assumption; refined once real usage data exists
        const end = new Date(new Date(start).getTime() + durationDays * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);

        await supabase.from("marketplace_listings").update({ status: "expired" }).eq("id", listing.id);

        await supabase.from("marketplace_listings").insert({
          screen_id: listing.screen_id,
          operator_id: listing.operator_id,
          price_cents: booking.price_cents,
          start_date: start,
          end_date: end,
          status: "active",
          auto_renew: true,
        });
      }
    } catch (err) {
      // Non-blocking: one bad listing/booking row should not stop the cron
      // job, but the failure must be visible in cron logs rather than
      // vanishing silently (e.g. an exclusion-constraint violation on the
      // auto-renew insert would otherwise leave the advertiser believing a
      // renewal happened when it didn't).
      console.error(`runMarketplaceExpiryPass: failed for listing ${listing.id}`, err);
    }
  }
}

// Marketplace: listings that are still 'booked' but whose window has already
// ended (end_date < today) never got flipped to 'expired' by anything else —
// runMarketplaceExpiryPass only reminds/renews forward-looking windows. Sweep
// these past-due listings and their bookings to a terminal state so they
// stop showing up as "current" bookings/listings.
async function runMarketplacePastDueSweep() {
  const todayDate = new Date().toISOString().slice(0, 10);

  const { data: pastDue } = await supabase
    .from("marketplace_listings")
    .select("id, marketplace_bookings(id, status)")
    .eq("status", "booked")
    .lt("end_date", todayDate);

  for (const listing of pastDue ?? []) {
    try {
      const { error: listingErr } = await supabase
        .from("marketplace_listings")
        .update({ status: "expired" })
        .eq("id", listing.id);
      if (listingErr) {
        console.error(`runMarketplacePastDueSweep: failed to expire listing ${listing.id}`, listingErr);
        continue;
      }

      const bookings = (listing.marketplace_bookings ?? []).filter(
        (b: { status: string }) => b.status === "confirmed" || b.status === "active"
      );
      for (const booking of bookings) {
        const { error: bookingErr } = await supabase
          .from("marketplace_bookings")
          .update({ status: "completed" })
          .eq("id", booking.id);
        if (bookingErr) {
          console.error(`runMarketplacePastDueSweep: failed to complete booking ${booking.id}`, bookingErr);
        }
      }
    } catch (err) {
      console.error(`runMarketplacePastDueSweep: failed for listing ${listing.id}`, err);
    }
  }
}

Deno.serve(async (req: Request) => {
  const denied = requireCronSecret(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const pendingOnly = body?.mode === "pending_only";

  const today = new Date();
  const isMonday = today.getDay() === 1;

  if (!pendingOnly) {
  const todayDate = today.toISOString().slice(0, 10);
  const appUrl = Deno.env.get("PUBLIC_APP_URL") ?? "";

  // ── Campaign lifecycle transitions ──────────────────────────
  // scheduled → active: start_date has arrived, paid
  const { data: goingLive } = await supabase
    .from("bookings")
    .select("id, advertiser_id, advertiser_name")
    .eq("status", "scheduled")
    .eq("payment_status", "paid")
    .lte("start_date", todayDate);

  for (const c of goingLive ?? []) {
    await supabase.from("bookings").update({ status: "active" }).eq("id", c.id);
    await sendNotification(c.advertiser_id, "campaign_live", {
      campaignName: c.advertiser_name ?? "",
      screenName: "your screens",
      appUrl,
    });
  }

  // active → completed: end_date has passed
  const { data: ending } = await supabase
    .from("bookings")
    .select("id, advertiser_id, advertiser_name")
    .eq("status", "active")
    .lt("end_date", todayDate);

  for (const c of ending ?? []) {
    await supabase.from("bookings").update({ status: "completed" }).eq("id", c.id);
    await sendNotification(c.advertiser_id, "campaign_ended", {
      campaignName: c.advertiser_name ?? "",
      appUrl,
    });
  }

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
    const todayStr = todayDate;
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
        appUrl,
      });
    }
  }

  // ── Weekly reports (Mondays only) ───────────────────────────
  if (isMonday) {
    // Query by bookings.advertiser_id — catches all campaign runners regardless
    // of profile.role (operators who also run ads have role='operator' after
    // registering a screen, so filtering by role='advertiser' would miss them).
    const { data: activeCampaignRows } = await supabase
      .from("bookings")
      .select("advertiser_id")
      .eq("status", "active");

    const advertiserIds = [...new Set((activeCampaignRows ?? []).map((r: { advertiser_id: string }) => r.advertiser_id))];

    for (const advId of advertiserIds) {
      const { data: advCampaigns } = await supabase
        .from("bookings")
        .select("id, status, budget")
        .eq("advertiser_id", advId)
        .eq("status", "active");

      if (!advCampaigns || advCampaigns.length === 0) continue;

      // Billable scans only. Counting every row here would report more
      // "leads" than the dashboard shows for the same week, because the
      // dashboard excludes bots and duplicates.
      const { data: scans } = await supabase
        .from("scans")
        .select("id")
        .eq("advertiser_id", advId)
        .eq("is_bot", false)
        .eq("is_duplicate", false)
        .gte("scanned_at", new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString());

      const advCampaignIds = advCampaigns.map((c: { id: string }) => c.id);
      const { data: weekDelivery } = await supabase
        .from("campaign_delivery_daily")
        .select("plays")
        .in("campaign_id", advCampaignIds)
        .gte("day", new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
      const weekPlays = (weekDelivery ?? []).reduce(
        (s: number, r: { plays: number }) => s + (Number(r.plays) || 0), 0
      );

      const totalSpend = advCampaigns.reduce(
        (s: number, c: { budget: number }) => s + (c.budget ?? 0), 0
      );

      await sendNotification(advId, "weekly_report", {
        totalScans: String((scans ?? []).length),
        totalPlays: String(weekPlays),
        activeCampaigns: String(advCampaigns.length),
        totalSpend: totalSpend.toFixed(2),
        appUrl,
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
        appUrl,
      });
    }
  }
  // ── Marketplace: expiring-listing reminders + opt-in auto-renew ──
  await runMarketplaceExpiryPass();
  await runMarketplacePastDueSweep();

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

  // Offline alerts are owned by screen-health-cron (every 5 min, fired once on
  // the online/idle→offline transition). Previously duplicated here as an N+1
  // per-screen heartbeat scan; removed to avoid double alerts and the N+1.

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
