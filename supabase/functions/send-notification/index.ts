import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = "noreply@adgrid.io";
const INTERNAL_SECRET = Deno.env.get("INTERNAL_NOTIFICATION_SECRET") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
  "Content-Type": "application/json",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Only http(s) URLs are safe to render as an href — reject javascript:/data:
// URIs an attacker-controlled data payload could otherwise smuggle in.
function safeUrl(value: string): string {
  try {
    const u = new URL(value);
    if (u.protocol === "http:" || u.protocol === "https:" || u.protocol === "mailto:") return value;
  } catch {
    // fall through
  }
  return "";
}

function currencySymbol(currency?: string): string {
  if (!currency) return "$";
  const c = currency.toLowerCase();
  if (c === "gbp") return "£";
  if (c === "eur") return "€";
  return "$"; // cad, usd, and anything else
}

function fmtMoney(amount: string, currency?: string): string {
  const sym = currencySymbol(currency);
  const code = currency ? ` ${currency.toUpperCase()}` : "";
  return `${sym}${amount}${code}`;
}

const TEMPLATES: Record<string, (data: Record<string, string>) => { title: string; body: string; html: string }> = {
  campaign_approved: (d) => ({
    title: "Your campaign is approved",
    body: `"${d.campaignName}" has been approved and is now scheduled to go live.`,
    html: emailHtml("Your campaign is approved", `Your campaign <strong>${d.campaignName}</strong> has been approved and is scheduled to go live.`, "View Campaign", d.appUrl ?? ""),
  }),
  campaign_live: (d) => ({
    title: "Campaign is now live",
    body: `"${d.campaignName}" is now live on ${d.screenName}.`,
    html: emailHtml("Campaign is now live", `Your campaign <strong>${d.campaignName}</strong> is now live on ${d.screenName}.`, "View Campaign", d.appUrl ?? ""),
  }),
  campaign_paused: (d) => ({
    title: "Campaign paused — low budget",
    body: `"${d.campaignName}" has been paused due to low budget.`,
    html: emailHtml("Campaign paused", `Your campaign <strong>${d.campaignName}</strong> has been paused. Please top up your budget to resume.`, "Add Budget", d.appUrl ?? ""),
  }),
  low_budget: (d) => ({
    title: "Budget running low",
    body: `"${d.campaignName}" has less than 20% of its run remaining.`,
    html: emailHtml("Budget running low", `Your campaign <strong>${d.campaignName}</strong> is running low on budget. Add funds to keep it running.`, "Manage Budget", d.appUrl ?? ""),
  }),
  campaign_ended: (d) => ({
    title: "Campaign has ended",
    body: `"${d.campaignName}" has completed its run.`,
    html: emailHtml("Campaign ended", `Your campaign <strong>${d.campaignName}</strong> has ended. Check your analytics to see how it performed.`, "View Analytics", d.appUrl ?? ""),
  }),
  scan_milestone: (d) => ({
    title: `Milestone: ${d.count} scans reached`,
    body: `"${d.campaignName}" just hit ${d.count} QR scans.`,
    html: emailHtml(`${d.count} scans milestone!`, `Your campaign <strong>${d.campaignName}</strong> just reached <strong>${d.count} QR scans</strong>. Great engagement!`, "View Scans", d.appUrl ?? ""),
  }),
  weekly_report: (d) => ({
    title: "Your weekly performance report",
    body: `${d.totalScans} scans across ${d.activeCampaigns} campaigns this week.`,
    html: emailHtml("Weekly Performance Report", `This week: <strong>${d.totalScans} scans</strong> across <strong>${d.activeCampaigns} active campaigns</strong>.<br><br>Total spend: <strong>${fmtMoney(d.totalSpend, d.currency)}</strong>`, "View Analytics", d.appUrl ?? ""),
  }),
  payment_failed: (d) => ({
    title: "Payment failed",
    body: `A payment of ${fmtMoney(d.amount, d.currency)} failed. Please update your payment method.`,
    html: emailHtml("Payment Failed", `A payment of <strong>${fmtMoney(d.amount, d.currency)}</strong> for your AdGrid account failed. Please update your payment method to avoid service interruption.`, "Update Payment", d.appUrl ?? ""),
  }),
  payment_authentication_required: (d) => ({
    title: "Action required: complete payment authentication",
    body: `Your card requires authentication for a payment of ${fmtMoney(d.amount, d.currency)}. Please update your payment method.`,
    html: emailHtml("Payment Authentication Required", `Your card requires additional authentication for a payment of <strong>${fmtMoney(d.amount, d.currency)}</strong>. Please go to your billing settings, add a card, and re-submit your campaign.`, "Go to Billing", d.appUrl ?? ""),
  }),
  new_advertiser: (d) => ({
    title: "New advertiser signed up",
    body: `${d.advertiserName} just joined AdGrid.`,
    html: emailHtml("New Advertiser", `<strong>${d.advertiserName}</strong> (${d.advertiserEmail}) just signed up as an advertiser.`, "View Advertiser", d.appUrl ?? ""),
  }),
  campaign_submitted: (d) => ({
    title: "New campaign awaiting approval",
    body: `${d.advertiserName} submitted a new campaign for review.`,
    html: emailHtml("Campaign Submitted", `<strong>${d.advertiserName}</strong> submitted a new campaign. Review and approve it to get it live.`, "Review Campaign", d.appUrl ?? ""),
  }),
  payout_completed: (d) => ({
    title: `Payout of ${fmtMoney(d.amount, d.currency)} sent`,
    body: `Your payout of ${fmtMoney(d.amount, d.currency)} has been transferred to your bank.`,
    html: emailHtml("Payout Sent", `Your payout of <strong>${fmtMoney(d.amount, d.currency)}</strong> has been transferred to your connected bank account via Stripe.`, "View Payouts", d.appUrl ?? ""),
  }),
  weekly_revenue: (d) => ({
    title: "Weekly revenue summary",
    body: `${fmtMoney(d.revenue, d.currency)} in revenue across ${d.screenCount} screens this week.`,
    html: emailHtml("Weekly Revenue Summary", `This week your network earned <strong>${fmtMoney(d.revenue, d.currency)}</strong> across <strong>${d.screenCount} screens</strong>.`, "View Revenue", d.appUrl ?? ""),
  }),
  team_member_joined: (d) => ({
    title: "Team member joined",
    body: `${d.memberName} accepted your team invite.`,
    html: emailHtml("Team Member Joined", `<strong>${d.memberName}</strong> has accepted your invite and joined your team.`, "View Team", d.appUrl ?? ""),
  }),
  account_suspended: (_d) => ({
    title: "Your account has been suspended",
    body: "Your AdGrid account has been suspended. Contact support for assistance.",
    html: emailHtml("Account Suspended", "Your AdGrid account has been suspended by an operator. Please contact support for assistance.", "Contact Support", "mailto:support@adgrid.io"),
  }),
  screen_offline: (d) => ({
    title: "Screen appears offline",
    body: `"${d.screenName}" hasn't reported a heartbeat in over ${d.minutes} minutes.`,
    html: emailHtml("Screen Offline", `Your screen <strong>${d.screenName}</strong> hasn't sent a heartbeat in over <strong>${d.minutes} minutes</strong>. Check that the display player is running.`, "View Screen", d.appUrl ?? ""),
  }),
  screen_registered: (d) => ({
    title: "Your screen has been registered",
    body: `"${d.screenName}" is registered. Open the player URL on your display to go live.`,
    html: emailHtml(
      "Screen registered — you're nearly live",
      `Your screen <strong>${d.screenName}</strong> has been registered on AdGrid.<br><br>Open the player URL on your display device to connect and start receiving campaigns.<br><br><strong>Player URL:</strong><br><code style="background:#f3f4f6;padding:4px 8px;border-radius:4px;font-size:12px;">${d.playerUrl}</code><br><br>Keep your screen token private — it authenticates your display.`,
      "Go to My Screen",
      d.appUrl ?? "",
    ),
  }),
  grant_invite: (d) => ({
    title: `${d.grantorName} invited you to access their AdGrid account`,
    body: `${d.grantorName} has given you ${d.role} access to their AdGrid account. Accept to get started.`,
    html: emailHtml(
      "You've been invited",
      `<strong>${d.grantorName}</strong> has invited you to access their AdGrid account as a <strong>${d.role}</strong>.<br><br>Click below to accept the invitation and get started.`,
      "Accept Invitation",
      d.acceptUrl ?? "",
    ),
  }),
};

function emailHtml(title: string, body: string, ctaLabel: string, ctaUrl: string): string {
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;background:#f9fafb;margin:0;padding:40px 0;">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
  <div style="background:#2563eb;padding:20px 28px;">
    <span style="color:#fff;font-size:16px;font-weight:700;letter-spacing:-0.5px;">ADGRID</span>
  </div>
  <div style="padding:28px;">
    <h2 style="margin:0 0 12px;font-size:18px;font-weight:700;color:#111827;">${title}</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">${body}</p>
    ${ctaUrl ? `<a href="${ctaUrl}" style="display:inline-block;padding:10px 22px;background:#2563eb;color:#fff;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;">${ctaLabel}</a>` : ""}
  </div>
  <div style="padding:16px 28px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;">
    AdGrid · You're receiving this because you have notifications enabled. <a href="${Deno.env.get("PUBLIC_APP_URL") ?? ""}/app/notification-prefs" style="color:#6b7280;">Unsubscribe</a>
  </div>
</div>
</body></html>`;
}

Deno.serve(async (req: Request) => {
  // Browsers preflight any cross-origin request carrying a custom header
  // (Authorization, x-internal-secret) with an OPTIONS request that never
  // includes those headers. This must be answered before any auth check,
  // or every preflight 401s and the browser silently drops the real
  // request — every in-app notification (campaign approved, etc.) failed
  // this way with no visible error.
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  // Allow internal calls from notification-cron via shared secret header
  const internalHeader = req.headers.get("x-internal-secret");
  const isInternal = INTERNAL_SECRET && internalHeader === INTERNAL_SECRET;

  let callerUserId: string | null = null;
  let callerRole: string | null = null;

  if (!isInternal) {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response("Unauthorized", { status: 401, headers: CORS });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return new Response("Unauthorized", { status: 401, headers: CORS });
    callerUserId = user.id;
    const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    callerRole = prof?.role ?? null;
  }

  const { userId, type, data: notifData = {} } = await req.json();
  if (!userId || !type) return new Response("Missing userId or type", { status: 400, headers: CORS });

  // Non-internal callers can only send to themselves, unless they are an
  // operator (existing behavior), or the call matches one of these narrow,
  // server-verified exceptions:
  //   - campaign_submitted: any advertiser may notify a user who is
  //     genuinely an operator (operator_id is already public on the screens
  //     the advertiser booked).
  //   - grant_invite: the caller may notify the grantee of an
  //     account_grants row they themselves just created.
  if (!isInternal && callerRole !== "operator" && callerUserId !== userId) {
    let allowed = false;
    if (type === "campaign_submitted" && callerRole === "advertiser") {
      const { data: targetProf } = await supabase.from("profiles").select("role").eq("id", userId).single();
      allowed = targetProf?.role === "operator";
    } else if (type === "grant_invite") {
      const { data: grant } = await supabase
        .from("account_grants")
        .select("id")
        .eq("granted_by", callerUserId)
        .eq("grantee_id", userId)
        .eq("status", "pending")
        .limit(1)
        .maybeSingle();
      allowed = !!grant;
    }
    if (!allowed) return new Response("Forbidden", { status: 403, headers: CORS });
  }

  const template = TEMPLATES[type];
  if (!template) return new Response("Unknown notification type", { status: 400, headers: CORS });

  // Sanitize every field before it reaches a template — templates interpolate
  // these values directly into outgoing HTML email with no escaping of their
  // own, and any operator can trigger a notification to any user (see the
  // authorization check above), so unescaped input here is a stored HTML/
  // phishing-link injection vector sent from AdGrid's own domain.
  const URL_FIELDS = new Set(["appUrl", "acceptUrl", "playerUrl"]);
  const sanitizedData: Record<string, string> = {};
  for (const [key, value] of Object.entries(notifData as Record<string, unknown>)) {
    const str = String(value ?? "");
    sanitizedData[key] = URL_FIELDS.has(key) ? safeUrl(str) : escapeHtml(str);
  }

  const { title, body, html } = template(sanitizedData);

  // Always insert in-app notification
  await supabase.from("notifications").insert({ user_id: userId, type, title, body });

  // Check notification pref before sending email
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, notification_prefs")
    .eq("id", userId)
    .single();

  const prefs = profile?.notification_prefs ?? {};
  if (prefs[type] === false || !profile?.email) {
    return new Response(JSON.stringify({ ok: true, emailSent: false }), {
      headers: CORS,
    });
  }

  // Send via Resend
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: profile.email, subject: title, html }),
  });

  if (!res.ok) console.error("Resend error:", await res.text());

  return new Response(JSON.stringify({ ok: true, emailSent: res.ok }), {
    headers: CORS,
  });
});
