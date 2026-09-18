# Screen Owner Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire screen registration to the database, implement Stripe Connect Express onboarding for operator payouts, and make payout triggering real via Stripe Transfers.

**Architecture:** Database-first — migration adds payouts table + new profile columns, then two edge functions (create-connect-account, trigger-payout), then App.jsx wiring for screen registration and billing UI. All new UI changes are inline modifications to existing ScreensView and OperatorBillingView components inside App.jsx.

**Tech Stack:** React 19, Vite, Supabase JS client, Supabase Edge Functions (Deno), Stripe API (Connect Express + Transfers)

**Spec:** `docs/superpowers/specs/2026-05-07-screen-owner-onboarding-design.md`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/20260507000000_screen_owner.sql` | Create | payouts table, screens.operator_id, profiles new columns |
| `supabase/functions/create-connect-account/index.ts` | Create | Create Stripe Connect Express account + generate onboarding link |
| `supabase/functions/trigger-payout/index.ts` | Create | Create Stripe Transfer to connected account, log to payouts table |
| `src/App.jsx` | Modify | Wire screen registration, Connect UI, payouts tab, URL param handling |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260507000000_screen_owner.sql`

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/20260507000000_screen_owner.sql`:

```sql
-- ============================================================
-- Screen Owner Onboarding: payouts table, profiles additions,
-- screens.operator_id
-- ============================================================

-- Profiles: Stripe Connect fields + owner revenue share
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_connect_account_id text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS connect_status text; -- null | 'pending' | 'active'
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS owner_revenue_share numeric DEFAULT 0.40;

-- Screens: link to operator profile
ALTER TABLE screens ADD COLUMN IF NOT EXISTS operator_id uuid REFERENCES profiles(id);

-- RLS: operators see only their own screens
CREATE POLICY IF NOT EXISTS "operator_own_screens" ON screens
  FOR ALL USING (operator_id = auth.uid());

-- Payouts table
CREATE TABLE IF NOT EXISTS payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid REFERENCES profiles(id),
  amount numeric NOT NULL,
  currency text DEFAULT 'usd',
  stripe_transfer_id text,
  status text DEFAULT 'pending', -- 'pending' | 'transferred' | 'failed'
  period_start date,
  period_end date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "operator_own_payouts" ON payouts
  FOR SELECT USING (operator_id = auth.uid());

CREATE POLICY IF NOT EXISTS "service_insert_payouts" ON payouts
  FOR INSERT WITH CHECK (true);
```

- [ ] **Step 2: Apply migration**

Apply manually in Supabase Dashboard → SQL Editor. Paste the SQL above and run.

If Supabase CLI is linked:
```bash
npx supabase db push
```

Confirm: `screens` table has `operator_id` column, `profiles` has `stripe_connect_account_id` + `connect_status` + `owner_revenue_share`, `payouts` table exists.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260507000000_screen_owner.sql
git commit -m "feat: screen owner migration — payouts table, profiles Connect fields, screens.operator_id"
```

---

## Task 2: Edge Function — create-connect-account

**Files:**
- Create: `supabase/functions/create-connect-account/index.ts`

Creates or reuses a Stripe Connect Express account for the authenticated operator, then returns a Stripe Account Link URL for hosted onboarding.

- [ ] **Step 1: Create the edge function**

```bash
mkdir -p supabase/functions/create-connect-account
```

Create `supabase/functions/create-connect-account/index.ts`:

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
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401 });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return new Response("Unauthorized", { status: 401 });

  const { returnUrl } = await req.json();
  if (!returnUrl) return new Response("Missing returnUrl", { status: 400 });

  // Get or create Connect account
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_connect_account_id, connect_status")
    .eq("id", user.id)
    .single();

  let accountId = profile?.stripe_connect_account_id;

  if (!accountId) {
    const account = await stripe.accounts.create({ type: "express" });
    accountId = account.id;

    await supabase
      .from("profiles")
      .update({ stripe_connect_account_id: accountId, connect_status: "pending" })
      .eq("id", user.id);
  }

  // Generate onboarding link
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: returnUrl + "?connect=refresh",
    return_url: returnUrl + "?connect=success",
    type: "account_onboarding",
  });

  return new Response(JSON.stringify({ url: accountLink.url }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

- [ ] **Step 2: Deploy**

```bash
npx supabase functions deploy create-connect-account
```

If CLI not linked, note for manual deploy later.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/create-connect-account/index.ts
git commit -m "feat: create-connect-account edge function — Stripe Connect Express onboarding"
```

---

## Task 3: Edge Function — trigger-payout

**Files:**
- Create: `supabase/functions/trigger-payout/index.ts`

Calculates payout for a given period, creates a Stripe Transfer to the operator's connected account, and logs to the `payouts` table.

- [ ] **Step 1: Create the edge function**

```bash
mkdir -p supabase/functions/trigger-payout
```

Create `supabase/functions/trigger-payout/index.ts`:

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
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401 });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return new Response("Unauthorized", { status: 401 });

  const { periodStart, periodEnd } = await req.json();
  if (!periodStart || !periodEnd) {
    return new Response("Missing periodStart or periodEnd", { status: 400 });
  }

  // Get operator profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_connect_account_id, connect_status, owner_revenue_share")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_connect_account_id || profile.connect_status !== "active") {
    return new Response(
      JSON.stringify({ error: "Stripe Connect account not active" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Check for existing payout in this period (prevent double-pay)
  const { data: existingPayout } = await supabase
    .from("payouts")
    .select("id")
    .eq("operator_id", user.id)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .eq("status", "transferred")
    .maybeSingle();

  if (existingPayout) {
    return new Response(
      JSON.stringify({ error: "Payout already exists for this period" }),
      { status: 409, headers: { "Content-Type": "application/json" } }
    );
  }

  // Get operator's screens
  const { data: operatorScreens } = await supabase
    .from("screens")
    .select("id")
    .eq("operator_id", user.id);

  const screenIds = (operatorScreens ?? []).map((s: { id: string }) => s.id);

  if (screenIds.length === 0) {
    return new Response(
      JSON.stringify({ error: "No screens found for this operator" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Sum campaign budgets on operator's screens within period
  const { data: campaigns } = await supabase
    .from("bookings")
    .select("budget")
    .in("screen_id", screenIds)
    .gte("start_date", periodStart)
    .lte("end_date", periodEnd);

  const totalBudget = (campaigns ?? []).reduce(
    (sum: number, c: { budget: number }) => sum + (c.budget ?? 0),
    0
  );

  const revenueShare = profile.owner_revenue_share ?? 0.40;
  const payoutAmount = Math.round(totalBudget * revenueShare * 100); // cents

  if (payoutAmount <= 0) {
    return new Response(
      JSON.stringify({ error: "Nothing to pay out for this period" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Create Stripe Transfer
  const transfer = await stripe.transfers.create({
    amount: payoutAmount,
    currency: "usd",
    destination: profile.stripe_connect_account_id,
    metadata: { operator_id: user.id, period_start: periodStart, period_end: periodEnd },
  });

  // Log payout
  await supabase.from("payouts").insert({
    operator_id: user.id,
    amount: payoutAmount / 100,
    currency: "usd",
    stripe_transfer_id: transfer.id,
    status: "transferred",
    period_start: periodStart,
    period_end: periodEnd,
  });

  return new Response(
    JSON.stringify({ ok: true, transferId: transfer.id, amount: payoutAmount / 100 }),
    { headers: { "Content-Type": "application/json" } }
  );
});
```

- [ ] **Step 2: Deploy**

```bash
npx supabase functions deploy trigger-payout
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/trigger-payout/index.ts
git commit -m "feat: trigger-payout edge function — Stripe Transfer + payouts table log"
```

---

## Task 4: Wire Screen Registration

**Files:**
- Modify: `src/App.jsx` (ScreensView component, ~lines 1017-1141)

The registration modal submit button currently just calls `setShowAdd(false)` with no DB insert. Wire it to Supabase.

- [ ] **Step 1: Read App.jsx lines 1017-1141 to locate exact submit button**

The button is at approximately line 1111:
```jsx
<Btn onClick={()=>setShowAdd(false)} disabled={!newScreen.name||!newScreen.owner}>Register Screen</Btn>
```

- [ ] **Step 2: Replace the submit button onClick with a real insert**

Find the `ScreensView` component. Add a `registerScreen` async function inside it (before the return statement), then update the button to call it:

```jsx
async function registerScreen() {
  const { data, error } = await supabase
    .from("screens")
    .insert({
      name: newScreen.name,
      owner: newScreen.owner,
      type: newScreen.type,
      city: newScreen.city,
      location: newScreen.location,
      status: "pending",
      operator_id: user.id,
    })
    .select()
    .single();

  if (error) { alert("Failed to register screen: " + error.message); return; }

  setDbScreens((prev) => [...(prev ?? []), data]);
  setNewScreen({ name: "", owner: "", type: "Business", city: "Toronto", location: "", status: "pending" });
  setShowAdd(false);
}
```

Replace the button:
```jsx
<Btn onClick={registerScreen} disabled={!newScreen.name||!newScreen.owner}>Register Screen</Btn>
```

Note: `user` comes from `useAuth()` which is already called at the top of the App component. Read App.jsx around line 1848 to find the state setter for screens — grep for `setDbScreens\|setScreens` to find the exact name, then use it in the insert callback above.

- [ ] **Step 3: Build check**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire screen registration to Supabase insert"
```

---

## Task 5: Wire Stripe Connect UI + Handle Redirect

**Files:**
- Modify: `src/App.jsx` (OperatorBillingView component + app mount effect)

Two changes:
1. Handle `?connect=success` / `?connect=refresh` URL params on app load
2. Replace "Send Onboarding Link" stub button with real "Connect Bank Account" flow

- [ ] **Step 1: Add URL param handling on mount**

Find the main app component's `useEffect` that handles auth/session (around lines 1820-1840). Add URL param detection after the existing auth logic:

```jsx
// Handle Stripe Connect redirect
const params = new URLSearchParams(window.location.search);
const connectResult = params.get("connect");
if (connectResult === "success" && user) {
  await supabase
    .from("profiles")
    .update({ connect_status: "active" })
    .eq("id", user.id);
  // Clear the query param without page reload
  window.history.replaceState({}, "", window.location.pathname);
}
```

- [ ] **Step 2: Add `connectAccount` function to OperatorBillingView**

Inside `OperatorBillingView`, add:

```jsx
async function connectAccount() {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/create-connect-account`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ returnUrl: window.location.origin }),
  });
  if (!res.ok) { alert("Failed to start onboarding."); return; }
  const { url } = await res.json();
  window.location.href = url;
}
```

- [ ] **Step 3: Update Screen Accounts tab to use connect_status**

The Screen Accounts tab currently uses mock `payouts` data to show connected status. Replace the connect-status display with real profile data.

Find the `connect` tab JSX in `OperatorBillingView` (lines ~1515-1529). Replace the "Send Onboarding Link" button logic with status-aware rendering. Add a `connectStatus` state that reads from `profile`:

```jsx
// Add near top of OperatorBillingView:
const { profile } = useAuth();
const connectStatus = profile?.connect_status ?? null;
```

Replace the tab content:

```jsx
{tab==="connect" && (
  <div>
    <div style={{padding:"12px 16px", background:C.blueSoft, border:`1px solid ${C.blueBorder}`, borderRadius:8, marginBottom:16, fontSize:12, color:C.textSub, fontFamily:F.sans}}>
      Screen owners connect their bank via Stripe Connect. ADGRID never handles their banking details — Stripe transfers funds directly to their account on payout day.
    </div>
    <div style={{padding:"20px 0"}}>
      {connectStatus === "active" ? (
        <div style={{display:"flex", alignItems:"center", gap:12}}>
          <span style={{fontSize:13, color:C.green, fontFamily:F.sans, fontWeight:600}}>✓ Bank account connected</span>
          <a
            href={`https://dashboard.stripe.com/connect/accounts/${profile?.stripe_connect_account_id}`}
            target="_blank" rel="noreferrer"
            style={{fontSize:12, color:C.blue}}>View in Stripe ↗</a>
        </div>
      ) : connectStatus === "pending" ? (
        <div style={{display:"flex", alignItems:"center", gap:12}}>
          <span style={{fontSize:13, color:C.yellow, fontFamily:F.sans}}>⏳ Onboarding incomplete</span>
          <Btn variant="ghost" size="sm" onClick={connectAccount}>Complete Setup →</Btn>
        </div>
      ) : (
        <Btn variant="stripe" onClick={connectAccount}>Connect Bank Account</Btn>
      )}
    </div>
  </div>
)}
```

- [ ] **Step 4: Build check**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: Stripe Connect onboarding UI — connect bank account button + redirect handling"
```

---

## Task 6: Wire Payouts Tab to Real Data

**Files:**
- Modify: `src/App.jsx` (OperatorBillingView component)

Replace mock `PAYOUTS` constant with real data from the `payouts` table. Wire "Pay Now" and "Run All" buttons to the `trigger-payout` edge function.

- [ ] **Step 1: Add payouts state and fetch inside OperatorBillingView**

Find `OperatorBillingView`. Add state and a fetch function:

```jsx
const [realPayouts, setRealPayouts] = useState([]);
const [payoutLoading, setPayoutLoading] = useState(false);
const [payoutMsg, setPayoutMsg] = useState(null);

useEffect(() => {
  supabase
    .from("payouts")
    .select("*")
    .order("created_at", { ascending: false })
    .then(({ data }) => setRealPayouts(data ?? []));
}, []);
```

- [ ] **Step 2: Add `doRealPayout` function**

```jsx
async function doRealPayout(periodStart, periodEnd) {
  setPayoutLoading(true);
  setPayoutMsg(null);
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/trigger-payout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ periodStart, periodEnd }),
  });
  setPayoutLoading(false);
  if (!res.ok) {
    const err = await res.json();
    setPayoutMsg({ type: "error", text: err.error ?? "Payout failed." });
    return;
  }
  const result = await res.json();
  setPayoutMsg({ type: "success", text: `Transferred $${result.amount.toFixed(2)}` });
  // Refresh payouts list
  const { data } = await supabase.from("payouts").select("*").order("created_at", { ascending: false });
  setRealPayouts(data ?? []);
}
```

- [ ] **Step 3: Replace payouts tab content**

Find the `payouts` tab in `OperatorBillingView` (lines ~1493-1512). Replace with real data:

```jsx
{tab==="payouts" && (
  <div>
    <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14}}>
      <div style={{fontSize:13, fontFamily:F.sans, color:C.textSub}}>
        {realPayouts.length === 0 ? "No payouts yet." : `${realPayouts.length} payout${realPayouts.length === 1 ? "" : "s"}`}
      </div>
      <Btn
        variant="success" size="sm"
        onClick={() => {
          const now = new Date();
          const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
          const end = now.toISOString().slice(0, 10);
          doRealPayout(start, end);
        }}
        disabled={payoutLoading}
      >
        {payoutLoading ? "Processing…" : "Run Payout for This Month"}
      </Btn>
    </div>
    {payoutMsg && (
      <div style={{
        padding:"10px 14px", borderRadius:8, marginBottom:12, fontSize:13, fontFamily:F.sans,
        background: payoutMsg.type === "success" ? C.greenSoft : C.redSoft,
        color: payoutMsg.type === "success" ? C.green : C.red,
        border: `1px solid ${payoutMsg.type === "success" ? C.greenBorder : C.redBorder}`,
      }}>
        {payoutMsg.text}
      </div>
    )}
    <Table
      columns={[
        {key:"period_start", label:"Period",   render:(v, r) => `${v} → ${r.period_end}`},
        {key:"amount",       label:"Amount",   render:v=><span style={{fontWeight:600, color:C.green}}>${(v??0).toFixed(2)}</span>},
        {key:"status",       label:"Status",   render:v=><Badge status={v}/>},
        {key:"stripe_transfer_id", label:"Transfer ID", render:v=>v ? <a href={`https://dashboard.stripe.com/transfers/${v}`} target="_blank" rel="noreferrer" style={{fontSize:11, fontFamily:F.mono, color:C.blue}}>{v.slice(0,12)}…</a> : "—"},
        {key:"created_at",   label:"Date",     render:v=>new Date(v).toLocaleDateString()},
      ]}
      rows={realPayouts}
    />
  </div>
)}
```

- [ ] **Step 4: Build check**

```bash
npm run build 2>&1 | tail -20
```

Fix any errors. Watch for: `greenSoft`, `greenBorder`, `redSoft`, `redBorder` — these are existing keys on the `C` object in App.jsx (confirmed from codebase exploration).

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire payouts tab to real data — trigger-payout edge function + payouts table"
```

---

## Task 7: Final Smoke Test

- [ ] **Step 1: Verify all mock constants still used only for fallback**

In `src/App.jsx`, grep for `PAYOUTS` — confirm it is no longer referenced in `OperatorBillingView`. The `TRANSACTIONS` mock can remain for the Charges tab (not in scope for this feature).

- [ ] **Step 2: Final build**

```bash
npm run build 2>&1
```

Must complete with no errors.

- [ ] **Step 3: Test screen registration**

1. Log in as operator
2. Navigate to Screens → click "Register Screen"
3. Fill in name + owner → click Register
4. Confirm new screen appears in list with `status: pending`
5. Confirm row exists in Supabase `screens` table with `operator_id` set

- [ ] **Step 4: Test Connect onboarding flow**

1. Navigate to Billing & Payouts → Screen Accounts tab
2. Confirm "Connect Bank Account" button shows (if connect_status is null)
3. Click → confirm redirect to Stripe (test mode)
4. Complete with Stripe test bank (routing: 110000000, account: 000123456789)
5. Confirm redirect back to app with `?connect=success` in URL
6. Confirm `connect_status = 'active'` in Supabase profiles table
7. Confirm Screen Accounts tab shows "✓ Bank account connected"

- [ ] **Step 5: Test payout**

1. With active Connect account, navigate to Payouts tab
2. Click "Run Payout for This Month"
3. Confirm success message with amount
4. Confirm Stripe Transfer appears in Stripe Dashboard (test mode)
5. Confirm row in `payouts` table with `status: transferred`

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: screen owner onboarding complete — registration, Connect, payouts"
```
