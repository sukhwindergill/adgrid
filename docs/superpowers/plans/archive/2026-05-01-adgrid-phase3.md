# AdGrid Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build four features in order — (A) Stripe advertiser billing, (B) operator advertiser management, (C) split App.jsx into components, (D) advertiser audience/QR screen.

**Architecture:** All views currently live in `src/App.jsx` (1963 lines). Features A, B, D add new view components. Feature C extracts them into `src/components/`. Stripe payments use a Supabase Edge Function to create Checkout Sessions server-side; the frontend uses `@stripe/stripe-js` to redirect.

**Tech Stack:** React 19, Vite, Supabase (JS client + Edge Functions), Stripe.js (`@stripe/stripe-js`), existing design tokens (`C`, `F`, `Btn`, `Card`, `KPI`, `Badge`, `Inp`, `DataTable` from App.jsx)

---

## Pre-flight: Fix missing Placeholder component

**Context:** `Placeholder` is referenced at lines 1907–1910, 1920 but never defined. This causes a runtime crash today.

**Files:**
- Modify: `src/App.jsx` (add Placeholder definition near line 240 with other design components)

- [ ] **Step 1: Add Placeholder component**

Find the `const KPI` block (around line 148) and add after it:

```jsx
const Placeholder = ({title,subtitle,icon}) => (
  <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:320,gap:12}}>
    <div style={{fontSize:32,opacity:0.25}}>{icon}</div>
    <div style={{fontSize:16,fontWeight:600,color:C.text,fontFamily:F.sans}}>{title}</div>
    <div style={{fontSize:13,color:C.textSub,fontFamily:F.sans}}>{subtitle}</div>
  </div>
);
```

- [ ] **Step 2: Verify app loads without crash**

Run: `npm run dev` — navigate to any Placeholder route (adv-audience, adv-billing, advertisers). Expected: grey placeholder UI, no console errors.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "fix: add missing Placeholder component"
```

---

## Feature A: Advertiser Billing (Stripe)

### Task A1: Install Stripe.js

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

```bash
npm install @stripe/stripe-js
```

- [ ] **Step 2: Verify**

`package.json` dependencies now includes `"@stripe/stripe-js"`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @stripe/stripe-js"
```

---

### Task A2: Supabase Edge Function — create-checkout-session

**Context:** Stripe secret key must never reach the browser. Edge function receives `{ campaign_id, advertiser_email, amount_cents }`, creates a Stripe Checkout Session, returns `{ url }`. The frontend redirects to `url`.

**Files:**
- Create: `supabase/functions/create-checkout-session/index.ts`

- [ ] **Step 1: Create function file**

```
mkdir -p supabase/functions/create-checkout-session
```

Create `supabase/functions/create-checkout-session/index.ts`:

```typescript
import Stripe from "https://esm.sh/stripe@14.21.0";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const { campaign_id, advertiser_email, amount_cents, description } = await req.json();

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    customer_email: advertiser_email,
    line_items: [
      {
        price_data: {
          currency: "gbp",
          product_data: { name: description || "AdGrid Campaign" },
          unit_amount: amount_cents,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${req.headers.get("origin")}/billing?session_id={CHECKOUT_SESSION_ID}&campaign_id=${campaign_id}`,
    cancel_url: `${req.headers.get("origin")}/billing?cancelled=true`,
    metadata: { campaign_id },
  });

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});
```

- [ ] **Step 2: Deploy edge function**

```bash
npx supabase functions deploy create-checkout-session --project-ref <your-project-ref>
```

Set secret:
```bash
npx supabase secrets set STRIPE_SECRET_KEY=sk_test_... --project-ref <your-project-ref>
```

Expected: `Deployed: create-checkout-session`

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/create-checkout-session/index.ts
git commit -m "feat: add create-checkout-session edge function"
```

---

### Task A3: AdvBilling component

**Context:** Replace the `adv-billing` Placeholder with a real billing view. Shows the advertiser's campaigns with payment status, lets them pay unpaid campaigns via Stripe Checkout, and shows a success state after redirect back.

**Files:**
- Modify: `src/App.jsx` (add `AdvBilling` component ~line 1690, wire into `view()` at line 1908)

- [ ] **Step 1: Add AdvBilling component**

Insert before the `AdvCreate` function definition (search for `function AdvCreate`). Add:

```jsx
// ─────────────────────────────────────────────────────────────────────────────
// ADVERTISER BILLING
// ─────────────────────────────────────────────────────────────────────────────

function AdvBilling({ campaigns, user }) {
  const [loading, setLoading] = useState(null); // campaign id being processed
  const [error, setError]     = useState(null);

  // Parse ?session_id from URL to detect Stripe redirect back
  const params    = new URLSearchParams(window.location.search);
  const sessionId = params.get("session_id");
  const cancelled = params.get("cancelled");

  const totalBudget = campaigns.reduce((a, c) => a + (c.budget || 0), 0);
  const totalSpent  = campaigns.reduce((a, c) => a + (c.spent  || 0), 0);
  const outstanding = campaigns
    .filter(c => c.status === "scheduled" || c.status === "paused")
    .reduce((a, c) => a + (c.budget - (c.spent || 0)), 0);

  const pay = async (campaign) => {
    setLoading(campaign.id);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("create-checkout-session", {
        body: {
          campaign_id:       campaign.id,
          advertiser_email:  user.email,
          amount_cents:      Math.round((campaign.budget - (campaign.spent || 0)) * 100),
          description:       `${campaign.advertiser} — ${campaign.screen}`,
        },
      });
      if (fnErr) throw fnErr;
      window.location.href = data.url;
    } catch (e) {
      setError(e.message || "Payment failed. Try again.");
      setLoading(null);
    }
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>Billing</h2>
        <p style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans }}>Manage payments for your campaigns</p>
      </div>

      {sessionId && (
        <div style={{ padding: "12px 16px", background: C.greenSoft, border: `1px solid ${C.greenBorder}`, borderRadius: 8, marginBottom: 20, fontSize: 13, color: C.green, fontFamily: F.sans }}>
          ✓ Payment successful. Your campaign will activate shortly.
        </div>
      )}
      {cancelled && (
        <div style={{ padding: "12px 16px", background: C.amberSoft, border: `1px solid ${C.amberBorder}`, borderRadius: 8, marginBottom: 20, fontSize: 13, color: C.amber, fontFamily: F.sans }}>
          Payment cancelled. No charge was made.
        </div>
      )}
      {error && (
        <div style={{ padding: "12px 16px", background: C.redSoft, border: `1px solid ${C.redBorder}`, borderRadius: 8, marginBottom: 20, fontSize: 13, color: C.red, fontFamily: F.sans }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 28 }}>
        <KPI label="Total Budget"    value={`£${totalBudget.toLocaleString()}`}    icon="💰" />
        <KPI label="Total Spent"     value={`£${totalSpent.toLocaleString()}`}     icon="📊" />
        <KPI label="Outstanding"     value={`£${outstanding.toLocaleString()}`}    icon="⏳" color={outstanding > 0 ? C.amber : C.green} />
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.sans }}>Campaigns</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: C.surfaceAlt }}>
              {["Campaign","Screen","Budget","Spent","Remaining","Status",""].map(h => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: C.textSub, fontFamily: F.sans, borderBottom: `1px solid ${C.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", fontSize: 13, color: C.textMuted, fontFamily: F.sans }}>No campaigns yet.</td></tr>
            )}
            {campaigns.map(c => {
              const remaining = c.budget - (c.spent || 0);
              const needsPay  = (c.status === "scheduled" || c.status === "paused") && remaining > 0;
              return (
                <tr key={c.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: C.text,    fontFamily: F.sans, fontWeight: 500 }}>{c.advertiser}</td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: C.textSub, fontFamily: F.sans }}>{c.screen}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: C.text,    fontFamily: F.sans }}>£{c.budget.toLocaleString()}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: C.text,    fontFamily: F.sans }}>£{(c.spent||0).toLocaleString()}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: remaining > 0 ? C.amber : C.green, fontFamily: F.sans, fontWeight: 500 }}>£{remaining.toLocaleString()}</td>
                  <td style={{ padding: "12px 16px" }}><Badge status={c.status}/></td>
                  <td style={{ padding: "12px 16px" }}>
                    {needsPay && (
                      <Btn variant="primary" size="sm" onClick={() => pay(c)} disabled={loading === c.id}>
                        {loading === c.id ? "Redirecting…" : "Pay Now"}
                      </Btn>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Wire into view()**

Find line with `if (active==="adv-billing")` and replace the Placeholder:

```jsx
// Before:
if (active==="adv-billing")      return <Placeholder title="Billing" subtitle="Invoices and payments" icon="$"/>;

// After:
if (active==="adv-billing")      return <AdvBilling campaigns={campaigns} user={displayUser}/>;
```

- [ ] **Step 3: Verify UI renders**

`npm run dev` → sign in as advertiser → click Billing. Expected: 3 KPI cards + campaigns table. Campaigns with `scheduled`/`paused` status show "Pay Now" button.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: advertiser billing screen with Stripe Checkout"
```

---

## Feature B: Operator Advertiser Management

**Context:** Operators need to view all advertiser accounts (from `profiles` table where `role='advertiser'`), see their campaign counts/spend, and be able to toggle account status. No delete — just suspend/activate.

**Files:**
- Modify: `src/App.jsx` (add `AdvertisersView` component, wire into view())

### Task B1: AdvertisersView component

- [ ] **Step 1: Add AdvertisersView**

Insert before `function BillingView` (around line 1427). Add:

```jsx
// ─────────────────────────────────────────────────────────────────────────────
// ADVERTISERS VIEW (operator)
// ─────────────────────────────────────────────────────────────────────────────

function AdvertisersView({ campaigns }) {
  const [advertisers, setAdvertisers] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [toggling,    setToggling]    = useState(null);
  const [search,      setSearch]      = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, name, email:id, role, status")
        .eq("role", "advertiser")
        .order("name");
      setAdvertisers(data || []);
      setLoading(false);
    })();
  }, []);

  const toggle = async (adv) => {
    const next = adv.status === "suspended" ? "active" : "suspended";
    setToggling(adv.id);
    await supabase.from("profiles").update({ status: next }).eq("id", adv.id);
    setAdvertisers(prev => prev.map(a => a.id === adv.id ? { ...a, status: next } : a));
    setToggling(null);
  };

  const filtered = advertisers.filter(a =>
    !search || (a.name || "").toLowerCase().includes(search.toLowerCase())
  );

  // Aggregate campaign stats per advertiser profile id
  const statsById = campaigns.reduce((acc, c) => {
    const key = c.advertiser;
    if (!acc[key]) acc[key] = { count: 0, spend: 0 };
    acc[key].count += 1;
    acc[key].spend += c.spent || 0;
    return acc;
  }, {});

  return (
    <div style={{ maxWidth: 960 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>Advertisers</h2>
          <p style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans }}>{advertisers.length} accounts</p>
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search advertisers…"
          style={{ padding: "8px 14px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: F.sans, width: 220, color: C.text, background: C.surface }}
        />
      </div>

      {loading && <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans }}>Loading…</div>}

      {!loading && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.surfaceAlt }}>
                {["Name","Campaigns","Total Spend","Status",""].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: C.textSub, fontFamily: F.sans, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", fontSize: 13, color: C.textMuted, fontFamily: F.sans }}>No advertisers found.</td></tr>
              )}
              {filtered.map(adv => {
                const stats   = statsById[adv.name] || { count: 0, spend: 0 };
                const active  = adv.status !== "suspended";
                return (
                  <tr key={adv.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "13px 16px" }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: C.text,    fontFamily: F.sans }}>{adv.name || "—"}</div>
                    </td>
                    <td style={{ padding: "13px 16px", fontSize: 13, color: C.textSub, fontFamily: F.sans }}>{stats.count}</td>
                    <td style={{ padding: "13px 16px", fontSize: 13, color: C.text,    fontFamily: F.sans }}>£{stats.spend.toLocaleString()}</td>
                    <td style={{ padding: "13px 16px" }}>
                      <Badge status={active ? "active" : "paused"}>{active ? "Active" : "Suspended"}</Badge>
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <Btn
                        variant={active ? "danger" : "success"}
                        size="sm"
                        disabled={toggling === adv.id}
                        onClick={() => toggle(adv)}
                      >
                        {toggling === adv.id ? "…" : active ? "Suspend" : "Activate"}
                      </Btn>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add `status` column to profiles table**

Run in Supabase SQL editor:

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
```

- [ ] **Step 3: Wire into view()**

Find:
```jsx
if (active==="advertisers")  return <Placeholder title="Advertisers" subtitle="Manage advertiser accounts" icon="◉"/>;
```
Replace with:
```jsx
if (active==="advertisers")  return <AdvertisersView campaigns={campaigns}/>;
```

- [ ] **Step 4: Verify**

`npm run dev` → sign in as operator → click Advertisers. Expected: table of advertiser profiles with campaign counts, Suspend/Activate buttons working.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: operator advertiser management view"
```

---

## Feature C: Split App.jsx into components

**Context:** App.jsx is 1963 lines. Split into focused files without changing any behavior. This is a pure refactor — no logic changes.

### Task C1: Create component files

**Target structure:**
```
src/
  lib/
    supabase.js          (existing, unchanged)
    constants.js         (NEW — C, F, FONT, seed data arrays)
  context/
    AuthContext.jsx      (existing, unchanged)
  components/
    design/
      atoms.jsx          (NEW — Dot, Badge, Card, KPI, Btn, Inp, ProgressBar, DataTable, Placeholder)
      layout.jsx         (NEW — Sidebar)
    views/
      operator/
        Overview.jsx     (NEW — OperatorOverview)
        Screens.jsx      (NEW — ScreensView + AddScreenModal)
        Campaigns.jsx    (NEW — OperatorCampaigns + CampaignDetail)
        Analytics.jsx    (NEW — OperatorAnalytics)
        Audience.jsx     (NEW — AudienceView)
        Revenue.jsx      (NEW — OperatorRevenue)
        Billing.jsx      (NEW — BillingView)
        Advertisers.jsx  (NEW — AdvertisersView)
        Signals.jsx      (NEW — SignalsView)
        Integrations.jsx (NEW — IntegrationsView)
        Display.jsx      (NEW — DisplayView, if implemented)
      advertiser/
        Overview.jsx     (NEW — AdvOverview)
        Create.jsx       (NEW — AdvCreate)
        Billing.jsx      (NEW — AdvBilling)
        Audience.jsx     (NEW — AdvAudienceView, from Feature D)
  App.jsx                (shrinks to ~100 lines: nav arrays, data loading, routing only)
```

**Files:** All files listed above.

- [ ] **Step 1: Create `src/lib/constants.js`**

Move `C`, `F`, `FONT`, `SCREENS`, `INIT_CAMPAIGNS`, `CATEGORIES`, `DAYS`, `HOURS`, `OP_NAV`, `ADV_NAV`, `SCAN_DATA`, `TRANSACTIONS`, `PAYOUTS` from App.jsx into:

```js
// src/lib/constants.js
export const FONT = "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap";
export const C = { /* ... exact object from App.jsx ... */ };
export const F = { /* ... exact object from App.jsx ... */ };
// ... all seed arrays ...
export const OP_NAV = [ /* ... */ ];
export const ADV_NAV = [ /* ... */ ];
```

- [ ] **Step 2: Create `src/components/design/atoms.jsx`**

Move from App.jsx: `Dot`, `Badge`, `Card`, `KPI`, `Btn`, `Inp`, `ProgressBar`, `DataTable`, `Placeholder`. Add imports at top:

```jsx
import { useState } from "react";
import { C, F } from "../../lib/constants.js";
```

Add named exports for each component.

- [ ] **Step 3: Create `src/components/design/layout.jsx`**

Move `Sidebar` component. Imports: `{ C, F, OP_NAV, ADV_NAV }` from constants, `{ Dot }` from atoms.

- [ ] **Step 4: Create operator view files**

For each operator view, create file, cut component from App.jsx, add imports:

```jsx
// Example: src/components/views/operator/Audience.jsx
import { useState } from "react";
import { C, F, SCAN_DATA } from "../../../lib/constants.js";
import { Card, KPI, Badge, Btn, DataTable, ProgressBar } from "../../design/atoms.jsx";
export default function AudienceView() { /* ... */ }
```

Repeat for: Overview, Screens, Campaigns, Analytics, Revenue, Billing, Advertisers, Signals, Integrations.

- [ ] **Step 5: Create advertiser view files**

Same pattern for: `src/components/views/advertiser/Overview.jsx`, `Create.jsx`, `Billing.jsx`.

- [ ] **Step 6: Rewrite App.jsx as router**

App.jsx reduces to ~100 lines:

```jsx
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./context/AuthContext.jsx";
import { supabase } from "./lib/supabase.js";
import { C, F, FONT, SCREENS, INIT_CAMPAIGNS, OP_NAV, ADV_NAV } from "./lib/constants.js";
import { Sidebar } from "./components/design/layout.jsx";
import { Dot } from "./components/design/atoms.jsx";
// ... operator view imports ...
// ... advertiser view imports ...

export default function App() {
  // existing state + loadData + view() routing
}
```

- [ ] **Step 7: Verify no regressions**

`npm run dev` — click through every nav item for both operator and advertiser roles. No white screens, no console errors.

- [ ] **Step 8: Commit**

```bash
git add src/
git commit -m "refactor: split App.jsx into focused component files"
```

---

## Feature D: Advertiser Audience / QR Scan Tracking

**Context:** Advertisers see their own QR scan data — filtered version of the operator AudienceView. Only scans matching the advertiser's campaigns are shown. Consented emails are exportable.

**Files:**
- Modify: `src/App.jsx` (or `src/components/views/advertiser/Audience.jsx` if Feature C is done first)

### Task D1: AdvAudienceView component

- [ ] **Step 1: Add AdvAudienceView**

Insert before or after `AdvBilling`. `campaigns` prop used to filter scan data to the advertiser's screens.

```jsx
// ─────────────────────────────────────────────────────────────────────────────
// ADVERTISER AUDIENCE VIEW
// ─────────────────────────────────────────────────────────────────────────────

function AdvAudienceView({ campaigns }) {
  const [exportDone, setExportDone] = useState(false);

  // Filter SCAN_DATA to only scans for this advertiser's campaigns
  const advertiserNames = [...new Set(campaigns.map(c => c.advertiser))];
  const myScans         = SCAN_DATA.filter(s => advertiserNames.includes(s.advertiser));
  const consented       = myScans.filter(s => s.consent);
  const consentRate     = myScans.length > 0 ? Math.round((consented.length / myScans.length) * 100) : 0;

  const doExport = () => {
    const csv = [
      "email,screen,city,age,gender,scanned_at",
      ...consented
        .filter(s => s.email)
        .map(s => `${s.email},"${s.screen}",${s.city},${s.age || ""},${s.gender || ""},${s.ts}`),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "my-scan-leads.csv";
    a.click();
    URL.revokeObjectURL(url);
    setExportDone(true);
    setTimeout(() => setExportDone(false), 3000);
  };

  return (
    <div style={{ maxWidth: 960 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>Scans & Data</h2>
          <p style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans }}>QR code scans from your campaigns</p>
        </div>
        <Btn variant={exportDone ? "success" : "secondary"} onClick={doExport} disabled={consented.length === 0}>
          {exportDone ? "✓ Downloaded" : `Export ${consented.length} leads`}
        </Btn>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 28 }}>
        <KPI label="Total Scans"   value={myScans.length}   sub="QR code scans"       icon="📲" />
        <KPI label="Opted-In"      value={consented.length} sub="Consented to contact" icon="✉️" />
        <KPI label="Consent Rate"  value={`${consentRate}%`} sub="of all scans"        color={consentRate >= 60 ? C.green : C.amber} icon="◎" />
      </div>

      {myScans.length === 0 ? (
        <Card>
          <div style={{ padding: 32, textAlign: "center", fontSize: 13, color: C.textMuted, fontFamily: F.sans }}>
            No QR scans recorded yet. Scans appear here once your campaigns go live.
          </div>
        </Card>
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.surfaceAlt }}>
                {["Time","Screen","City","Device","Age","Gender","Consent"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: C.textSub, fontFamily: F.sans, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...myScans].reverse().map(s => (
                <tr key={s.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: C.textSub, fontFamily: F.sans, whiteSpace: "nowrap" }}>
                    {new Date(s.ts).toLocaleString("en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: C.text,    fontFamily: F.sans }}>{s.screen}</td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: C.textSub, fontFamily: F.sans }}>{s.city}</td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: C.textSub, fontFamily: F.sans }}>{s.device}</td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: C.textSub, fontFamily: F.sans }}>{s.age || "—"}</td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: C.textSub, fontFamily: F.sans }}>{s.gender || "—"}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <Badge status={s.consent ? "active" : "paused"}>{s.consent ? "Yes" : "No"}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire into view()**

Find:
```jsx
if (active==="adv-audience")     return <Placeholder title="Scans & Data" subtitle="QR leads and remarketing export" icon="◎"/>;
```
Replace with:
```jsx
if (active==="adv-audience")     return <AdvAudienceView campaigns={campaigns}/>;
```

- [ ] **Step 3: Verify**

`npm run dev` → sign in as advertiser → click "Scans & Data". Expected: 3 KPI cards + scans table filtered to current advertiser's campaigns. Export button downloads CSV of consented leads.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: advertiser audience view with QR scan data and CSV export"
```

---

## Verification Checklist

After all features complete:

- [ ] Sign in as **advertiser** → Billing tab shows campaign table + Pay Now → Stripe Checkout redirect works → success message shown on return
- [ ] Sign in as **advertiser** → Scans & Data tab shows filtered scans + Export CSV downloads
- [ ] Sign in as **operator** → Advertisers tab shows profiles table + Suspend/Activate toggles update DB
- [ ] Sign in as **operator** → all existing tabs (Screens, Campaigns, Analytics, etc.) still render correctly
- [ ] `npm run build` exits with no errors
- [ ] No Placeholder stubs remaining for implemented features (grep: `Placeholder title=` → only adv-integrations and adv-settings should remain)
