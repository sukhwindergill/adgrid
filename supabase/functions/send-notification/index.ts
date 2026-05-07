import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = "onboarding@resend.dev";
const INTERNAL_SECRET = Deno.env.get("INTERNAL_NOTIFICATION_SECRET") ?? "";

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
    html: emailHtml("Weekly Performance Report", `This week: <strong>${d.totalScans} scans</strong> across <strong>${d.activeCampaigns} active campaigns</strong>.<br><br>Total spend: <strong>$${d.totalSpend}</strong>`, "View Analytics", d.appUrl ?? ""),
  }),
  payment_failed: (d) => ({
    title: "Payment failed",
    body: `A payment of $${d.amount} failed. Please update your payment method.`,
    html: emailHtml("Payment Failed", `A payment of <strong>$${d.amount}</strong> for your AdGrid account failed. Please update your payment method to avoid service interruption.`, "Update Payment", d.appUrl ?? ""),
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
    title: `Payout of $${d.amount} sent`,
    body: `Your payout of $${d.amount} has been transferred to your bank.`,
    html: emailHtml("Payout Sent", `Your payout of <strong>$${d.amount}</strong> has been transferred to your connected bank account via Stripe.`, "View Payouts", d.appUrl ?? ""),
  }),
  weekly_revenue: (d) => ({
    title: "Weekly revenue summary",
    body: `$${d.revenue} in revenue across ${d.screenCount} screens this week.`,
    html: emailHtml("Weekly Revenue Summary", `This week your network earned <strong>$${d.revenue}</strong> across <strong>${d.screenCount} screens</strong>.`, "View Revenue", d.appUrl ?? ""),
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
    AdGrid · You're receiving this because you have notifications enabled. <a href="#" style="color:#6b7280;">Unsubscribe</a>
  </div>
</div>
</body></html>`;
}

Deno.serve(async (req: Request) => {
  // Allow internal calls from notification-cron via shared secret header
  const internalHeader = req.headers.get("x-internal-secret");
  const isInternal = INTERNAL_SECRET && internalHeader === INTERNAL_SECRET;

  if (!isInternal) {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response("Unauthorized", { status: 401 });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return new Response("Unauthorized", { status: 401 });
  }

  const { userId, type, data: notifData = {} } = await req.json();
  if (!userId || !type) return new Response("Missing userId or type", { status: 400 });

  const template = TEMPLATES[type];
  if (!template) return new Response("Unknown notification type", { status: 400 });

  const { title, body, html } = template(notifData);

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
      headers: { "Content-Type": "application/json" },
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
    headers: { "Content-Type": "application/json" },
  });
});
