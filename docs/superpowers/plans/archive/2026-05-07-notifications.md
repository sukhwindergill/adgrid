# Notifications System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build end-to-end notifications — Resend email delivery, in-app bell icon with dropdown, cron-based scheduled alerts, and expanded notification preferences.

**Architecture:** Single `send-notification` edge function handles all email + in-app notification insertion. Bell component subscribes to Supabase realtime for instant updates. A `notification-cron` edge function runs daily via Supabase cron for scheduled events. App-triggered calls fire after key user actions.

**Tech Stack:** React 19, Supabase (Postgres + Realtime + Edge Functions + Cron), Resend API

**Spec:** `docs/superpowers/specs/2026-05-07-notifications-design.md`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/20260507000001_notifications.sql` | Create | notifications table |
| `supabase/functions/send-notification/index.ts` | Create | Email + in-app notification dispatcher |
| `supabase/functions/notification-cron/index.ts` | Create | Daily cron: low budget alerts + weekly reports |
| `src/components/NotificationBell.jsx` | Create | Bell icon + dropdown component |
| `src/views/advertiser/SettingsView.jsx` | Modify | Expand NotificationsTab from 3 to 14 items |
| `src/App.jsx` | Modify | Add bell to header, wire app-triggered notification calls |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260507000001_notifications.sql`

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/20260507000001_notifications.sql`:

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "own_notifications" ON notifications
    FOR ALL USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_read_idx ON notifications(user_id, read) WHERE read = false;
```

- [ ] **Step 2: Apply via Supabase MCP or Dashboard SQL Editor**

The migration can be applied directly via the Supabase MCP tool or Dashboard → SQL Editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260507000001_notifications.sql
git commit -m "feat: notifications table migration"
```

---

## Task 2: Edge Function — send-notification

**Files:**
- Create: `supabase/functions/send-notification/index.ts`

Central dispatcher: inserts to `notifications` table always, sends email only if user's pref is enabled.

- [ ] **Step 1: Create edge function**

```bash
mkdir -p supabase/functions/send-notification
```

Create `supabase/functions/send-notification/index.ts`:

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = "notifications@adgrid.io";

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
    body: `"${d.campaignName}" has less than 20% of its budget remaining.`,
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

const INTERNAL_SECRET = Deno.env.get("INTERNAL_NOTIFICATION_SECRET") ?? "";

Deno.serve(async (req: Request) => {
  // Allow internal calls (from notification-cron) via shared secret header
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
  await supabase.from("notifications").insert({
    user_id: userId,
    type,
    title,
    body,
  });

  // Check notification pref before sending email
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, notification_prefs")
    .eq("id", userId)
    .single();

  const prefs = profile?.notification_prefs ?? {};
  if (prefs[type] === false) {
    return new Response(JSON.stringify({ ok: true, emailSent: false }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!profile?.email) {
    return new Response(JSON.stringify({ ok: true, emailSent: false }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Send email via Resend
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: profile.email,
      subject: title,
      html,
    }),
  });

  if (!res.ok) {
    console.error("Resend error:", await res.text());
  }

  return new Response(JSON.stringify({ ok: true, emailSent: res.ok }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/send-notification/index.ts
git commit -m "feat: send-notification edge function — Resend email + in-app notifications"
```

---

## Task 3: Edge Function — notification-cron

**Files:**
- Create: `supabase/functions/notification-cron/index.ts`

Runs daily. Sends low budget alerts for campaigns in their final 20% of scheduled days. Sends weekly reports every Monday.

- [ ] **Step 1: Create edge function**

```bash
mkdir -p supabase/functions/notification-cron
```

Create `supabase/functions/notification-cron/index.ts`:

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const FUNCTIONS_URL = Deno.env.get("SUPABASE_URL")!.replace(".supabase.co", ".supabase.co/functions/v1");

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

  // ── Low budget alerts ────────────────────────────────────────
  // Flag campaigns in their last 20% of scheduled days
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
    const elapsed = now - start;
    return elapsed / total >= 0.8; // last 20% of campaign duration
  });

  for (const c of lowBudgetCampaigns) {
    // Check if we already sent a low_budget notification today for this campaign
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
        campaignName: c.advertiser_name,
        appUrl: "",
      });
    }
  }

  // ── Weekly reports (Mondays only) ───────────────────────────
  if (isMonday) {
    // Advertiser weekly reports
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

      const totalSpend = (advCampaigns ?? []).reduce((s: number, c: { budget: number }) => s + (c.budget ?? 0), 0);

      await sendNotification(adv.id, "weekly_report", {
        totalScans: String((scans ?? []).length),
        activeCampaigns: String((advCampaigns ?? []).length),
        totalSpend: totalSpend.toFixed(2),
        appUrl: "",
      });
    }

    // Operator weekly revenue summaries
    const { data: operators } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "operator");

    for (const op of operators ?? []) {
      const { data: opScreens } = await supabase
        .from("screens")
        .select("id")
        .eq("operator_id", op.id);

      const screenCount = (opScreens ?? []).length;
      const screenIds = (opScreens ?? []).map((s: { id: string }) => s.id);

      let revenue = 0;
      if (screenIds.length > 0) {
        const { data: opCampaigns } = await supabase
          .from("bookings")
          .select("budget")
          .in("screen_id", screenIds)
          .eq("status", "active");
        revenue = (opCampaigns ?? []).reduce((s: number, c: { budget: number }) => s + (c.budget ?? 0), 0) * 0.4;
      }

      await sendNotification(op.id, "weekly_revenue", {
        revenue: revenue.toFixed(2),
        screenCount: String(screenCount),
        appUrl: "",
      });
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/notification-cron/index.ts
git commit -m "feat: notification-cron edge function — daily low budget + weekly reports"
```

---

## Task 4: Bell Icon Component

**Files:**
- Create: `src/components/NotificationBell.jsx`

- [ ] **Step 1: Create `src/components/NotificationBell.jsx`**

```jsx
import { useState, useEffect, useRef } from "react";
import { C, F } from "../lib/constants.js";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "../context/AuthContext.jsx";

const TYPE_ICONS = {
  campaign_approved: "✅",
  campaign_live: "▶",
  campaign_paused: "⏸",
  low_budget: "⚠️",
  campaign_ended: "🏁",
  scan_milestone: "🎯",
  weekly_report: "📊",
  payment_failed: "❌",
  new_advertiser: "👤",
  campaign_submitted: "📋",
  payout_completed: "💰",
  weekly_revenue: "📈",
  team_member_joined: "🤝",
  account_suspended: "🚫",
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!user) return;

    // Initial fetch
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => setNotifications(data ?? []));

    // Realtime subscription
    const channel = supabase
      .channel("notifications")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setNotifications((prev) => [payload.new, ...prev].slice(0, 10));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const unread = notifications.filter((n) => !n.read).length;

  async function markAllRead() {
    if (unread === 0) return;
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  async function markRead(id) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: 32, height: 32, borderRadius: "50%", border: `1px solid ${C.border}`,
          background: C.surface, cursor: "pointer", display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 15, position: "relative",
        }}
      >
        🔔
        {unread > 0 && (
          <span style={{
            position: "absolute", top: -4, right: -4,
            background: C.red, color: "#fff", borderRadius: "50%",
            width: 16, height: 16, fontSize: 9, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: F.sans,
          }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: 40, right: 0, width: 320,
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)", zIndex: 1000, overflow: "hidden",
          fontFamily: F.sans,
        }}>
          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px", borderBottom: `1px solid ${C.border}`,
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} style={{
                fontSize: 11, color: C.blue, background: "none", border: "none",
                cursor: "pointer", fontFamily: F.sans,
              }}>Mark all read</button>
            )}
          </div>

          {/* Notification rows */}
          {notifications.length === 0 ? (
            <div style={{ padding: "24px 16px", textAlign: "center", fontSize: 13, color: C.textMuted }}>
              No notifications yet
            </div>
          ) : notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => markRead(n.id)}
              style={{
                display: "flex", gap: 10, padding: "12px 16px",
                borderBottom: `1px solid ${C.border}`, cursor: "pointer",
                background: n.read ? C.surface : C.blueLight,
                transition: "background 0.15s",
              }}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>{TYPE_ICONS[n.type] ?? "🔔"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 2 }}>{n.title}</div>
                <div style={{ fontSize: 11, color: C.textSub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.body}</div>
                <div style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>{timeAgo(n.created_at)}</div>
              </div>
              {!n.read && (
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.blue, flexShrink: 0, marginTop: 4 }} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/NotificationBell.jsx
git commit -m "feat: NotificationBell component — dropdown, unread badge, realtime updates"
```

---

## Task 5: Wire Bell into App.jsx + App-Triggered Notifications

**Files:**
- Modify: `src/App.jsx`

Three changes:
1. Import and render `NotificationBell` in the header
2. Add `callNotification` helper function
3. Wire notification calls after key actions: campaign status → active, advertiser creation, payout

- [ ] **Step 1: Add import at top of App.jsx**

```jsx
import NotificationBell from "./components/NotificationBell.jsx";
```

- [ ] **Step 2: Add `callNotification` helper inside the App component**

Find the App component's state definitions (around line 1830). Add this function:

```jsx
async function callNotification(userId, type, data = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  fetch(`${SUPABASE_FUNCTIONS_URL}/send-notification`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ userId, type, data }),
  }).catch((e) => console.error("Notification error:", e));
}
```

Note: fire-and-forget (no await) — notifications should never block UI actions.

- [ ] **Step 3: Add bell to header**

Find the header right-side flex container at line ~2087 (the div containing the "screens live" badge and avatar). Add `<NotificationBell />` between the live badge and the avatar:

```jsx
<div style={{display:"flex",alignItems:"center",gap:12}}>
  <div style={{display:"flex",alignItems:"center",gap:6,padding:"4px 12px",background:C.greenSoft,border:`1px solid ${C.greenBorder}`,borderRadius:20}}>
    <Dot status="live"/>
    <span style={{fontSize:11,fontWeight:500,color:C.green,fontFamily:F.sans}}>{liveCount} screens live</span>
  </div>
  <NotificationBell />
  <div style={{width:30,height:30,borderRadius:"50%",background:C.blueSoft,border:`1px solid ${C.blueBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:600,color:C.blue,cursor:"pointer"}}>
    {(displayUser.name||"U")[0].toUpperCase()}
  </div>
</div>
```

- [ ] **Step 4: Wire campaign status change notification**

Find `onUpdate` in the App component — this handles campaign status changes. It's called from `CampaignDetail` and `OperatorCampaigns`. Find where `onUpdate` does its Supabase update (search for `supabase.from('bookings').update`). After a successful update where the new status is `"active"`, call:

```jsx
if (updated.status === "active" && updated.advertiser_id) {
  callNotification(updated.advertiser_id, "campaign_approved", {
    campaignName: updated.advertiser_name ?? updated.advertiser ?? "",
    appUrl: "",
  });
}
```

- [ ] **Step 5: Wire campaign submission notification**

Find the `AdvCreate` component's `handleSave` function (line ~1805) and the `onSave` callback where it's called (line ~2029). After the `setCampaigns` call in `onSave`, add:

```jsx
// Notify all operators of new campaign submission
supabase.from("profiles").select("id").eq("role", "operator").then(({ data: ops }) => {
  (ops ?? []).forEach((op) => {
    callNotification(op.id, "campaign_submitted", {
      advertiserName: user?.user_metadata?.name ?? profile?.name ?? "An advertiser",
      appUrl: "",
    });
  });
});
```

- [ ] **Step 6: Wire payout notification**

Find `doRealPayout` in `OperatorBillingView` (line ~1486). After the fetch call succeeds and `result.ok` is true, add:

```jsx
if (result.ok) {
  callNotification(user.id, "payout_completed", {
    amount: result.amount != null ? result.amount.toFixed(2) : "—",
    appUrl: "",
  });
}
```

Note: `user` is available via `useAuth()` — check if it's already destructured at the top of `OperatorBillingView`. If not, add `const { user } = useAuth();`.

- [ ] **Step 7: Build check**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 8: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire bell icon + app-triggered notification calls"
```

---

## Task 6: Expand Settings NotificationsTab

**Files:**
- Modify: `src/views/advertiser/SettingsView.jsx`

Replace the 3-item `items` array with all 14 notification types. Also update the default `notification_prefs` fallback.

- [ ] **Step 1: Find and replace the items array in `NotificationsTab`**

In `src/views/advertiser/SettingsView.jsx`, find:

```jsx
const items = [
  { key: "campaign_approved", label: "Campaign approved", desc: "When a new campaign is approved by the operator" },
  { key: "low_budget", label: "Low budget alert", desc: "When a campaign has less than 20% of budget remaining" },
  { key: "weekly_report", label: "Weekly performance report", desc: "Summary of scans, spend, and top campaigns" },
];
```

Replace with:

```jsx
const items = [
  { key: "campaign_approved",  label: "Campaign approved",         desc: "When your campaign is approved by the operator" },
  { key: "campaign_live",      label: "Campaign live",             desc: "When your campaign goes live on a screen" },
  { key: "campaign_paused",    label: "Campaign paused",           desc: "When your campaign is paused due to low budget" },
  { key: "low_budget",         label: "Low budget alert",          desc: "When a campaign has less than 20% of its run remaining" },
  { key: "campaign_ended",     label: "Campaign ended",            desc: "When a campaign completes its scheduled run" },
  { key: "scan_milestone",     label: "Scan milestones",           desc: "When a campaign hits 100, 500, 1k, or 5k QR scans" },
  { key: "weekly_report",      label: "Weekly performance report", desc: "Summary of scans, spend, and active campaigns every Monday" },
  { key: "payment_failed",     label: "Payment failed",            desc: "When a payment for your account fails" },
  { key: "new_advertiser",     label: "New advertiser joined",     desc: "When a new advertiser signs up (operators only)" },
  { key: "campaign_submitted", label: "Campaign submitted",        desc: "When an advertiser submits a campaign for approval (operators only)" },
  { key: "payout_completed",   label: "Payout completed",         desc: "When a payout is transferred to your bank (operators only)" },
  { key: "weekly_revenue",     label: "Weekly revenue summary",    desc: "Weekly revenue across your screen network (operators only)" },
  { key: "team_member_joined", label: "Team member joined",        desc: "When someone accepts your team invite" },
  { key: "account_suspended",  label: "Account suspended",         desc: "If your account is suspended by an operator" },
];
```

- [ ] **Step 2: Update the default prefs fallback**

In `NotificationsTab`, find:

```jsx
const [prefs, setPrefs] = useState(
  profile?.notification_prefs ?? { campaign_approved: true, low_budget: true, weekly_report: true }
);
```

Replace with:

```jsx
const [prefs, setPrefs] = useState(
  profile?.notification_prefs ?? {
    campaign_approved: true, campaign_live: true, campaign_paused: true,
    low_budget: true, campaign_ended: true, scan_milestone: true,
    weekly_report: true, payment_failed: true, new_advertiser: true,
    campaign_submitted: true, payout_completed: true, weekly_revenue: true,
    team_member_joined: true, account_suspended: true,
  }
);
```

- [ ] **Step 3: Build check**

```bash
npm run build 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add src/views/advertiser/SettingsView.jsx
git commit -m "feat: expand notification preferences to 14 types"
```

---

## Task 7: Deploy + Set Secrets

- [ ] **Step 1: Apply DB migration via Supabase MCP or Dashboard SQL Editor**

Run the SQL from `supabase/migrations/20260507000001_notifications.sql`.

- [ ] **Step 2: Set RESEND_API_KEY and INTERNAL_NOTIFICATION_SECRET secrets**

Get Resend API key from [resend.com](https://resend.com) (free account → API Keys → Create). Then set both secrets:

```bash
curl -s -X POST "https://api.supabase.com/v1/projects/hkqiuwnppxkkztacwicj/secrets" \
  -H "Authorization: Bearer REDACTED_SUPABASE_PAT" \
  -H "Content-Type: application/json" \
  -d '[{"name":"RESEND_API_KEY","value":"re_..."},{"name":"INTERNAL_NOTIFICATION_SECRET","value":"REDACTED_INTERNAL_SECRET"}]'
```

Or use the Supabase MCP to deploy directly.

- [ ] **Step 3: Deploy edge functions**

Deploy `send-notification` and `notification-cron` via Supabase MCP or CLI.

`send-notification`: verify_jwt = true
`notification-cron`: verify_jwt = false (called by cron)

- [ ] **Step 4: Set up cron job**

In Supabase Dashboard → Database → Cron Jobs → Create:
- Name: `daily-notifications`
- Schedule: `0 8 * * *` (8am UTC daily)
- Command: `SELECT net.http_post('https://hkqiuwnppxkkztacwicj.supabase.co/functions/v1/notification-cron', '{}', 'application/json');`

- [ ] **Step 5: Verify**

1. Log in as advertiser → check bell icon appears in header
2. Trigger a notification via another session (or direct Supabase insert) → confirm bell badge appears and dropdown shows it
3. Click "Mark all read" → confirm badge clears
4. Toggle off a notification type in Settings → verify the toggle persists after save

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: notifications system complete — email, bell icon, cron, preferences"
```
