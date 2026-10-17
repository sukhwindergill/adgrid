import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  DEFAULT_OWNER_REVENUE_SHARE,
  frozenScreenCount,
  screenPayoutCents,
} from "../_shared/payoutSharing.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const FUNCTIONS_URL = `${Deno.env.get("SUPABASE_URL")!}/functions/v1`;
const INTERNAL_SECRET = Deno.env.get("INTERNAL_NOTIFICATION_SECRET") ?? "";


// Every Response this function returns needs this, not just the OPTIONS
// preflight — a browser enforces Access-Control-Allow-Origin on the actual
// response too, not only the preflight. Before this fix, every real
// response here (200 success and every error path) only set Content-Type,
// so a real advertiser/operator clicking Approve/Pay in the browser got a
// CORS-blocked "Failed to fetch", identical in kind to B9/B17/the
// stripe-billing gap, even though a direct (non-browser) call — the way
// B22/B23 were verified live — never hits this at all.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-internal-secret",
  "Content-Type": "application/json",
};

// Ledger of what each screen was paid (screen_payouts), so a late approval
// settles only its own share and nothing is paid twice.
async function recordScreenPayouts(
  bookingId: string,
  operatorId: string,
  screenIds: string[],
  amountPerScreen: number,
  currency: string,
  transferId: string | null,
  status: "transferred" | "failed",
  late: boolean,
): Promise<void> {
  if (screenIds.length === 0) return;
  await supabase.from("screen_payouts").upsert(
    screenIds.map((screen_id) => ({
      booking_id: bookingId,
      screen_id,
      operator_id: operatorId,
      amount: amountPerScreen,
      currency,
      stripe_transfer_id: transferId,
      status,
      late,
    })),
    { onConflict: "booking_id,screen_id" },
  );
}

// Pays every approved, non-control screen that hasn't been paid yet (screens
// that approved after the charge, plus charge-time transfers that failed),
// one transfer per screen at the same frozen per-screen share. Idempotent:
// transferred screens are skipped and Stripe's idempotency key is per screen.
async function settleLatePayouts(
  bookingId: string,
  budget: number,
  currency: string,
  frozenCount: number,
): Promise<void> {
  const { data: approved } = await supabase
    .from("campaign_screens")
    .select("screen_id")
    .eq("campaign_id", bookingId)
    .eq("is_control", false)
    .in("status", ["approved", "auto_approved"]);
  if (!approved || approved.length === 0) return;

  const { data: ledger } = await supabase
    .from("screen_payouts")
    .select("screen_id, status")
    .eq("booking_id", bookingId);
  const paid = new Set((ledger ?? []).filter((r) => r.status === "transferred").map((r) => r.screen_id as string));
  const alreadyFailed = new Set((ledger ?? []).filter((r) => r.status === "failed").map((r) => r.screen_id as string));
  const owing = (approved as { screen_id: string }[]).map((r) => r.screen_id).filter((id) => !paid.has(id));
  if (owing.length === 0) return;

  const { data: screenRows } = await supabase.from("screens").select("id, operator_id").in("id", owing);
  const operatorIds = [...new Set((screenRows ?? []).map((s) => s.operator_id as string).filter(Boolean))];
  if (operatorIds.length === 0) return;
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, stripe_connect_account_id, connect_status, owner_revenue_share")
    .in("id", operatorIds);
  const profileById = new Map((profiles ?? []).map((p) => [p.id as string, p]));

  for (const s of (screenRows ?? []) as { id: string; operator_id: string }[]) {
    const profile = profileById.get(s.operator_id);
    // No active Connect account yet: nothing to send. The screen stays
    // unpaid in the ledger and is picked up the next time this runs.
    if (!profile?.stripe_connect_account_id || profile.connect_status !== "active") continue;

    const revenueShare = (profile.owner_revenue_share as number | null) ?? DEFAULT_OWNER_REVENUE_SHARE;
    const cents = screenPayoutCents(budget, revenueShare, frozenCount);
    if (cents <= 0) continue;

    try {
      const transfer = await stripe.transfers.create(
        {
          amount: cents,
          currency,
          destination: profile.stripe_connect_account_id as string,
          metadata: { booking_id: bookingId, operator_id: s.operator_id, screen_id: s.id, total_screens: String(frozenCount) },
        },
        { idempotencyKey: `screen-payout:${bookingId}:${s.id}` },
      );
      await recordScreenPayouts(bookingId, s.operator_id, [s.id], cents / 100, currency, transfer.id, "transferred", true);
    } catch (e) {
      console.error(`[charge-campaign] late payout failed for screen ${s.id}:`, e instanceof Error ? e.message : e);
      await recordScreenPayouts(bookingId, s.operator_id, [s.id], cents / 100, currency, null, "failed", true);
      if (!alreadyFailed.has(s.id)) {
        await notifyAdvertiser(s.operator_id, "payout_transfer_failed", {
          amount: (cents / 100).toFixed(2),
          currency,
          appUrl: `${Deno.env.get("PUBLIC_APP_URL") ?? ""}/app/op-settings`,
        });
      }
    }
  }
}

async function distributeOperatorCuts(
  bookingId: string,
  budget: number,
  currency: string,
  frozenCount: number,
): Promise<void> {
  // 1. Find all screens for this campaign
  // Control screens (holdout test) never served this campaign's creative --
  // an operator should not be paid for a screen that showed nothing. Same
  // reasoning excludes rejected/still-pending screens: this function only
  // blocks the charge outright when EVERY screen rejected (see the
  // booking.status === "rejected" / screenLinks.every check above this
  // function's call site), so a mixed campaign -- some screens approved,
  // one operator's screen rejected -- gets charged and, without this
  // filter, would still pay the operator who rejected it and never ran
  // the ad at all.
  const { data: csRows } = await supabase
    .from("campaign_screens")
    .select("screen_id")
    .eq("campaign_id", bookingId)
    .eq("is_control", false)
    .in("status", ["approved", "auto_approved"]);

  if (!csRows || csRows.length === 0) return;

  const screenIds = csRows.map((r: { screen_id: string }) => r.screen_id);

  // 2. Fetch operator info for each screen
  const { data: screenRows } = await supabase
    .from("screens")
    .select("id, operator_id")
    .in("id", screenIds);

  if (!screenRows || screenRows.length === 0) return;

  // 3. Group screens by operator
  const byOperator = new Map<string, number>();
  const screensByOperator = new Map<string, string[]>();
  for (const s of screenRows as { id: string; operator_id: string }[]) {
    if (!s.operator_id) continue;
    byOperator.set(s.operator_id, (byOperator.get(s.operator_id) ?? 0) + 1);
    screensByOperator.set(s.operator_id, [...(screensByOperator.get(s.operator_id) ?? []), s.id]);
  }

  if (byOperator.size === 0) return;

  // 4. Fetch operator profiles (Connect account + revenue share)
  const operatorIds = [...byOperator.keys()];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, stripe_connect_account_id, connect_status, owner_revenue_share")
    .in("id", operatorIds);

  if (!profiles) return;

  // 5. For each operator, compute their cut and create a Stripe Transfer
  for (const profile of profiles as {
    id: string;
    stripe_connect_account_id: string | null;
    connect_status: string | null;
    owner_revenue_share: number | null;
  }[]) {
    if (!profile.stripe_connect_account_id || profile.connect_status !== "active") {
      console.warn(`[charge-campaign] operator ${profile.id} has no active Connect account — skipping transfer`);
      continue;
    }

    const operatorScreenCount = byOperator.get(profile.id) ?? 0;
    if (operatorScreenCount === 0) continue;

    const revenueShare = profile.owner_revenue_share ?? DEFAULT_OWNER_REVENUE_SHARE;
    // Per-screen share of the budget frozen at charge time (N counts
    // screens still pending review too), not of the screens approved right
    // now: that is what lets a late approval be paid later without the
    // total ever exceeding the budget share. Rounded down to the cent.
    const amountCents = screenPayoutCents(budget, revenueShare, frozenCount) * operatorScreenCount;

    if (amountCents <= 0) continue;

    // Idempotency key prevents double-transfer if this runs twice
    const idempotencyKey = `operator-transfer:${bookingId}:${profile.id}`;

    try {
      const transfer = await stripe.transfers.create(
        {
          amount: amountCents,
          currency,
          destination: profile.stripe_connect_account_id,
          metadata: {
            booking_id: bookingId,
            operator_id: profile.id,
            screen_count: String(operatorScreenCount),
            total_screens: String(frozenCount),
          },
        },
        { idempotencyKey },
      );

      // Log the transfer — upsert so re-runs don't duplicate rows
      await supabase.from("operator_transfers").upsert(
        {
          booking_id: bookingId,
          operator_id: profile.id,
          amount: amountCents / 100,
          currency,
          stripe_transfer_id: transfer.id,
          status: "transferred",
          screen_count: operatorScreenCount,
          total_screens: frozenCount,
        },
        { onConflict: "booking_id,operator_id" },
      );
      await recordScreenPayouts(bookingId, profile.id, screensByOperator.get(profile.id) ?? [], amountCents / operatorScreenCount / 100, currency, transfer.id, "transferred", false);
    } catch (e) {
      console.error(
        `[charge-campaign] transfer failed for operator ${profile.id}:`,
        e instanceof Error ? e.message : e,
      );
      // Log the failure so it can be retried via admin flow
      await supabase.from("operator_transfers").upsert(
        {
          booking_id: bookingId,
          operator_id: profile.id,
          amount: amountCents / 100,
          currency,
          stripe_transfer_id: null,
          status: "failed",
          screen_count: operatorScreenCount,
          total_screens: frozenCount,
        },
        { onConflict: "booking_id,operator_id" },
      );
      await recordScreenPayouts(bookingId, profile.id, screensByOperator.get(profile.id) ?? [], amountCents / operatorScreenCount / 100, currency, null, "failed", false);
      // B16: this used to be logged nowhere an operator could ever see it —
      // "connected" in Settings, then a payout that just never arrives with
      // zero explanation. Tell them at the moment it happens.
      await notifyAdvertiser(profile.id, "payout_transfer_failed", {
        amount: (amountCents / 100).toFixed(2),
        currency,
        appUrl: `${Deno.env.get("PUBLIC_APP_URL") ?? ""}/app/op-settings`,
      });
    }
  }
}

async function notifyAdvertiser(userId: string, type: string, data: Record<string, string>) {
  await fetch(`${FUNCTIONS_URL}/send-notification`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": Deno.env.get("INTERNAL_NOTIFICATION_SECRET") ?? "",
    },
    body: JSON.stringify({ userId, type, data }),
  }).catch(() => {});
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: CORS });
  }

  // B22: sweep-approvals' policy-driven auto-approve needs to trigger this
  // same charge step a human's manual approve already gets from
  // ApprovalQueue.jsx -- but it's a service-role cron with no user session
  // to put in an Authorization header. Same trusted-internal-caller pattern
  // already used to reach send-notification from every other cron here.
  const internalHeader = req.headers.get("x-internal-secret");
  const isInternal = !!INTERNAL_SECRET && internalHeader === INTERNAL_SECRET;

  let callerUserId: string | null = null;
  let callerRole: string | null = null;

  if (!isInternal) {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response("Unauthorized", { status: 401, headers: CORS });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return new Response("Unauthorized", { status: 401, headers: CORS });
    callerUserId = user.id;

    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    callerRole = callerProfile?.role ?? null;
  }

  const { campaign_id } = await req.json().catch(() => ({}));
  if (!campaign_id) {
    return new Response(JSON.stringify({ error: "campaign_id required" }), {
      status: 400,
      headers: CORS,
    });
  }

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, status, budget, currency, advertiser_id, advertiser_name, screen_name, payment_status, is_demo, payout_screen_count")
    .eq("id", campaign_id)
    .single();

  if (bookingError || !booking) {
    return new Response(JSON.stringify({ error: "Campaign not found" }), {
      status: 404,
      headers: CORS,
    });
  }

  // The advertiser who owns the campaign may trigger the charge.
  // Operators may also trigger it, but only if they own at least one screen
  // in this campaign — prevents any operator charging any advertiser's card.
  // Skipped entirely for a trusted internal caller (sweep-approvals) — it
  // already verified every screen cleared via a real operator policy before
  // ever calling here, which is a stronger check than "owns one screen".
  if (!isInternal) {
    const isOwner = booking.advertiser_id === callerUserId;
    if (!isOwner) {
      if (callerRole !== "operator") {
        return new Response("Forbidden", { status: 403, headers: CORS });
      }
      const { data: opScreens } = await supabase
        .from("screens")
        .select("id")
        .eq("operator_id", callerUserId);
      const opScreenIds = (opScreens ?? []).map((s) => s.id);
      const { data: operatorLink } = opScreenIds.length > 0
        ? await supabase
            .from("campaign_screens")
            .select("id")
            .eq("campaign_id", campaign_id)
            .in("screen_id", opScreenIds)
            .limit(1)
            .maybeSingle()
        : { data: null };
      if (!operatorLink) {
        return new Response("Forbidden", { status: 403, headers: CORS });
      }
    }
  }

  // A campaign that's already rejected, or that every screen it targets has
  // rejected, can never actually serve — display-feed only plays
  // campaign_screens rows with status approved/auto_approved. Refuse to
  // charge for something that's dead on arrival.
  if (booking.status === "rejected") {
    return new Response(
      JSON.stringify({ error: "This campaign was rejected and cannot be charged." }),
      { status: 400, headers: CORS },
    );
  }

  const { data: screenLinks } = await supabase
    .from("campaign_screens")
    .select("status, is_control, screens(is_demo)")
    .eq("campaign_id", campaign_id);

  // Demo inventory (screens.is_demo) is seeded fake screens used to make the
  // product demoable. It's still status='live', so before this guard a real
  // advertiser who flipped on demo mode could book one and be charged real
  // money for a screen that doesn't exist -- production had exactly such a
  // booking, auto_approved and marked paid. Demo campaigns are never charged.
  // (The enforce_demo_screen_isolation trigger also stops real campaigns
  // from targeting demo screens at all; this is the last line before Stripe.)
  const touchesDemo = booking.is_demo ||
    (screenLinks ?? []).some((r) => (r.screens as { is_demo?: boolean } | null)?.is_demo);
  if (touchesDemo) {
    return new Response(
      JSON.stringify({ error: "Demo campaigns and demo screens can't be charged." }),
      { status: 400, headers: CORS },
    );
  }

  if (screenLinks && screenLinks.length > 0 && screenLinks.every((r) => r.status === "rejected")) {
    return new Response(
      JSON.stringify({ error: "Every screen targeted by this campaign has rejected it — there's nothing to charge for." }),
      { status: 400, headers: CORS },
    );
  }

  // Terms of Service: "payment is only captured after Operator approval".
  // Until at least one (non-holdout) screen has approved, there is nothing
  // the advertiser is buying yet -- and charging up front left them paying
  // for campaigns operators then rejected, with no refund path (stripe-refund
  // is retired; only SLA expiry credits). It also skipped operator payouts:
  // distributeOperatorCuts only pays screens approved at charge time, and
  // the later approval's charge attempt then 409s as "already paid".
  const hasApprovedScreen = (screenLinks ?? []).some(
    (r) => !r.is_control && (r.status === "approved" || r.status === "auto_approved"),
  );
  if (!hasApprovedScreen) {
    return new Response(
      JSON.stringify({ error: "Your card is charged once an operator approves the campaign.", awaiting_approval: true }),
      { status: 409, headers: CORS },
    );
  }

  // Already charged, and the budget split was frozen at charge time (the
  // "go live as screens approve" case): a screen approving now is not charged
  // again, it is paid its own share. Safe for any caller who passed the
  // ownership checks above -- the amounts come from the ledger, not the caller.
  if (booking.payment_status === "paid" && booking.payout_screen_count) {
    try {
      await settleLatePayouts(campaign_id, Number(booking.budget), String(booking.currency ?? "cad").toLowerCase(), booking.payout_screen_count as number);
    } catch (e) {
      console.error("[charge-campaign] late payout settlement error:", e);
    }
    return new Response(JSON.stringify({ success: true, settled: true }), { headers: CORS });
  }

  // Freeze N, the number of screens the budget is split across: non-control
  // screens that are approved or still pending review. Later approvals are
  // paid 1/N each; screens that never serve are credited back (see
  // 20261017024043_per_screen_payouts.sql).
  const frozenCount = frozenScreenCount((screenLinks ?? []) as { status: string; is_control?: boolean | null }[]);

  // Atomic lock: flip payment_status to 'charging' only if currently not paid/charging.
  // Concurrent requests both reading 'unpaid' would race; only one UPDATE wins.
  // B23: this UPDATE was dead code from day one -- bookings_payment_status_check
  // never allowed 'charging' as a value, so every call hit a check-constraint
  // violation on the UPDATE. The old code only destructured `data` (always
  // null on that error) and never looked at `error`, so the violation was
  // silently swallowed and every caller just saw a false 409 "already paid or
  // in progress" -- meaning no campaign, from any caller, could ever actually
  // be charged. Fixed the constraint itself (see migration
  // 20260810000002_bookings_payment_status_allow_charging.sql) and now check
  // `error` explicitly so a real failure here is never mistaken for "someone
  // else already has the lock" again.
  const { data: locked, error: lockError } = await supabase
    .from("bookings")
    .update({ payment_status: "charging", payout_screen_count: frozenCount })
    .eq("id", campaign_id)
    .neq("payment_status", "paid")
    .neq("payment_status", "charging")
    .select("id")
    .maybeSingle();

  if (lockError) {
    console.error("[charge-campaign] lock update failed:", lockError);
    return new Response(
      JSON.stringify({ error: "Could not start payment processing. Please try again." }),
      { status: 500, headers: CORS },
    );
  }

  if (!locked) {
    // Either already paid or another request is mid-flight
    return new Response(
      JSON.stringify({ error: "Campaign is already paid or a payment is in progress." }),
      { status: 409, headers: CORS },
    );
  }

  const { data: advertiser } = await supabase
    .from("profiles")
    .select("stripe_customer_id, email")
    .eq("id", booking.advertiser_id)
    .single();

  if (!advertiser?.stripe_customer_id) {
    // Revert lock so the charge can be retried after billing setup
    await supabase.from("bookings").update({ payment_status: booking.payment_status }).eq("id", campaign_id);
    return new Response(
      JSON.stringify({ error: "Advertiser has no payment account. Ask them to set up billing first." }),
      { status: 400, headers: CORS },
    );
  }

  const paymentMethods = await stripe.paymentMethods.list({
    customer: advertiser.stripe_customer_id,
    type: "card",
    limit: 1,
  });

  if (paymentMethods.data.length === 0) {
    await supabase.from("bookings").update({ payment_status: booking.payment_status }).eq("id", campaign_id);
    return new Response(
      JSON.stringify({ error: "Advertiser has no card on file. Ask them to add a payment method in billing settings." }),
      { status: 400, headers: CORS },
    );
  }

  const paymentMethodId = paymentMethods.data[0].id;
  const amountCents = Math.round(booking.budget * 100);
  const currency = booking.currency ?? "cad";

  let paymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency,
      customer: advertiser.stripe_customer_id,
      payment_method: paymentMethodId,
      confirm: true,
      off_session: true,
      description: `AdGrid: ${booking.advertiser_name} — ${booking.screen_name}`,
      metadata: { campaign_id: booking.id, advertiser_id: booking.advertiser_id },
    }, {
      idempotencyKey: `charge-campaign:${booking.id}:${paymentMethodId}`,
    });
  } catch (stripeErr: unknown) {
    const msg = stripeErr instanceof Error ? stripeErr.message : "Payment failed";
    await supabase
      .from("bookings")
      .update({ payment_status: "failed", status: "paused" })
      .eq("id", campaign_id);
    await notifyAdvertiser(booking.advertiser_id, "payment_failed", {
      amount: booking.budget.toFixed(2),
      currency,
      appUrl: `${Deno.env.get("PUBLIC_APP_URL") ?? ""}/app/adv-billing`,
    });
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: CORS,
    });
  }

  // 3DS / requires_action: card needs authentication — send advertiser to billing to re-attempt
  if (paymentIntent.status === "requires_action" || paymentIntent.status === "requires_payment_method") {
    await supabase
      .from("bookings")
      .update({ payment_status: "failed", status: "paused", payment_intent_id: paymentIntent.id })
      .eq("id", campaign_id);
    await notifyAdvertiser(booking.advertiser_id, "payment_authentication_required", {
      amount: booking.budget.toFixed(2),
      currency,
      appUrl: `${Deno.env.get("PUBLIC_APP_URL") ?? ""}/app/adv-billing`,
    });
    return new Response(
      JSON.stringify({
        error: "Your card requires additional authentication. Please update your payment method in billing settings and try again.",
        requires_action: true,
      }),
      { status: 402, headers: CORS },
    );
  }

  if (paymentIntent.status !== "succeeded") {
    await supabase
      .from("bookings")
      .update({ payment_status: "failed", status: "paused" })
      .eq("id", campaign_id);
    return new Response(
      JSON.stringify({ error: `Payment not completed (status: ${paymentIntent.status})` }),
      { status: 400, headers: CORS },
    );
  }

  await supabase
    .from("bookings")
    .update({
      status: "scheduled",
      payment_intent_id: paymentIntent.id,
      payment_status: "paid",
      currency,
    })
    .eq("id", campaign_id);

  // Distribute operator cuts — fire and forget so a transfer hiccup
  // doesn't block the advertiser's success response.
  distributeOperatorCuts(campaign_id, booking.budget, currency, frozenCount).catch((e) =>
    console.error("[charge-campaign] operator transfer error:", e)
  );

  return new Response(
    JSON.stringify({ success: true, payment_intent_id: paymentIntent.id }),
    { headers: CORS },
  );
});
