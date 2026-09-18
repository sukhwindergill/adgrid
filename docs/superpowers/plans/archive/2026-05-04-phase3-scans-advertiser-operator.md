# AdGrid Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build real QR scan tracking, advertiser self-serve views (Scans & Data, Billing, Settings), and operator advertiser management with impersonation.

**Architecture:** Data-first — DB migration + edge functions first, then UI views that query real data. New views extracted as separate files imported into App.jsx. Shared style constants extracted to `src/lib/constants.js`.

**Tech Stack:** React 19, Vite, Supabase JS client, Supabase Edge Functions (Deno), Stripe API (server-side only via edge function), inline styles

**Spec:** `docs/superpowers/specs/2026-05-02-adgrid-phase3-design.md`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/constants.js` | Create | Shared color (`C`) and font (`F`) constants |
| `src/components/Placeholder.jsx` | Create | Missing stub component (fixes crash) |
| `supabase/migrations/20260504000000_phase3.sql` | Create | scans table, profiles columns, team_members table |
| `supabase/functions/scan-redirect/index.ts` | Create | QR redirect edge function |
| `supabase/functions/stripe-billing/index.ts` | Create | Stripe billing data edge function |
| `src/views/advertiser/ScansView.jsx` | Create | Advertiser Scans & Data view |
| `src/views/advertiser/BillingView.jsx` | Create | Advertiser Billing view |
| `src/views/advertiser/SettingsView.jsx` | Create | Advertiser Settings (4 tabs) |
| `src/views/operator/AdvertisersView.jsx` | Create | Operator Advertisers tab |
| `src/App.jsx` | Modify | Import new views, wire routes, add impersonate context |

---

## Task 1: Extract Shared Constants + Fix Placeholder

**Files:**
- Create: `src/lib/constants.js`
- Create: `src/components/Placeholder.jsx`
- Modify: `src/App.jsx` (remove local `C`/`F` definitions, import from constants, import Placeholder)

- [ ] **Step 1: Create `src/lib/constants.js`**

```js
export const C = {
  bg: "#f9fafb",
  surface: "#ffffff",
  blue: "#2563eb",
  blueLight: "#eff6ff",
  green: "#16a34a",
  greenLight: "#f0fdf4",
  red: "#dc2626",
  redLight: "#fef2f2",
  yellow: "#d97706",
  yellowLight: "#fffbeb",
  purple: "#7c3aed",
  purpleLight: "#f5f3ff",
  text: "#111827",
  textSub: "#6b7280",
  textMuted: "#9ca3af",
  border: "#e5e7eb",
  borderDark: "#d1d5db",
};

export const F = {
  sans: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif",
  mono: "'SF Mono','Fira Code',monospace",
};

export const SUPABASE_FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
  : "";
```

- [ ] **Step 2: Create `src/components/Placeholder.jsx`**

```jsx
import { C, F } from "../lib/constants.js";

export default function Placeholder({ title, subtitle, icon }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "100%", minHeight: 400,
      fontFamily: F.sans, color: C.textSub, gap: 12,
    }}>
      <div style={{ fontSize: 48 }}>{icon}</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: C.text }}>{title}</div>
      {subtitle && <div style={{ fontSize: 14 }}>{subtitle}</div>}
      <div style={{
        marginTop: 8, fontSize: 13, color: C.textMuted,
        background: C.bg, padding: "6px 14px", borderRadius: 20,
        border: `1px solid ${C.border}`,
      }}>Coming soon</div>
    </div>
  );
}
```

- [ ] **Step 3: In `src/App.jsx`, find the local `C` and `F` definitions and replace with imports**

At the top of App.jsx, add:
```jsx
import { C, F, SUPABASE_FUNCTIONS_URL } from "./lib/constants.js";
import Placeholder from "./components/Placeholder.jsx";
```

Then delete the local `const C = {...}` and `const F = {...}` blocks from App.jsx.

- [ ] **Step 4: Run the dev server and verify all existing views still render**

```bash
npm run dev
```

Navigate to operator overview, campaigns, analytics — confirm no visual regressions. Navigate to `advertisers` stub route — confirm Placeholder renders with icon ◉, title "Advertisers".

- [ ] **Step 5: Commit**

```bash
git add src/lib/constants.js src/components/Placeholder.jsx src/App.jsx
git commit -m "refactor: extract shared constants, define Placeholder component"
```

---

## Task 2: Database Migration

**Files:**
- Create: `supabase/migrations/20260504000000_phase3.sql`

- [ ] **Step 1: Create migration file**

```bash
mkdir -p supabase/migrations
```

Create `supabase/migrations/20260504000000_phase3.sql`:

```sql
-- ============================================================
-- Phase 3: scans table, profiles additions, team_members table
-- ============================================================

-- Profiles: add new columns (safe to run multiple times via IF NOT EXISTS workaround)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credits numeric DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rate_override numeric;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_website text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'UTC';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_prefs jsonb
  DEFAULT '{"campaign_approved": true, "low_budget": true, "weekly_report": true}';

-- Scans table
CREATE TABLE IF NOT EXISTS scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  screen_id uuid REFERENCES screens(id) ON DELETE SET NULL,
  advertiser_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  scanned_at timestamptz DEFAULT now(),
  device_type text,
  city text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  email text,
  consent boolean DEFAULT false
);

ALTER TABLE scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "advertiser_own_scans" ON scans
  FOR SELECT USING (advertiser_id = auth.uid());

CREATE POLICY IF NOT EXISTS "operator_all_scans" ON scans
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'operator')
  );

CREATE POLICY IF NOT EXISTS "service_insert_scans" ON scans
  FOR INSERT WITH CHECK (true);

-- Team members table
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  user_profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  role text DEFAULT 'viewer',
  invited_at timestamptz DEFAULT now(),
  joined_at timestamptz,
  UNIQUE(org_profile_id, user_profile_id)
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "team_member_select" ON team_members
  FOR SELECT USING (
    org_profile_id = auth.uid() OR user_profile_id = auth.uid()
  );

CREATE POLICY IF NOT EXISTS "org_admin_manage_team" ON team_members
  FOR ALL USING (org_profile_id = auth.uid());
```

- [ ] **Step 2: Apply migration via Supabase dashboard or CLI**

If using Supabase CLI:
```bash
npx supabase db push
```

If applying manually: paste the SQL into Supabase Dashboard → SQL Editor → Run.

- [ ] **Step 3: Verify tables exist**

In Supabase Dashboard → Table Editor, confirm:
- `scans` table visible with all columns
- `profiles` table has new columns (`stripe_customer_id`, `status`, `credits`, etc.)
- `team_members` table visible

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260504000000_phase3.sql
git commit -m "feat: phase3 db migration — scans, team_members, profiles additions"
```

---

## Task 3: Edge Function — scan-redirect

**Files:**
- Create: `supabase/functions/scan-redirect/index.ts`

This function receives a QR scan (GET request with `?c={campaign_id}`), logs it to the `scans` table, and redirects to the campaign's destination URL with UTM params.

- [ ] **Step 1: Create the edge function**

```bash
mkdir -p supabase/functions/scan-redirect
```

Create `supabase/functions/scan-redirect/index.ts`:

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const campaignId = url.searchParams.get("c");

  if (!campaignId) {
    return new Response("Missing campaign id", { status: 400 });
  }

  // Look up campaign
  const { data: campaign, error } = await supabase
    .from("bookings")
    .select("destination_url, screen_id, advertiser_id")
    .eq("id", campaignId)
    .single();

  if (error || !campaign) {
    return new Response("Campaign not found", { status: 404 });
  }

  const { destination_url, screen_id, advertiser_id } = campaign;

  // Derive device type from User-Agent
  const ua = req.headers.get("user-agent") ?? "";
  const device_type = /mobile|android|iphone|ipad/i.test(ua)
    ? "mobile"
    : "desktop";

  // Geolocate via CF-IPCountry header (Cloudflare) or X-Forwarded-For (best-effort)
  const city = req.headers.get("cf-ipcountry") ?? null;

  // Insert scan record
  await supabase.from("scans").insert({
    campaign_id: campaignId,
    screen_id,
    advertiser_id,
    device_type,
    city,
    utm_source: "adgrid",
    utm_medium: "ooh",
    utm_campaign: campaignId,
  });

  // Build destination URL with UTM params
  const dest = new URL(destination_url);
  if (!dest.searchParams.has("utm_source")) {
    dest.searchParams.set("utm_source", "adgrid");
    dest.searchParams.set("utm_medium", "ooh");
    dest.searchParams.set("utm_campaign", campaignId);
  }

  return Response.redirect(dest.toString(), 302);
});
```

- [ ] **Step 2: Deploy edge function**

```bash
npx supabase functions deploy scan-redirect --no-verify-jwt
```

Note: `--no-verify-jwt` because QR scanners are unauthenticated public users.

- [ ] **Step 3: Test the function**

In Supabase Dashboard → Table Editor → bookings, copy any campaign's `id`. Then:

```bash
curl -L "https://<your-project-ref>.supabase.co/functions/v1/scan-redirect?c=<campaign-id>"
```

Expected: redirects to the campaign's destination URL. In Supabase → Table Editor → scans, confirm a new row was inserted.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/scan-redirect/index.ts
git commit -m "feat: scan-redirect edge function — log scan + redirect with UTM"
```

---

## Task 4: Edge Function — stripe-billing

**Files:**
- Create: `supabase/functions/stripe-billing/index.ts`

Authenticated function — returns invoices and payment methods for the calling user's Stripe customer.

- [ ] **Step 1: Add Stripe secret key to Supabase secrets**

```bash
npx supabase secrets set STRIPE_SECRET_KEY=sk_live_...
```

(Use test key `sk_test_...` during development.)

- [ ] **Step 2: Create the edge function**

```bash
mkdir -p supabase/functions/stripe-billing
```

Create `supabase/functions/stripe-billing/index.ts`:

```ts
import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req: Request) => {
  // Verify JWT and get user id
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401 });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return new Response("Unauthorized", { status: 401 });

  // Get stripe_customer_id from profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    return new Response(JSON.stringify({ invoices: [], paymentMethods: [] }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const customerId = profile.stripe_customer_id;

  const [invoicesList, paymentMethodsList] = await Promise.all([
    stripe.invoices.list({ customer: customerId, limit: 24 }),
    stripe.paymentMethods.list({ customer: customerId, type: "card" }),
  ]);

  const invoices = invoicesList.data.map((inv) => ({
    id: inv.id,
    date: inv.created,
    description: inv.description ?? "AdGrid Campaign",
    amount: inv.amount_paid / 100,
    currency: inv.currency,
    status: inv.status,
    pdf: inv.invoice_pdf,
  }));

  const paymentMethods = paymentMethodsList.data.map((pm) => ({
    id: pm.id,
    brand: pm.card?.brand ?? "card",
    last4: pm.card?.last4 ?? "****",
    expMonth: pm.card?.exp_month,
    expYear: pm.card?.exp_year,
  }));

  return new Response(JSON.stringify({ invoices, paymentMethods }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

- [ ] **Step 3: Deploy**

```bash
npx supabase functions deploy stripe-billing
```

- [ ] **Step 4: Test**

Get a session token from the browser (Supabase Dashboard → Auth → copy a user JWT), then:

```bash
curl -H "Authorization: Bearer <jwt>" \
  https://<project-ref>.supabase.co/functions/v1/stripe-billing
```

Expected: `{"invoices": [], "paymentMethods": []}` (empty if no stripe_customer_id set yet — that's fine).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/stripe-billing/index.ts
git commit -m "feat: stripe-billing edge function — invoices and payment methods"
```

---

## Task 5: Edge Function — invite-team-member

**Files:**
- Create: `supabase/functions/invite-team-member/index.ts`

`auth.admin.inviteUserByEmail` requires the service role key — it cannot be called from the browser client. This edge function handles team invites server-side.

- [ ] **Step 1: Create edge function**

```bash
mkdir -p supabase/functions/invite-team-member
```

Create `supabase/functions/invite-team-member/index.ts`:

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401 });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return new Response("Unauthorized", { status: 401 });

  const { email, role, orgProfileId } = await req.json();
  if (!email || !orgProfileId) return new Response("Missing fields", { status: 400 });

  // Send Supabase invite
  const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email);
  if (inviteError) {
    return new Response(JSON.stringify({ error: inviteError.message }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  // Create team_members row (joined_at null until they accept)
  await supabase.from("team_members").insert({
    org_profile_id: orgProfileId,
    user_profile_id: inviteData.user.id,
    role: role ?? "viewer",
  });

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

- [ ] **Step 2: Deploy**

```bash
npx supabase functions deploy invite-team-member
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/invite-team-member/index.ts
git commit -m "feat: invite-team-member edge function"
```

---

## Task 6: Advertiser Scans & Data View

**Files:**
- Create: `src/views/advertiser/ScansView.jsx`
- Modify: `src/App.jsx` (replace `adv-audience` stub with `<ScansView/>`)

- [ ] **Step 1: Create `src/views/advertiser/ScansView.jsx`**

Note: `impersonatingId` prop comes from App.jsx — when operator is impersonating an advertiser, this is the target advertiser's user id. Null otherwise.

```jsx
import { useState, useEffect } from "react";
import { C, F } from "../../lib/constants.js";
import { supabase } from "../../lib/supabase.js";
import { useAuth } from "../../context/AuthContext.jsx";

function Card({ label, value, sub }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
      padding: "20px 24px", flex: 1, minWidth: 160, fontFamily: F.sans,
    }}>
      <div style={{ fontSize: 13, color: C.textSub, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: C.text }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function exportCSV(rows) {
  const header = ["Timestamp", "Campaign", "Screen", "Device", "City", "Email", "Consent"];
  const lines = rows.map((r) => [
    new Date(r.scanned_at).toISOString(),
    r.bookings?.advertiser_name ?? "",
    r.screens?.name ?? "",
    r.device_type ?? "",
    r.city ?? "",
    r.email ?? "",
    r.consent ? "yes" : "no",
  ].join(","));
  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "adgrid-scans.csv";
  a.click();
}

export default function ScansView({ impersonatingId }) {
  const { user } = useAuth();
  const effectiveId = impersonatingId ?? user?.id;
  const [scans, setScans] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [filterCampaign, setFilterCampaign] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!effectiveId) return;
    Promise.all([
      supabase
        .from("scans")
        .select("*, bookings(advertiser_name), screens(name)")
        .eq("advertiser_id", effectiveId)
        .order("scanned_at", { ascending: false })
        .limit(500),
      supabase
        .from("bookings")
        .select("id, advertiser_name")
        .eq("advertiser_id", effectiveId),
    ]).then(([scansRes, campRes]) => {
      setScans(scansRes.data ?? []);
      setCampaigns(campRes.data ?? []);
      setLoading(false);
    });
  }, [user]);

  const filtered = scans.filter((s) => {
    if (filterCampaign !== "all" && s.campaign_id !== filterCampaign) return false;
    if (dateFrom && new Date(s.scanned_at) < new Date(dateFrom)) return false;
    if (dateTo && new Date(s.scanned_at) > new Date(dateTo + "T23:59:59")) return false;
    return true;
  });

  const thisMonth = scans.filter((s) => {
    const d = new Date(s.scanned_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const uniqueScreens = new Set(scans.map((s) => s.screen_id).filter(Boolean)).size;

  const topCampaign = (() => {
    const counts = {};
    scans.forEach((s) => {
      if (s.campaign_id) counts[s.campaign_id] = (counts[s.campaign_id] ?? 0) + 1;
    });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (!top) return "—";
    const camp = campaigns.find((c) => c.id === top[0]);
    return camp?.advertiser_name ?? "—";
  })();

  const emailCaptures = filtered.filter((s) => s.email);

  // Build 30-day chart data
  const chartData = (() => {
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ key, label: d.toLocaleDateString("en", { month: "short", day: "numeric" }), count: 0 });
    }
    scans.forEach((s) => {
      const key = new Date(s.scanned_at).toISOString().slice(0, 10);
      const d = days.find((x) => x.key === key);
      if (d) d.count++;
    });
    return days;
  })();

  const maxCount = Math.max(...chartData.map((d) => d.count), 1);

  if (loading) return (
    <div style={{ padding: 40, fontFamily: F.sans, color: C.textSub }}>Loading scans…</div>
  );

  return (
    <div style={{ padding: "32px 40px", fontFamily: F.sans, maxWidth: 1100 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: "0 0 24px" }}>
        Scans & Data
      </h2>

      {/* Summary cards */}
      <div style={{ display: "flex", gap: 16, marginBottom: 32, flexWrap: "wrap" }}>
        <Card label="Total Scans" value={scans.length.toLocaleString()} />
        <Card label="This Month" value={thisMonth.length.toLocaleString()} />
        <Card label="Unique Screens" value={uniqueScreens} />
        <Card label="Top Campaign" value={topCampaign} />
      </div>

      {/* 30-day chart */}
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
        padding: "20px 24px", marginBottom: 24,
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 16 }}>
          Scans — last 30 days
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80 }}>
          {chartData.map((d) => (
            <div key={d.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <div style={{
                width: "100%", borderRadius: 3,
                height: `${Math.max(3, (d.count / maxCount) * 70)}px`,
                background: d.count > 0 ? C.blue : C.border,
                transition: "height 0.2s",
              }} title={`${d.label}: ${d.count}`} />
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <select
          value={filterCampaign}
          onChange={(e) => setFilterCampaign(e.target.value)}
          style={{
            border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px",
            fontFamily: F.sans, fontSize: 13, color: C.text, background: C.surface,
          }}
        >
          <option value="all">All campaigns</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.advertiser_name}</option>
          ))}
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
          style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", fontFamily: F.sans, fontSize: 13, color: C.text }} />
        <span style={{ color: C.textSub, fontSize: 13 }}>to</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
          style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", fontFamily: F.sans, fontSize: 13, color: C.text }} />
        <button
          onClick={() => exportCSV(filtered)}
          style={{
            marginLeft: "auto", padding: "7px 16px", borderRadius: 8,
            background: C.blue, color: "#fff", border: "none", cursor: "pointer",
            fontFamily: F.sans, fontSize: 13, fontWeight: 500,
          }}
        >
          Export CSV
        </button>
      </div>

      {/* Scan log table */}
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
        overflow: "hidden", marginBottom: 24,
      }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, fontSize: 14, fontWeight: 600, color: C.text }}>
          Scan Log ({filtered.length})
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.bg }}>
                {["Timestamp", "Campaign", "Screen", "Device", "City", "UTM Source"].map((h) => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: C.textSub, fontWeight: 500, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((s) => (
                <tr key={s.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "10px 16px", color: C.text, fontFamily: F.mono, fontSize: 12 }}>
                    {new Date(s.scanned_at).toLocaleString()}
                  </td>
                  <td style={{ padding: "10px 16px", color: C.text }}>{s.bookings?.advertiser_name ?? "—"}</td>
                  <td style={{ padding: "10px 16px", color: C.text }}>{s.screens?.name ?? "—"}</td>
                  <td style={{ padding: "10px 16px", color: C.textSub }}>{s.device_type ?? "—"}</td>
                  <td style={{ padding: "10px 16px", color: C.textSub }}>{s.city ?? "—"}</td>
                  <td style={{ padding: "10px 16px", color: C.textSub }}>{s.utm_source ?? "adgrid"}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: "32px 16px", textAlign: "center", color: C.textMuted }}>
                    No scans yet. QR codes on screens will log here once scanned.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Email captures */}
      {emailCaptures.length > 0 && (
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
          overflow: "hidden",
        }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, fontSize: 14, fontWeight: 600, color: C.text }}>
            Email Captures ({emailCaptures.length})
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.bg }}>
                {["Email", "Consent", "Campaign", "Date"].map((h) => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: C.textSub, fontWeight: 500, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {emailCaptures.map((s) => (
                <tr key={s.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "10px 16px", color: C.text }}>{s.email}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <span style={{
                      padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                      background: s.consent ? C.greenLight : C.redLight,
                      color: s.consent ? C.green : C.red,
                    }}>{s.consent ? "Yes" : "No"}</span>
                  </td>
                  <td style={{ padding: "10px 16px", color: C.text }}>{s.bookings?.advertiser_name ?? "—"}</td>
                  <td style={{ padding: "10px 16px", color: C.textSub, fontSize: 12 }}>
                    {new Date(s.scanned_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire into App.jsx**

Add import at top of file:
```jsx
import ScansView from "./views/advertiser/ScansView.jsx";
```

In `view()` function, replace the `adv-audience` Placeholder line with:
```jsx
if (active === "adv-audience") return <ScansView impersonatingId={impersonating?.id ?? null} />;
```

- [ ] **Step 3: Test**

Log in as advertiser → click "Scans & Data" in sidebar → confirm view renders with empty state message. If scan rows exist, confirm they appear in table. Click Export CSV → file downloads.

- [ ] **Step 4: Commit**

```bash
git add src/views/advertiser/ScansView.jsx src/App.jsx
git commit -m "feat: advertiser Scans & Data view with real Supabase data"
```

---

## Task 7: Advertiser Billing View

**Files:**
- Create: `src/views/advertiser/BillingView.jsx`
- Modify: `src/App.jsx` (replace `adv-billing` stub)

- [ ] **Step 1: Create `src/views/advertiser/BillingView.jsx`**

```jsx
import { useState, useEffect } from "react";
import { C, F, SUPABASE_FUNCTIONS_URL } from "../../lib/constants.js";
import { supabase } from "../../lib/supabase.js";

const STATUS_COLORS = {
  paid: { bg: "#f0fdf4", color: "#16a34a" },
  open: { bg: "#fffbeb", color: "#d97706" },
  failed: { bg: "#fef2f2", color: "#dc2626" },
  void: { bg: "#f9fafb", color: "#6b7280" },
};

function Badge({ status }) {
  const style = STATUS_COLORS[status] ?? STATUS_COLORS.void;
  return (
    <span style={{
      padding: "2px 9px", borderRadius: 12, fontSize: 11, fontWeight: 600,
      background: style.bg, color: style.color, textTransform: "capitalize",
    }}>{status}</span>
  );
}

export default function BillingView() {
  const [data, setData] = useState({ invoices: [], paymentMethods: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/stripe-billing`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        setError("Failed to load billing data.");
        setLoading(false);
        return;
      }

      setData(await res.json());
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return (
    <div style={{ padding: 40, fontFamily: F.sans, color: C.textSub }}>Loading billing…</div>
  );

  if (error) return (
    <div style={{ padding: 40, fontFamily: F.sans, color: C.red }}>{error}</div>
  );

  return (
    <div style={{ padding: "32px 40px", fontFamily: F.sans, maxWidth: 900 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: "0 0 28px" }}>Billing</h2>

      {/* Payment Methods */}
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
        padding: "20px 24px", marginBottom: 24,
      }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 16 }}>
          Payment Methods
        </div>
        {data.paymentMethods.length === 0 ? (
          <div style={{ color: C.textMuted, fontSize: 13 }}>No payment methods on file.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.paymentMethods.map((pm) => (
              <div key={pm.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 16px", background: C.bg, borderRadius: 8,
                border: `1px solid ${C.border}`,
              }}>
                <span style={{ fontSize: 20 }}>💳</span>
                <span style={{ fontSize: 14, fontWeight: 500, color: C.text, textTransform: "capitalize" }}>
                  {pm.brand} ···· {pm.last4}
                </span>
                <span style={{ fontSize: 13, color: C.textSub }}>
                  Expires {pm.expMonth}/{pm.expYear}
                </span>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          <a
            href="https://billing.stripe.com/p/login/test_placeholder"
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-block", padding: "8px 18px", borderRadius: 8,
              background: C.blue, color: "#fff", fontSize: 13, fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Manage Payment Methods →
          </a>
        </div>
      </div>

      {/* Invoice History */}
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
        overflow: "hidden",
      }}>
        <div style={{ padding: "14px 24px", borderBottom: `1px solid ${C.border}`, fontSize: 15, fontWeight: 600, color: C.text }}>
          Invoice History
        </div>
        {data.invoices.length === 0 ? (
          <div style={{ padding: "32px 24px", color: C.textMuted, fontSize: 13 }}>
            No invoices yet.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.bg }}>
                {["Date", "Description", "Amount", "Status", "PDF"].map((h) => (
                  <th key={h} style={{ padding: "10px 20px", textAlign: "left", color: C.textSub, fontWeight: 500, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.invoices.map((inv) => (
                <tr key={inv.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "12px 20px", color: C.text, fontFamily: F.mono, fontSize: 12 }}>
                    {new Date(inv.date * 1000).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "12px 20px", color: C.text }}>{inv.description}</td>
                  <td style={{ padding: "12px 20px", color: C.text, fontWeight: 600 }}>
                    ${inv.amount.toFixed(2)} {inv.currency.toUpperCase()}
                  </td>
                  <td style={{ padding: "12px 20px" }}><Badge status={inv.status} /></td>
                  <td style={{ padding: "12px 20px" }}>
                    {inv.pdf ? (
                      <a href={inv.pdf} target="_blank" rel="noreferrer" style={{ color: C.blue, fontSize: 12 }}>
                        Download
                      </a>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire into App.jsx**

Add import at top:
```jsx
import BillingView from "./views/advertiser/BillingView.jsx";
```

Replace in `view()` function:
```jsx
if (active === "adv-billing") return <BillingView />;
```

- [ ] **Step 3: Test**

Log in as advertiser → click Billing in sidebar → confirm view loads (shows "No invoices yet" if no Stripe customer). No JS errors in console.

- [ ] **Step 4: Commit**

```bash
git add src/views/advertiser/BillingView.jsx src/App.jsx
git commit -m "feat: advertiser Billing view wired to stripe-billing edge function"
```

---

## Task 8: Advertiser Settings View

**Files:**
- Create: `src/views/advertiser/SettingsView.jsx`
- Modify: `src/App.jsx` (replace `adv-settings` stub)

- [ ] **Step 1: Create `src/views/advertiser/SettingsView.jsx`**

```jsx
import { useState, useEffect } from "react";
import { C, F, SUPABASE_FUNCTIONS_URL } from "../../lib/constants.js";
import { supabase } from "../../lib/supabase.js";
import { useAuth } from "../../context/AuthContext.jsx";

const TIMEZONES = [
  "UTC", "America/New_York", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "Europe/London", "Europe/Paris", "Asia/Tokyo",
  "Asia/Singapore", "Australia/Sydney",
];

function TabBtn({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer",
      fontFamily: F.sans, fontSize: 13, fontWeight: 500,
      background: active ? C.blue : "transparent",
      color: active ? "#fff" : C.textSub,
      transition: "all 0.15s",
    }}>{label}</button>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Input({ value, onChange, type = "text", readOnly, placeholder }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      readOnly={readOnly}
      placeholder={placeholder}
      style={{
        width: "100%", padding: "9px 12px", border: `1px solid ${C.border}`,
        borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: C.text,
        background: readOnly ? C.bg : C.surface, boxSizing: "border-box",
      }}
    />
  );
}

function SaveBtn({ onClick, saving, label = "Save Changes" }) {
  return (
    <button onClick={onClick} disabled={saving} style={{
      padding: "9px 22px", borderRadius: 8, background: C.blue, color: "#fff",
      border: "none", cursor: saving ? "not-allowed" : "pointer",
      fontFamily: F.sans, fontSize: 13, fontWeight: 500, opacity: saving ? 0.7 : 1,
    }}>{saving ? "Saving…" : label}</button>
  );
}

// ── Profile Tab ──────────────────────────────────────────────
function ProfileTab({ profile, onSaved }) {
  const [name, setName] = useState(profile?.name ?? "");
  const [companyName, setCompanyName] = useState(profile?.company_name ?? "");
  const [companyWebsite, setCompanyWebsite] = useState(profile?.company_website ?? "");
  const [timezone, setTimezone] = useState(profile?.timezone ?? "UTC");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ name, company_name: companyName, company_website: companyWebsite, timezone })
      .eq("id", profile.id);
    setSaving(false);
    setMsg(error ? "Error saving." : "Saved.");
    if (!error) onSaved({ name, company_name: companyName, company_website: companyWebsite, timezone });
    setTimeout(() => setMsg(null), 3000);
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <Field label="Full Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Email">
        <Input value={profile?.email ?? ""} readOnly />
        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
          Change email in the Security tab.
        </div>
      </Field>
      <Field label="Company Name">
        <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Inc." />
      </Field>
      <Field label="Company Website">
        <Input value={companyWebsite} onChange={(e) => setCompanyWebsite(e.target.value)} placeholder="https://acme.com" />
      </Field>
      <Field label="Timezone">
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          style={{ width: "100%", padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: C.text, background: C.surface }}
        >
          {TIMEZONES.map((tz) => <option key={tz}>{tz}</option>)}
        </select>
      </Field>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <SaveBtn onClick={save} saving={saving} />
        {msg && <span style={{ fontSize: 13, color: msg === "Saved." ? C.green : C.red }}>{msg}</span>}
      </div>
    </div>
  );
}

// ── Security Tab ─────────────────────────────────────────────
function SecurityTab() {
  const [newEmail, setNewEmail] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  async function changeEmail() {
    if (!newEmail) return;
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setSaving(false);
    setMsg(error ? error.message : "Confirmation email sent. Check your inbox.");
    setNewEmail("");
    setTimeout(() => setMsg(null), 5000);
  }

  async function changePassword() {
    if (newPw !== confirmPw) { setMsg("Passwords do not match."); return; }
    if (newPw.length < 8) { setMsg("Password must be at least 8 characters."); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setSaving(false);
    setMsg(error ? error.message : "Password updated.");
    setCurrentPw(""); setNewPw(""); setConfirmPw("");
    setTimeout(() => setMsg(null), 4000);
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 16 }}>Change Email</div>
      <Field label="New Email">
        <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="new@email.com" />
      </Field>
      <div style={{ marginBottom: 32 }}>
        <SaveBtn onClick={changeEmail} saving={saving} label="Update Email" />
      </div>

      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 16 }}>Change Password</div>
        <Field label="New Password">
          <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
        </Field>
        <Field label="Confirm Password">
          <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
        </Field>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <SaveBtn onClick={changePassword} saving={saving} label="Update Password" />
          {msg && <span style={{ fontSize: 13, color: msg.includes("updated") || msg.includes("sent") ? C.green : C.red }}>{msg}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Notifications Tab ─────────────────────────────────────────
function NotificationsTab({ profile }) {
  const [prefs, setPrefs] = useState(
    profile?.notification_prefs ?? { campaign_approved: true, low_budget: true, weekly_report: true }
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ notification_prefs: prefs })
      .eq("id", profile.id);
    setSaving(false);
    setMsg(error ? "Error saving." : "Saved.");
    setTimeout(() => setMsg(null), 3000);
  }

  function toggle(key) {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
  }

  const items = [
    { key: "campaign_approved", label: "Campaign approved", desc: "When a new campaign is approved by the operator" },
    { key: "low_budget", label: "Low budget alert", desc: "When a campaign has less than 20% of budget remaining" },
    { key: "weekly_report", label: "Weekly performance report", desc: "Summary of scans, spend, and top campaigns" },
  ];

  return (
    <div style={{ maxWidth: 520 }}>
      {items.map((item) => (
        <div key={item.key} style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 0", borderBottom: `1px solid ${C.border}`,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{item.label}</div>
            <div style={{ fontSize: 12, color: C.textSub, marginTop: 2 }}>{item.desc}</div>
          </div>
          <div
            onClick={() => toggle(item.key)}
            style={{
              width: 44, height: 24, borderRadius: 12, cursor: "pointer",
              background: prefs[item.key] ? C.blue : C.border,
              position: "relative", transition: "background 0.2s", flexShrink: 0,
            }}
          >
            <div style={{
              position: "absolute", top: 3, left: prefs[item.key] ? 23 : 3,
              width: 18, height: 18, borderRadius: "50%", background: "#fff",
              transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }} />
          </div>
        </div>
      ))}
      <div style={{ marginTop: 20, display: "flex", gap: 12, alignItems: "center" }}>
        <SaveBtn onClick={save} saving={saving} />
        {msg && <span style={{ fontSize: 13, color: msg === "Saved." ? C.green : C.red }}>{msg}</span>}
      </div>
    </div>
  );
}

// ── Team Tab ──────────────────────────────────────────────────
function TeamTab({ profile }) {
  const [members, setMembers] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    supabase
      .from("team_members")
      .select("*, user_profile:user_profile_id(name, email)")
      .eq("org_profile_id", profile.id)
      .then(({ data }) => {
        setMembers(data ?? []);
        setLoading(false);
      });
  }, [profile.id]);

  async function invite() {
    if (!inviteEmail) return;
    // auth.admin.inviteUserByEmail requires service role — call via edge function
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/invite-team-member`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole, orgProfileId: profile.id }),
    });
    if (!res.ok) { setMsg("Error sending invite."); return; }
    setMsg("Invite sent to " + inviteEmail);
    setInviteEmail("");
    setTimeout(() => setMsg(null), 4000);
  }

  async function removeMember(id) {
    await supabase.from("team_members").delete().eq("id", id);
    setMembers((m) => m.filter((x) => x.id !== id));
  }

  if (loading) return <div style={{ color: C.textSub, fontSize: 13 }}>Loading team…</div>;

  return (
    <div style={{ maxWidth: 560 }}>
      {/* Current members */}
      {members.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 12 }}>Team Members</div>
          {members.map((m) => (
            <div key={m.id} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
              background: C.bg, borderRadius: 8, border: `1px solid ${C.border}`, marginBottom: 8,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{m.user_profile?.name ?? m.user_profile?.email}</div>
                <div style={{ fontSize: 12, color: C.textSub }}>{m.user_profile?.email}</div>
              </div>
              <span style={{
                padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600,
                background: m.role === "admin" ? C.purpleLight : C.bg,
                color: m.role === "admin" ? C.purple : C.textSub,
                textTransform: "capitalize",
              }}>{m.role}</span>
              <button onClick={() => removeMember(m.id)} style={{
                border: "none", background: "none", cursor: "pointer",
                color: C.red, fontSize: 13, padding: "4px 8px",
              }}>Remove</button>
            </div>
          ))}
        </div>
      )}

      {/* Invite */}
      <div style={{ borderTop: members.length > 0 ? `1px solid ${C.border}` : "none", paddingTop: members.length > 0 ? 20 : 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 12 }}>Invite Teammate</div>
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <input
            type="email"
            placeholder="colleague@company.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            style={{
              flex: 1, padding: "9px 12px", border: `1px solid ${C.border}`,
              borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: C.text,
            }}
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            style={{
              padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 8,
              fontFamily: F.sans, fontSize: 13, color: C.text, background: C.surface,
            }}
          >
            <option value="viewer">Viewer</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={invite} style={{
            padding: "9px 22px", borderRadius: 8, background: C.blue, color: "#fff",
            border: "none", cursor: "pointer", fontFamily: F.sans, fontSize: 13, fontWeight: 500,
          }}>Send Invite</button>
          {msg && <span style={{ fontSize: 13, color: msg.startsWith("Error") ? C.red : C.green }}>{msg}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────
export default function SettingsView() {
  // profile comes from AuthContext — no extra fetch needed
  const { profile: authProfile } = useAuth();
  const [profile, setProfile] = useState(authProfile);
  const [tab, setTab] = useState("profile");

  // Sync if authProfile loads after mount
  useEffect(() => { if (authProfile) setProfile(authProfile); }, [authProfile]);

  if (!profile) return <div style={{ padding: 40, fontFamily: F.sans, color: C.textSub }}>Loading…</div>;

  return (
    <div style={{ padding: "32px 40px", fontFamily: F.sans, maxWidth: 900 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: "0 0 24px" }}>Settings</h2>

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 4, background: C.bg, padding: 4, borderRadius: 10,
        border: `1px solid ${C.border}`, width: "fit-content", marginBottom: 32,
      }}>
        {[
          { id: "profile", label: "Profile" },
          { id: "security", label: "Security" },
          { id: "notifications", label: "Notifications" },
          { id: "team", label: "Team" },
        ].map((t) => (
          <TabBtn key={t.id} label={t.label} active={tab === t.id} onClick={() => setTab(t.id)} />
        ))}
      </div>

      {tab === "profile" && <ProfileTab profile={profile} onSaved={(updates) => setProfile((p) => ({ ...p, ...updates }))} />}
      {tab === "security" && <SecurityTab />}
      {tab === "notifications" && <NotificationsTab profile={profile} />}
      {tab === "team" && <TeamTab profile={profile} />}
    </div>
  );
}
```

- [ ] **Step 2: Wire into App.jsx**

Add import:
```jsx
import SettingsView from "./views/advertiser/SettingsView.jsx";
```

Replace in `view()`:
```jsx
if (active === "adv-settings") return <SettingsView />;
```

- [ ] **Step 3: Test**

Log in as advertiser → Settings:
- Profile tab: change company name → Save → refresh page → confirm persists
- Security tab: enter mismatched passwords → confirm error message
- Notifications: toggle off weekly report → Save → refresh → confirm saved
- Team tab: confirm empty state with invite form

- [ ] **Step 4: Commit**

```bash
git add src/views/advertiser/SettingsView.jsx src/App.jsx
git commit -m "feat: advertiser Settings — profile, security, notifications, team tabs"
```

---

## Task 9: Operator Advertisers View

**Files:**
- Create: `src/views/operator/AdvertisersView.jsx`
- Modify: `src/App.jsx` (replace `advertisers` stub, add impersonate context)

- [ ] **Step 1: Create `src/views/operator/AdvertisersView.jsx`**

```jsx
import { useState, useEffect } from "react";
import { C, F } from "../../lib/constants.js";
import { supabase } from "../../lib/supabase.js";

function StatusBadge({ status }) {
  const styles = {
    active: { bg: "#f0fdf4", color: "#16a34a" },
    suspended: { bg: "#fef2f2", color: "#dc2626" },
  };
  const s = styles[status] ?? styles.active;
  return (
    <span style={{
      padding: "2px 9px", borderRadius: 12, fontSize: 11, fontWeight: 600,
      background: s.bg, color: s.color, textTransform: "capitalize",
    }}>{status ?? "active"}</span>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        background: C.surface, borderRadius: 16, padding: 28, width: 400,
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)", fontFamily: F.sans,
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 20 }}>{title}</div>
        {children}
        <button onClick={onClose} style={{
          marginTop: 16, padding: "8px 16px", borderRadius: 8, border: `1px solid ${C.border}`,
          background: C.surface, cursor: "pointer", fontFamily: F.sans, fontSize: 13, color: C.textSub,
        }}>Cancel</button>
      </div>
    </div>
  );
}

function DetailPanel({ adv, campaigns, scans, onClose, onUpdated, onImpersonate }) {
  const [tab, setTab] = useState("overview");
  const [creditsAmount, setCreditsAmount] = useState("");
  const [rateAmount, setRateAmount] = useState(adv.rate_override ?? "");
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(null); // "credits" | "rate" | "suspend"

  const totalSpend = campaigns.reduce((s, c) => s + (c.budget ?? 0), 0);
  const activeCampaigns = campaigns.filter((c) => c.status === "active").length;
  const totalScans = scans.length;

  async function updateStatus(status) {
    setSaving(true);
    await supabase.from("profiles").update({ status }).eq("id", adv.id);
    setSaving(false);
    onUpdated({ ...adv, status });
    setModal(null);
  }

  async function addCredits() {
    const amount = parseFloat(creditsAmount);
    if (isNaN(amount)) return;
    setSaving(true);
    const newCredits = (adv.credits ?? 0) + amount;
    await supabase.from("profiles").update({ credits: newCredits }).eq("id", adv.id);
    setSaving(false);
    onUpdated({ ...adv, credits: newCredits });
    setCreditsAmount("");
    setModal(null);
  }

  async function saveRate() {
    const rate = parseFloat(rateAmount) || null;
    setSaving(true);
    await supabase.from("profiles").update({ rate_override: rate }).eq("id", adv.id);
    setSaving(false);
    onUpdated({ ...adv, rate_override: rate });
    setModal(null);
  }

  return (
    <div style={{
      position: "fixed", top: 0, right: 0, bottom: 0, width: 520,
      background: C.surface, borderLeft: `1px solid ${C.border}`,
      boxShadow: "-8px 0 32px rgba(0,0,0,0.08)", zIndex: 200,
      display: "flex", flexDirection: "column", fontFamily: F.sans,
    }}>
      {/* Header */}
      <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.text }}>{adv.name}</div>
          <div style={{ fontSize: 13, color: C.textSub }}>{adv.email} · {adv.company_name ?? "No company"}</div>
        </div>
        <StatusBadge status={adv.status} />
        <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 20, color: C.textSub }}>✕</button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", padding: "0 24px", borderBottom: `1px solid ${C.border}` }}>
        {["overview", "billing", "actions"].map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "12px 16px", border: "none", background: "none", cursor: "pointer",
            fontFamily: F.sans, fontSize: 13, fontWeight: tab === t ? 600 : 400,
            color: tab === t ? C.blue : C.textSub, textTransform: "capitalize",
            borderBottom: tab === t ? `2px solid ${C.blue}` : "2px solid transparent",
          }}>{t}</button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
        {tab === "overview" && (
          <>
            {/* KPI cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              {[
                { label: "Total Spend", value: `$${totalSpend.toLocaleString()}` },
                { label: "Active Campaigns", value: activeCampaigns },
                { label: "Total Scans", value: totalScans },
                { label: "Credits", value: `$${(adv.credits ?? 0).toFixed(2)}` },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 12, color: C.textSub }}>{label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: C.text, marginTop: 4 }}>{value}</div>
                </div>
              ))}
            </div>
            {/* Campaigns */}
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 10 }}>Campaigns</div>
            {campaigns.length === 0 ? (
              <div style={{ fontSize: 13, color: C.textMuted }}>No campaigns yet.</div>
            ) : campaigns.map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{c.advertiser_name}</div>
                  <div style={{ fontSize: 12, color: C.textSub }}>${c.budget ?? 0} budget</div>
                </div>
                <StatusBadge status={c.status} />
              </div>
            ))}
          </>
        )}

        {tab === "billing" && (
          <>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: C.textSub, marginBottom: 4 }}>Stripe Customer ID</div>
              <div style={{ fontSize: 13, color: C.text, fontFamily: F.mono }}>
                {adv.stripe_customer_id ? (
                  <a href={`https://dashboard.stripe.com/customers/${adv.stripe_customer_id}`} target="_blank" rel="noreferrer" style={{ color: C.blue }}>
                    {adv.stripe_customer_id}
                  </a>
                ) : "Not set"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 12, color: C.textSub }}>Total Spend</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>${totalSpend.toLocaleString()}</div>
              </div>
              <div style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 12, color: C.textSub }}>Credits Balance</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>${(adv.credits ?? 0).toFixed(2)}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setModal("credits")} style={{
                padding: "9px 16px", borderRadius: 8, background: C.green, color: "#fff",
                border: "none", cursor: "pointer", fontFamily: F.sans, fontSize: 13, fontWeight: 500,
              }}>+ Add Credits</button>
              <button onClick={() => setModal("rate")} style={{
                padding: "9px 16px", borderRadius: 8, background: C.surface, color: C.text,
                border: `1px solid ${C.border}`, cursor: "pointer", fontFamily: F.sans, fontSize: 13,
              }}>
                {adv.rate_override ? `CPM: $${adv.rate_override}` : "Set Custom CPM"}
              </button>
            </div>
          </>
        )}

        {tab === "actions" && (
          <>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 8 }}>Account Status</div>
              <div style={{ fontSize: 13, color: C.textSub, marginBottom: 12 }}>
                Currently: <StatusBadge status={adv.status} />
              </div>
              {adv.status !== "suspended" ? (
                <button onClick={() => setModal("suspend")} style={{
                  padding: "9px 16px", borderRadius: 8, background: C.red, color: "#fff",
                  border: "none", cursor: "pointer", fontFamily: F.sans, fontSize: 13, fontWeight: 500,
                }}>Suspend Account</button>
              ) : (
                <button onClick={() => updateStatus("active")} style={{
                  padding: "9px 16px", borderRadius: 8, background: C.green, color: "#fff",
                  border: "none", cursor: "pointer", fontFamily: F.sans, fontSize: 13, fontWeight: 500,
                }}>Reactivate Account</button>
              )}
            </div>
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 8 }}>Impersonate</div>
              <div style={{ fontSize: 13, color: C.textSub, marginBottom: 12 }}>
                View the platform as this advertiser. Your session is unchanged.
              </div>
              <button onClick={() => onImpersonate(adv)} style={{
                padding: "9px 16px", borderRadius: 8, background: C.purple, color: "#fff",
                border: "none", cursor: "pointer", fontFamily: F.sans, fontSize: 13, fontWeight: 500,
              }}>View as {adv.name} →</button>
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {modal === "credits" && (
        <Modal title="Add Credits" onClose={() => setModal(null)}>
          <input
            type="number" min="0" step="0.01"
            value={creditsAmount}
            onChange={(e) => setCreditsAmount(e.target.value)}
            placeholder="50.00"
            style={{ width: "100%", padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: F.sans, fontSize: 14, marginBottom: 12, boxSizing: "border-box" }}
          />
          <button onClick={addCredits} disabled={saving} style={{
            padding: "9px 20px", borderRadius: 8, background: C.green, color: "#fff",
            border: "none", cursor: "pointer", fontFamily: F.sans, fontSize: 13, fontWeight: 500,
          }}>{saving ? "Saving…" : "Add Credits"}</button>
        </Modal>
      )}
      {modal === "rate" && (
        <Modal title="Set Custom CPM Rate" onClose={() => setModal(null)}>
          <div style={{ fontSize: 13, color: C.textSub, marginBottom: 10 }}>Leave blank to use default rate.</div>
          <input
            type="number" min="0" step="0.01"
            value={rateAmount}
            onChange={(e) => setRateAmount(e.target.value)}
            placeholder="e.g. 12.50"
            style={{ width: "100%", padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: F.sans, fontSize: 14, marginBottom: 12, boxSizing: "border-box" }}
          />
          <button onClick={saveRate} disabled={saving} style={{
            padding: "9px 20px", borderRadius: 8, background: C.blue, color: "#fff",
            border: "none", cursor: "pointer", fontFamily: F.sans, fontSize: 13, fontWeight: 500,
          }}>{saving ? "Saving…" : "Save Rate"}</button>
        </Modal>
      )}
      {modal === "suspend" && (
        <Modal title="Suspend Account?" onClose={() => setModal(null)}>
          <div style={{ fontSize: 13, color: C.textSub, marginBottom: 16 }}>
            {adv.name}'s campaigns will be paused and they will lose access to the platform.
          </div>
          <button onClick={() => updateStatus("suspended")} disabled={saving} style={{
            padding: "9px 20px", borderRadius: 8, background: C.red, color: "#fff",
            border: "none", cursor: "pointer", fontFamily: F.sans, fontSize: 13, fontWeight: 500,
          }}>{saving ? "Suspending…" : "Yes, Suspend"}</button>
        </Modal>
      )}
    </div>
  );
}

export default function AdvertisersView({ onImpersonate }) {
  const [advertisers, setAdvertisers] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [scans, setScans] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("profiles").select("*").eq("role", "advertiser"),
      supabase.from("bookings").select("*"),
      supabase.from("scans").select("advertiser_id"),
    ]).then(([advRes, campRes, scansRes]) => {
      setAdvertisers(advRes.data ?? []);
      setCampaigns(campRes.data ?? []);
      setScans(scansRes.data ?? []);
      setLoading(false);
    });
  }, []);

  function updateAdv(updated) {
    setAdvertisers((prev) => prev.map((a) => a.id === updated.id ? updated : a));
    setSelected(updated);
  }

  const filtered = advertisers.filter((a) => {
    const matchSearch = !search || [a.name, a.email, a.company_name].some(
      (f) => f?.toLowerCase().includes(search.toLowerCase())
    );
    const matchStatus = statusFilter === "all" || (a.status ?? "active") === statusFilter;
    return matchSearch && matchStatus;
  });

  const selectedCampaigns = selected ? campaigns.filter((c) => c.advertiser_id === selected.id) : [];
  const selectedScans = selected ? scans.filter((s) => s.advertiser_id === selected.id) : [];

  if (loading) return <div style={{ padding: 40, fontFamily: F.sans, color: C.textSub }}>Loading advertisers…</div>;

  return (
    <div style={{ padding: "32px 40px", fontFamily: F.sans, maxWidth: 1100 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: "0 0 24px" }}>Advertisers</h2>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <input
          placeholder="Search name, email, company…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1, padding: "9px 14px", border: `1px solid ${C.border}`, borderRadius: 8,
            fontFamily: F.sans, fontSize: 13, color: C.text,
          }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: "9px 14px", border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: C.text, background: C.surface }}
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: C.bg }}>
              {["Name", "Email", "Company", "Status", "Total Spend", "Active Campaigns", "Joined"].map((h) => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: C.textSub, fontWeight: 500, borderBottom: `1px solid ${C.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => {
              const advCamps = campaigns.filter((c) => c.advertiser_id === a.id);
              const spend = advCamps.reduce((s, c) => s + (c.budget ?? 0), 0);
              const active = advCamps.filter((c) => c.status === "active").length;
              return (
                <tr
                  key={a.id}
                  onClick={() => setSelected(a)}
                  style={{
                    borderBottom: `1px solid ${C.border}`, cursor: "pointer",
                    background: selected?.id === a.id ? C.blueLight : "transparent",
                  }}
                >
                  <td style={{ padding: "12px 16px", fontWeight: 500, color: C.text }}>{a.name ?? "—"}</td>
                  <td style={{ padding: "12px 16px", color: C.textSub }}>{a.email}</td>
                  <td style={{ padding: "12px 16px", color: C.textSub }}>{a.company_name ?? "—"}</td>
                  <td style={{ padding: "12px 16px" }}><StatusBadge status={a.status} /></td>
                  <td style={{ padding: "12px 16px", color: C.text }}>${spend.toLocaleString()}</td>
                  <td style={{ padding: "12px 16px", color: C.text }}>{active}</td>
                  <td style={{ padding: "12px 16px", color: C.textSub, fontSize: 12 }}>
                    {a.created_at ? new Date(a.created_at).toLocaleDateString() : "—"}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: "32px 16px", textAlign: "center", color: C.textMuted }}>
                  No advertisers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail panel */}
      {selected && (
        <DetailPanel
          adv={selected}
          campaigns={selectedCampaigns}
          scans={selectedScans}
          onClose={() => setSelected(null)}
          onUpdated={updateAdv}
          onImpersonate={onImpersonate}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add impersonate state and banner to App.jsx**

In `src/App.jsx`, near the top where other state is defined (after `const [active, setActive] = useState(...)`):

```jsx
const [impersonating, setImpersonating] = useState(null); // { id, name }

function startImpersonation(adv) {
  setImpersonating({ id: adv.id, name: adv.name });
  setActive("adv-overview");
}

function stopImpersonation() {
  setImpersonating(null);
  setActive("advertisers");
}
```

- [ ] **Step 3: Add impersonation banner to App.jsx**

Find the main layout container (the outer `<div>` wrapping the sidebar and content area). Add this banner just inside it, before the sidebar:

```jsx
{impersonating && (
  <div style={{
    position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
    background: C.purple, color: "#fff", padding: "10px 20px",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 16,
    fontFamily: F.sans, fontSize: 13, fontWeight: 500,
  }}>
    <span>👁 Viewing as {impersonating.name}</span>
    <button onClick={stopImpersonation} style={{
      padding: "4px 14px", borderRadius: 20, border: "2px solid rgba(255,255,255,0.5)",
      background: "transparent", color: "#fff", cursor: "pointer",
      fontFamily: F.sans, fontSize: 12, fontWeight: 600,
    }}>Exit</button>
  </div>
)}
```

- [ ] **Step 4: Pass impersonating to view rendering**

In the `view()` function, where advertiser views are rendered, pass `impersonating` to determine whose data to show. For the `adv-overview`, `adv-campaigns`, `adv-analytics` views that query by `user.id`, update them to use `impersonating?.id ?? user.id` as the filter ID.

Find each Supabase query in these views that filters by `advertiser_id` and update:
```jsx
// Before:
.eq("advertiser_id", user.id)
// After:
.eq("advertiser_id", impersonating?.id ?? user.id)
```

Also pass `impersonating` as a prop where needed, or thread it through the existing context.

- [ ] **Step 5: Wire AdvertisersView into App.jsx**

Add import:
```jsx
import AdvertisersView from "./views/operator/AdvertisersView.jsx";
```

Replace in `view()`:
```jsx
if (active === "advertisers") return <AdvertisersView onImpersonate={startImpersonation} />;
```

When `impersonating` is set, the `view()` function should treat the role as "advertiser" — check `impersonating` before the `isAdv` role check:

```jsx
const effectiveRole = impersonating ? "advertiser" : role;
const isAdv = effectiveRole === "advertiser";
```

- [ ] **Step 6: Test**

Log in as operator → click Advertisers → confirm list loads. Click a row → detail panel opens. Check overview/billing/actions tabs render. Click Suspend → confirm modal → confirm status badge updates. Click Add Credits → enter amount → confirm balance updates. Click "View as [name]" → confirm purple banner appears, sidebar switches to advertiser nav. Click Exit → returns to operator advertisers view.

- [ ] **Step 7: Commit**

```bash
git add src/views/operator/AdvertisersView.jsx src/App.jsx
git commit -m "feat: operator Advertisers tab with detail panel, credits, suspend, impersonate"
```

---

## Task 10: Final Wiring + Smoke Test

- [ ] **Step 1: Verify all stub routes replaced**

In `src/App.jsx`, search for remaining `<Placeholder` usages. Only `adv-integrations` and `display` should remain as Placeholder (per spec, integrations is deferred). Confirm no other stubs.

- [ ] **Step 2: Test full advertiser flow**

1. Sign up as new advertiser
2. Create a campaign with a destination URL
3. Copy the scan-redirect URL: `https://<project>.supabase.co/functions/v1/scan-redirect?c=<campaign-id>`
4. Open URL in browser → confirm redirects to destination URL with UTM params
5. In AdGrid → Scans & Data → confirm scan row appears
6. In Settings → update profile → confirm saves
7. In Billing → confirm loads (empty if no Stripe customer — that's fine)

- [ ] **Step 3: Test full operator flow**

1. Log in as operator
2. Advertisers tab → find the test advertiser
3. Open detail → add $10 credits → confirm balance shows $10
4. Impersonate → confirm banner, confirm seeing advertiser's campaigns only
5. Exit → back to operator view

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: phase 3 complete — scan tracking, advertiser self-serve, operator advertiser management"
```
