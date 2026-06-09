# AdGrid Phase 3 Design: QR Scan Tracking + Advertiser Self-Serve + Operator Advertiser Management

**Date:** 2026-05-02  
**Status:** Approved

## Context

AdGrid is a two-sided OOH advertising marketplace. The operator dashboard and advertiser campaign creation are functional (Phases 1–2). Phase 3 completes the product loop by:

1. Replacing mock scan data with real QR scan tracking via a redirect edge function
2. Building out stubbed advertiser views (Scans & Data, Billing, Settings)
3. Completing the operator Advertisers tab with full account management

Without this, advertisers have no visibility into campaign performance, no self-serve billing, and operators cannot manage advertiser accounts.

---

## Approach

**Data-first, then UI.** Build the `scans` table and `scan-redirect` edge function before building UI views, so all views are wired to real data from day one. No rework.

---

## Section 1: Data Foundation

### New Supabase Table: `scans`

```sql
CREATE TABLE scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  screen_id uuid REFERENCES screens(id) ON DELETE SET NULL,
  advertiser_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  scanned_at timestamptz DEFAULT now(),
  device_type text,          -- 'mobile' | 'desktop' | 'unknown'
  city text,                 -- best-effort from IP geolocation
  utm_source text,
  utm_medium text,
  utm_campaign text,
  email text,                -- null unless captured downstream
  consent boolean DEFAULT false
);

-- RLS: advertisers see only their own scans
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "advertiser_scans" ON scans
  FOR SELECT USING (advertiser_id = auth.uid());
CREATE POLICY "operator_scans" ON scans
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'operator')
  );
```

### Profiles Table Additions

```sql
ALTER TABLE profiles ADD COLUMN stripe_customer_id text;
ALTER TABLE profiles ADD COLUMN status text DEFAULT 'active'; -- 'active' | 'suspended'
ALTER TABLE profiles ADD COLUMN credits numeric DEFAULT 0;
ALTER TABLE profiles ADD COLUMN rate_override numeric;        -- custom CPM, null = use default
ALTER TABLE profiles ADD COLUMN company_name text;
ALTER TABLE profiles ADD COLUMN company_website text;
ALTER TABLE profiles ADD COLUMN timezone text DEFAULT 'UTC';
ALTER TABLE profiles ADD COLUMN logo_url text;
ALTER TABLE profiles ADD COLUMN notification_prefs jsonb DEFAULT '{"campaign_approved": true, "low_budget": true, "weekly_report": true}';
```

### New Edge Function: `scan-redirect`

- **URL:** `GET /functions/v1/scan-redirect?c={campaign_id}`
- **Flow:**
  1. Look up `bookings` row by `campaign_id` → get `destination_url`, `screen_id`, `advertiser_id`
  2. Parse `User-Agent` → derive `device_type`
  3. Geolocate IP → derive `city` (best-effort, fail silently)
  4. Await insert into `scans` (blocking — ensures no data loss, adds ~10ms before redirect)
  5. Return `HTTP 302` → `destination_url` (with UTM params appended if not already present: `utm_source=adgrid&utm_medium=ooh&utm_campaign={campaign_id}`)
- **QR codes** on screens point to this endpoint. Existing `destination_url` in `bookings` remains the final destination.

### New Edge Function: `stripe-billing`

- **URL:** `GET /functions/v1/stripe-billing`
- Authenticated — reads `stripe_customer_id` from calling user's profile
- Returns: `{ invoices: [...], paymentMethods: [...] }` pulled live from Stripe API
- Used by advertiser Billing view

---

## Section 2: Advertiser Self-Serve Views

### Scans & Data (`/advertiser/scans`)

**Summary cards (top):**
- Total scans (all time)
- Scans this month
- Unique screens hit
- Top performing campaign

**Timeline chart:**
- Scans per day, last 30 days, filterable by campaign

**Filters:** campaign dropdown, date range picker

**Scan log table:**
- Columns: Timestamp, Campaign, Screen Location, Device, City, UTM Source
- Paginated, sortable

**Email capture sub-section:**
- Table of rows where `email IS NOT NULL`
- Columns: Email, Consent, Campaign, Date
- CSV export button (downloads full filtered scan log)

**Data source:** `scans` table, filtered by `advertiser_id = auth.uid()`

---

### Billing (`/advertiser/billing`)

**Payment Methods section:**
- Cards on file: last 4 digits, brand, expiry
- Add card button → Stripe hosted payment method flow
- Remove card button

**Invoice History table:**
- Columns: Date, Description, Amount, Status (paid/open/failed), PDF
- PDF link → Stripe-hosted invoice PDF
- Paginated, newest first

**Data source:** `stripe-billing` edge function → live Stripe API

---

### Settings (`/advertiser/settings`)

Four tabbed sub-sections:

**Profile tab:**
- Name, email (read-only, change via Security tab), company name, company website, timezone selector, logo upload (stored in Supabase Storage → `logo_url` on profile)

**Security tab:**
- Change password (current password + new password + confirm) via Supabase `auth.updateUser`
- Change email (triggers Supabase confirmation flow)

**Notifications tab:**
- Toggles: Campaign approved, Low budget alert (<20% remaining), Weekly performance report
- Stored as `notification_prefs` JSONB on profile

**Team tab:**
- List of team members (name, email, role, joined date)
- Invite by email → sends Supabase invite, default role `viewer`
- Roles: `admin` (full access), `viewer` (read-only)
- Remove member button
- Requires new `team_members` table: `(id, org_profile_id, user_profile_id, role, invited_at, joined_at)`

---

## Section 3: Operator Advertisers Tab (`/operator/advertisers`)

### List View

Table columns: Name, Email, Company, Status, Total Spend, Active Campaigns, Joined  
- Search by name/email
- Filter by status (active / suspended / all)
- Click row → detail panel slides in (or separate route `/operator/advertisers/:id`)

### Advertiser Detail Panel

**Header:** Name, email, company, avatar/logo, status badge, joined date

**Tabs:**

**Overview tab:**
- KPI cards: total spend, active campaigns, total scans, credits remaining
- Recent campaigns list (name, status, budget, spend)

**Billing tab:**
- Stripe customer ID (linked to Stripe dashboard)
- Total spend summary
- Last payment date + amount
- Credits balance with "Add Credits" button → modal with amount input → updates `profiles.credits`
- Rate override: current CPM rate with "Set Custom Rate" → modal → updates `profiles.rate_override`

**Actions tab:**
- Approve / Suspend toggle (updates `profiles.status`)
- Suspend shows confirmation modal with optional reason
- **Impersonate:** "View as Advertiser" button
  - Sets React context flag `{ impersonating: true, targetId: advertiser.id }`
  - Loads advertiser dashboard scoped to target advertiser's data
  - Persistent banner: "Viewing as [Name] — Click to exit"
  - Exit clears flag, returns to operator view
  - No actual auth switch — operator stays logged in, data is filtered by `targetId`

---

## Verification

1. **Scan redirect:** Deploy edge function, update a test campaign's QR URL, scan it → confirm row appears in `scans` table, confirm redirect lands on correct destination URL with UTM params
2. **Scans & Data view:** Log in as advertiser → navigate to Scans & Data → confirm scan log shows real rows, CSV export downloads correctly
3. **Billing view:** Log in as advertiser with Stripe customer ID → navigate to Billing → confirm invoices and payment methods load from Stripe
4. **Settings:** Update profile fields, change password, toggle notifications, invite team member → confirm all persist correctly
5. **Operator Advertisers tab:** Log in as operator → view advertiser list → open detail → suspend advertiser → confirm status updates → add credits → confirm balance change → impersonate → confirm banner shows and data scoped correctly
