import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireCronSecret } from "../_shared/cronGuard.ts";
import { generateToken } from "../_shared/shareToken.ts";
import {
  buildReportCsv, nextRunAt, reportPeriod, rowsInPeriod, summarizeDelivery, toBase64Utf8,
} from "../_shared/reportSchedule.ts";

// Sends due report_schedules rows (see 20261016144558_report_schedules.sql).
// Invoked hourly by pg_cron with x-cron-secret. Each email carries a KPI
// summary for the period, a share-report link per campaign, and a CSV of
// daily delivery. Mail goes out through Resend with the same key and sender
// as send-notification -- that function only mails a user's own profile
// address and has no attachment support, so it can't be called for this.

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = "noreply@adgrid.io";
const APP_URL = (Deno.env.get("PUBLIC_APP_URL") ?? "").replace(/\/+$/, "");

const BATCH = 50;               // schedules per invocation
const MAX_CAMPAIGNS = 50;       // per "all campaigns" email
const SHARE_LINK_DAYS = 90;     // matches ShareReportModal
const SHARE_LINK_MIN_LEFT_DAYS = 14; // reuse an existing link only if it outlives the email a while
const DAY_MS = 86_400_000;

type Schedule = {
  id: string;
  owner_id: string;
  audience: "advertiser" | "operator";
  scope: "campaign" | "all";
  campaign_id: string | null;
  frequency: "weekly" | "monthly";
  recipients: string[];
  next_run_at: string;
};

type Campaign = { id: string; name: string };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const fmt = (n: number) => n.toLocaleString("en-CA");

// Campaign ids the owner can see right now in their scheduled role. Re-derived
// on every send so a schedule follows access, not the state at creation time.
async function accessibleCampaignIds(s: Schedule): Promise<string[]> {
  if (s.audience === "advertiser") {
    const { data } = await supabase.from("bookings").select("id").eq("advertiser_id", s.owner_id);
    return (data ?? []).map((b: { id: string }) => b.id);
  }
  const { data: screens } = await supabase.from("screens").select("id").eq("operator_id", s.owner_id);
  const screenIds = (screens ?? []).map((x: { id: string }) => x.id);
  if (screenIds.length === 0) return [];
  const { data: links } = await supabase.from("campaign_screens").select("campaign_id").in("screen_id", screenIds);
  return [...new Set((links ?? []).map((l: { campaign_id: string }) => l.campaign_id))];
}

// Campaigns to include: the one named (if still accessible) or every
// accessible campaign whose flight overlaps the period.
async function campaignsFor(s: Schedule, period: { start: string; end: string }): Promise<Campaign[]> {
  const ids = await accessibleCampaignIds(s);
  const wanted = s.scope === "campaign" ? ids.filter((id) => id === s.campaign_id) : ids;
  if (wanted.length === 0) return [];

  let q = supabase
    .from("bookings")
    .select("id, campaign_name, advertiser_name, start_date, end_date")
    .in("id", wanted.slice(0, 500));
  if (s.scope === "all") {
    q = q.lt("start_date", period.end).or(`end_date.is.null,end_date.gte.${period.start}`);
  }
  const { data } = await q.order("start_date", { ascending: false }).limit(MAX_CAMPAIGNS);
  return (data ?? []).map((b: { id: string; campaign_name?: string; advertiser_name?: string }) => ({
    id: b.id,
    name: b.campaign_name || b.advertiser_name || b.id,
  }));
}

// Reuse a live share link the owner already has for this campaign, else mint
// one. Same table and semantics as ShareReportModal, so the owner can see and
// revoke it there.
async function shareUrlFor(campaignId: string, ownerId: string): Promise<string> {
  const minExpiry = new Date(Date.now() + SHARE_LINK_MIN_LEFT_DAYS * DAY_MS).toISOString();
  const { data: existing } = await supabase
    .from("campaign_share_tokens")
    .select("token")
    .eq("campaign_id", campaignId)
    .eq("created_by", ownerId)
    .is("revoked_at", null)
    .gt("expires_at", minExpiry)
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let token = existing?.token as string | undefined;
  if (!token) {
    token = generateToken();
    const { error } = await supabase.from("campaign_share_tokens").insert({
      token,
      campaign_id: campaignId,
      created_by: ownerId,
      expires_at: new Date(Date.now() + SHARE_LINK_DAYS * DAY_MS).toISOString(),
    });
    if (error) throw new Error(`share token insert failed: ${error.message}`);
  }
  return `${APP_URL}/report/${token}`;
}

function kpiCell(label: string, value: string): string {
  return `<td style="padding:12px;border:1px solid #e5e7eb;border-radius:8px;text-align:center;">
    <div style="font-size:20px;font-weight:700;color:#111827;">${value}</div>
    <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">${label}</div></td>`;
}

function emailHtml(opts: {
  heading: string;
  periodLabel: string;
  totals: { plays: number; impressions: number; scans: number };
  campaigns: { name: string; url: string; totals: { plays: number; impressions: number; scans: number } }[];
}): string {
  const { heading, periodLabel, totals, campaigns } = opts;
  const rows = campaigns.map((c) => `<tr>
      <td style="padding:8px 0;border-top:1px solid #f3f4f6;font-size:13px;color:#111827;">${escapeHtml(c.name)}</td>
      <td style="padding:8px 0;border-top:1px solid #f3f4f6;font-size:13px;color:#374151;text-align:right;">${fmt(c.totals.plays)}</td>
      <td style="padding:8px 0;border-top:1px solid #f3f4f6;font-size:13px;color:#374151;text-align:right;">${fmt(c.totals.impressions)}</td>
      <td style="padding:8px 0;border-top:1px solid #f3f4f6;font-size:13px;color:#374151;text-align:right;">${fmt(c.totals.scans)}</td>
      <td style="padding:8px 0 8px 12px;border-top:1px solid #f3f4f6;font-size:13px;text-align:right;"><a href="${escapeHtml(c.url)}" style="color:#2563eb;">Report</a></td>
    </tr>`).join("");
  const single = campaigns.length === 1 ? campaigns[0] : null;

  return `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f9fafb;margin:0;padding:40px 0;">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
  <div style="background:#2563eb;padding:20px 28px;">
    <span style="color:#fff;font-size:16px;font-weight:700;letter-spacing:-0.5px;">ADGRID</span>
  </div>
  <div style="padding:28px;">
    <h2 style="margin:0 0 4px;font-size:18px;font-weight:700;color:#111827;">${escapeHtml(heading)}</h2>
    <p style="margin:0 0 20px;font-size:13px;color:#6b7280;">${escapeHtml(periodLabel)}</p>
    <table role="presentation" width="100%" cellspacing="8" style="border-collapse:separate;margin:0 -8px 20px;"><tr>
      ${kpiCell("Plays", fmt(totals.plays))}${kpiCell("Impressions", fmt(totals.impressions))}${kpiCell("Scans", fmt(totals.scans))}
    </tr></table>
    ${single
      ? `<a href="${escapeHtml(single.url)}" style="display:inline-block;padding:10px 22px;background:#2563eb;color:#fff;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;">View full report</a>`
      : campaigns.length === 0
        ? `<p style="font-size:13px;color:#6b7280;">No campaigns ran in this period.</p>`
        : `<table role="presentation" width="100%" style="border-collapse:collapse;">
            <tr><th align="left" style="font-size:11px;color:#6b7280;font-weight:600;">Campaign</th><th align="right" style="font-size:11px;color:#6b7280;font-weight:600;">Plays</th><th align="right" style="font-size:11px;color:#6b7280;font-weight:600;">Impr.</th><th align="right" style="font-size:11px;color:#6b7280;font-weight:600;">Scans</th><th></th></tr>
            ${rows}</table>`}
    <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">Daily figures are attached as CSV. Report links show delivery only — no account or billing details.</p>
  </div>
  <div style="padding:16px 28px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;">
    AdGrid · You're receiving this because an AdGrid user scheduled this report for you. They can stop it from the campaign's Share report screen.
  </div>
</div>
</body></html>`;
}

async function sendOne(s: Schedule): Promise<void> {
  const period = reportPeriod(s.frequency, s.next_run_at);
  const campaigns = await campaignsFor(s, period);

  // A single-campaign schedule whose campaign is gone or no longer visible
  // to the owner has nothing left to report -- stop it rather than mailing
  // an empty report forever.
  if (s.scope === "campaign" && campaigns.length === 0) {
    await supabase.from("report_schedules").delete().eq("id", s.id);
    return;
  }

  const ids = campaigns.map((c) => c.id);
  const { data: daily } = ids.length
    ? await supabase
      .from("campaign_delivery_daily")
      .select("campaign_id, day, plays, impressions, basis, billable_scans")
      .in("campaign_id", ids)
      .gte("day", period.start)
      .lt("day", period.end)
    : { data: [] };

  const perCampaign = [];
  for (const c of campaigns) {
    const rows = rowsInPeriod((daily ?? []).filter((r: { campaign_id: string }) => r.campaign_id === c.id), period);
    perCampaign.push({ name: c.name, rows, totals: summarizeDelivery(rows), url: await shareUrlFor(c.id, s.owner_id) });
  }
  const totals = summarizeDelivery(perCampaign.flatMap((c) => c.rows));

  const lastDay = new Date(new Date(`${period.end}T00:00:00Z`).getTime() - DAY_MS).toISOString().slice(0, 10);
  const periodLabel = `${s.frequency === "weekly" ? "Week" : "Month"} of ${period.start} to ${lastDay}`;
  const heading = s.scope === "campaign"
    ? `${s.frequency === "weekly" ? "Weekly" : "Monthly"} report: ${campaigns[0].name}`
    : `${s.frequency === "weekly" ? "Weekly" : "Monthly"} report: all campaigns`;

  const csv = buildReportCsv(perCampaign);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: s.recipients,
      subject: heading,
      html: emailHtml({ heading, periodLabel, totals, campaigns: perCampaign }),
      attachments: [{ filename: `adgrid-report-${period.start}.csv`, content: toBase64Utf8(csv) }],
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

Deno.serve(async (req: Request) => {
  const denied = requireCronSecret(req);
  if (denied) return denied;

  if (!RESEND_API_KEY || !APP_URL) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY and PUBLIC_APP_URL must be set" }), {
      status: 503, headers: { "Content-Type": "application/json" },
    });
  }

  const now = new Date();
  const { data: due, error } = await supabase
    .from("report_schedules")
    .select("id, owner_id, audience, scope, campaign_id, frequency, recipients, next_run_at")
    .lte("next_run_at", now.toISOString())
    .order("next_run_at", { ascending: true })
    .limit(BATCH);
  if (error) {
    console.error("report-schedule-cron: load failed", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let sent = 0, failed = 0, skipped = 0;
  for (const s of (due ?? []) as Schedule[]) {
    // Claim the row by advancing next_run_at, conditional on it still holding
    // the value we read: an overlapping invocation loses the race and skips
    // instead of sending a duplicate. Advancing from `now` (not from the old
    // next_run_at) means a schedule that fell behind sends once, not once per
    // missed period.
    const next = nextRunAt(s.frequency, now).toISOString();
    const { data: claimed } = await supabase
      .from("report_schedules")
      .update({ next_run_at: next })
      .eq("id", s.id)
      .eq("next_run_at", s.next_run_at)
      .select("id");
    if (!claimed || claimed.length === 0) { skipped++; continue; }

    try {
      await sendOne(s);
      await supabase.from("report_schedules")
        .update({ last_sent_at: new Date().toISOString(), last_error: null })
        .eq("id", s.id);
      sent++;
    } catch (err) {
      // Not retried this period: the claim already moved next_run_at on, and
      // retrying a partly-failed send risks mailing recipients twice. The
      // error is surfaced to the owner in the schedule list.
      failed++;
      console.error(`report-schedule-cron: schedule ${s.id} failed`, err);
      await supabase.from("report_schedules")
        .update({ last_error: String((err as Error)?.message ?? err).slice(0, 500) })
        .eq("id", s.id);
    }
  }

  return new Response(JSON.stringify({ ok: true, sent, failed, skipped }), {
    headers: { "Content-Type": "application/json" },
  });
});
