# Notifications System Design

**Date:** 2026-05-07
**Status:** Approved

## Context

AdGrid has notification preference toggles in Settings but nothing actually sends. Operators and advertisers have no visibility into important events (campaign approvals, low budget, payouts, etc.). This spec covers end-to-end notifications: email delivery via Resend, in-app bell icon with dropdown, and a cron job for scheduled notifications.

---

## Section 1: Data + Infrastructure

### New `notifications` table

Stores in-app notification history for the bell icon dropdown.

```sql
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_notifications" ON notifications
  FOR ALL USING (user_id = auth.uid());
```

### `notification_prefs` JSONB expansion

Extends existing `notification_prefs` column on `profiles`. New default value covering all trigger types:

```json
{
  "campaign_approved": true,
  "campaign_live": true,
  "campaign_paused": true,
  "low_budget": true,
  "campaign_ended": true,
  "scan_milestone": true,
  "weekly_report": true,
  "payment_failed": true,
  "new_advertiser": true,
  "campaign_submitted": true,
  "payout_completed": true,
  "weekly_revenue": true,
  "team_member_joined": true,
  "account_suspended": true
}
```

### Email provider: Resend

- API key stored as Supabase secret `RESEND_API_KEY`
- Sender: `notifications@adgrid.io` (or any verified domain)
- Simple HTML template per notification type (logo, brand color, title, body, CTA button)

---

## Section 2: Edge Functions

### `send-notification` (authenticated)

Central notification dispatcher. Called by the app after actions, and by the cron job.

**Input:**
```json
{ "userId": "uuid", "type": "campaign_approved", "data": { "campaignName": "..." } }
```

**Logic:**
1. Fetch user profile (email, `notification_prefs`)
2. Insert row into `notifications` table regardless of email pref (bell always works)
3. Check `notification_prefs[type]` — if false, skip email
4. Build HTML email from type → template map
5. Send via Resend API
6. Return `{ ok: true }`

**Notification types + templates:**

| Type | Title | Trigger |
|------|-------|---------|
| `campaign_approved` | "Your campaign is approved" | Operator approves |
| `campaign_live` | "Campaign is now live" | Campaign status → live |
| `campaign_paused` | "Campaign paused — low budget" | Budget threshold hit |
| `low_budget` | "Budget running low" | <20% remaining |
| `campaign_ended` | "Campaign has ended" | End date passed |
| `scan_milestone` | "Milestone: X scans reached" | 100/500/1k/5k scans |
| `weekly_report` | "Your weekly performance report" | Cron — every Monday |
| `payment_failed` | "Payment failed" | Stripe webhook |
| `new_advertiser` | "New advertiser signed up" | Advertiser registers |
| `campaign_submitted` | "New campaign awaiting approval" | Advertiser submits |
| `payout_completed` | "Payout of $X sent" | trigger-payout succeeds |
| `weekly_revenue` | "Weekly revenue summary" | Cron — every Monday |
| `team_member_joined` | "Team member joined" | Invite accepted |
| `account_suspended` | "Your account has been suspended" | Operator suspends |

### `notification-cron` (no JWT, called by Supabase cron)

Runs daily. Two jobs:

**Low budget check (daily):**
- Query all `active` bookings — for each, calculate spend from scans count × CPM, or use `impressions` field as proxy. If `budget` column exists and a spend tracker exists, use `(budget - spent) / budget < 0.2`. If not, flag as low budget when `impressions > (budget / cpm) * 0.8`.
- For each: check if low_budget notification already sent today (avoid repeat)
- Call `send-notification` for the advertiser

**Weekly report (Mondays only):**
- Check `EXTRACT(DOW FROM NOW()) = 1`
- For each advertiser: aggregate their campaign stats, call `send-notification` with `type: weekly_report`
- For each operator: aggregate revenue stats, call `send-notification` with `type: weekly_revenue`

---

## Section 3: Bell Icon + Notification Dropdown

### Bell component

Added to top nav bar in App.jsx (visible to all logged-in users).

**Structure:**
- Bell icon (🔔) with red badge showing unread count
- Click → dropdown panel (320px wide, max 10 notifications)
- Each row: type icon, title, body (truncated to 1 line), time ago, unread blue dot
- "Mark all read" button at top
- Click notification → marks as read via Supabase update, navigates to relevant `active` route

**Data:** `supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10)`

**Unread count:** `notifications.filter(n => !n.read).length`

**Real-time:** Supabase realtime subscription on `notifications` table so new notifications appear instantly without refresh.

### Notification preferences

Already built in Settings → Notifications. Extend the 3 existing toggles to cover all 14 types with human-readable labels and descriptions. Group by role:

**Advertiser group:** campaign_approved, campaign_live, campaign_paused, low_budget, campaign_ended, scan_milestone, weekly_report, payment_failed, team_member_joined

**Operator group:** new_advertiser, campaign_submitted, payout_completed, weekly_revenue, account_suspended

---

## App-Triggered Calls

These frontend locations call `send-notification` after their action succeeds:

| Action | Location | Type | Recipient |
|--------|----------|------|-----------|
| Operator approves campaign | OperatorCampaigns | `campaign_approved` | advertiser |
| Operator suspends advertiser | AdvertisersView actions tab | `account_suspended` | advertiser |
| Payout completes | `trigger-payout` edge function | `payout_completed` | operator |
| Advertiser creates campaign | AdvCreate | `campaign_submitted` | all operators |
| Team member accepts invite | Auth flow | `team_member_joined` | org admin |

---

## Verification

1. **Email:** Trigger a campaign approval → confirm email arrives at advertiser's address via Resend dashboard
2. **Bell icon:** Log in → trigger an action → confirm bell badge increments, dropdown shows notification
3. **Mark read:** Click "Mark all read" → confirm badge clears, dots disappear
4. **Pref respect:** Toggle off `campaign_approved` in Settings → approve campaign → confirm no email sent but notification still appears in bell
5. **Cron:** Manually invoke `notification-cron` via Supabase Dashboard → confirm low budget emails sent for qualifying campaigns
