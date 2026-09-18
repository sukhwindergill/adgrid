# Operator Payout Pipeline Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken operator payout pipeline so money actually flows from advertisers → platform → operators → banks, and add physical screen display setup to the screen-agent.

**Architecture:** Auto-trigger Stripe Transfers to each operator's Connect account inside `charge-campaign` immediately after payment succeeds. Budget is split proportionally by screen count per operator. A new `operator_transfers` table logs each per-campaign transfer. The existing `operator-billing?action=payout` (Connect→bank) continues to work unchanged once Connect accounts have a balance. The `trigger-payout` function gets its payment filter and currency bugs fixed as a safety net for admin backfills. Screen agent gets a kiosk autostart systemd service + README instructions.

**Tech Stack:** Deno/TypeScript edge functions, Stripe Node SDK (via ESM), Supabase JS client, systemd (Raspberry Pi / mini-PC)

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/charge-campaign/index.ts` | Modify | Add per-operator transfer after successful payment |
| `supabase/migrations/2026-06-30-operator-transfers.sql` | Create | `operator_transfers` table to log per-campaign per-operator transfers |
| `supabase/functions/trigger-payout/index.ts` | Modify | Fix: add `payment_status='paid'` filter, fix GBP→booking currency, fix revenue math to `budget × (1−0.12) × revenueShare` |
| `screen-agent/display/adgrid-display.service` | Create | systemd unit for kiosk Chromium autostart |
| `screen-agent/README.md` | Modify | Add "Display Setup" section with kiosk instructions |

---

## Task 1: Migration — operator_transfers table

**Files:**
- Create: `supabase/migrations/20260630000002_operator_transfers.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Logs per-campaign Stripe Transfers from platform account → operator Connect account.
-- One row per (booking_id, operator_id) pair. Prevents double-transfer via unique constraint.
CREATE TABLE IF NOT EXISTS operator_transfers (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id         uuid NOT NULL REFERENCES bookings(id),
  operator_id        uuid NOT NULL REFERENCES profiles(id),
  amount             numeric NOT NULL,          -- in major currency units (dollars)
  currency           text NOT NULL,
  stripe_transfer_id text UNIQUE,
  status             text NOT NULL DEFAULT 'transferred',
  screen_count       int  NOT NULL DEFAULT 1,   -- screens this operator had in the campaign
  total_screens      int  NOT NULL DEFAULT 1,   -- total screens in the campaign
  created_at         timestamptz DEFAULT now()
);

-- Prevent double-transfer for same booking+operator
CREATE UNIQUE INDEX IF NOT EXISTS operator_transfers_booking_operator
  ON operator_transfers (booking_id, operator_id);

ALTER TABLE operator_transfers ENABLE ROW LEVEL SECURITY;

-- Operators can read their own transfer records
CREATE POLICY "operator_own_transfers" ON operator_transfers
  FOR SELECT USING (operator_id = auth.uid());

-- Service role inserts
CREATE POLICY "service_insert_transfers" ON operator_transfers
  FOR INSERT WITH CHECK (true);
```

- [ ] **Step 2: Apply via Supabase MCP**

Use `mcp__e1184fa8__apply_migration` with the SQL above. Confirm the table appears in `list_tables`.

- [ ] **Step 3: Commit**

```
git add supabase/migrations/20260630000002_operator_transfers.sql
git commit -m "feat(db): add operator_transfers table for per-campaign payout tracking"
```

---

## Task 2: Auto-transfer to operators inside charge-campaign

**Files:**
- Modify: `supabase/functions/charge-campaign/index.ts`

The transfer logic runs after `paymentIntent.status === "succeeded"` and before the final success response. It:
1. Queries `campaign_screens` to find all screens in this booking
2. Groups screens by `operator_id` via a join on `screens`
3. For each operator with an active Connect account, computes their proportional share and creates a Stripe Transfer

The platform fee is 12%. Operator revenue share defaults to `profiles.owner_revenue_share` (default 0.40). Effective operator cut = `budget × 0.88 × revenueShare × (operatorScreens / totalScreens)`.

- [ ] **Step 1: Replace the success block in charge-campaign**

Find the existing success update block (after `paymentIntent.status !== "succeeded"` check, around line 215) and replace it with the expanded version below.

Replace this existing block:
```typescript
  await supabase
    .from("bookings")
    .update({
      status: "scheduled",
      payment_intent_id: paymentIntent.id,
      payment_status: "paid",
      currency,
    })
    .eq("id", campaign_id);

  // Payment only marks the booking paid. Screen approval stays with the
  // operator (or a screen's auto_approve flag at booking creation) —
  // display-feed requires both payment_status='paid' and an approved
  // campaign_screens row before the campaign airs.

  return new Response(
    JSON.stringify({ success: true, payment_intent_id: paymentIntent.id }),
    { headers: { "Content-Type": "application/json" } },
  );
```

With:
```typescript
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
  distributeOperatorCuts(campaign_id, booking.budget, currency).catch((e) =>
    console.error("[charge-campaign] operator transfer error:", e)
  );

  return new Response(
    JSON.stringify({ success: true, payment_intent_id: paymentIntent.id }),
    { headers: { "Content-Type": "application/json" } },
  );
```

- [ ] **Step 2: Add distributeOperatorCuts function above Deno.serve**

Add this function before `Deno.serve(...)`:

```typescript
const PLATFORM_FEE_RATE = 0.12;

async function distributeOperatorCuts(
  bookingId: string,
  budget: number,
  currency: string,
): Promise<void> {
  // 1. Find all screens for this campaign
  const { data: csRows } = await supabase
    .from("campaign_screens")
    .select("screen_id")
    .eq("campaign_id", bookingId);

  if (!csRows || csRows.length === 0) return;

  const screenIds = csRows.map((r: { screen_id: string }) => r.screen_id);
  const totalScreens = screenIds.length;

  // 2. Fetch operator info for each screen
  const { data: screenRows } = await supabase
    .from("screens")
    .select("id, operator_id")
    .in("id", screenIds);

  if (!screenRows || screenRows.length === 0) return;

  // 3. Group screens by operator
  const byOperator = new Map<string, number>();
  for (const s of screenRows as { id: string; operator_id: string }[]) {
    if (!s.operator_id) continue;
    byOperator.set(s.operator_id, (byOperator.get(s.operator_id) ?? 0) + 1);
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
  const netBudget = budget * (1 - PLATFORM_FEE_RATE);

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

    const revenueShare = profile.owner_revenue_share ?? 0.40;
    const operatorCut = netBudget * revenueShare * (operatorScreenCount / totalScreens);
    const amountCents = Math.round(operatorCut * 100);

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
            total_screens: String(totalScreens),
          },
        },
        { idempotencyKey },
      );

      // Log the transfer (ON CONFLICT DO NOTHING via the unique index)
      await supabase.from("operator_transfers").upsert(
        {
          booking_id: bookingId,
          operator_id: profile.id,
          amount: amountCents / 100,
          currency,
          stripe_transfer_id: transfer.id,
          status: "transferred",
          screen_count: operatorScreenCount,
          total_screens: totalScreens,
        },
        { onConflict: "booking_id,operator_id" },
      );
    } catch (e) {
      console.error(
        `[charge-campaign] transfer failed for operator ${profile.id}:`,
        e instanceof Error ? e.message : e,
      );
      // Log the failure so it can be retried via trigger-payout admin flow
      await supabase.from("operator_transfers").upsert(
        {
          booking_id: bookingId,
          operator_id: profile.id,
          amount: amountCents / 100,
          currency,
          stripe_transfer_id: null,
          status: "failed",
          screen_count: operatorScreenCount,
          total_screens: totalScreens,
        },
        { onConflict: "booking_id,operator_id" },
      );
    }
  }
}
```

- [ ] **Step 3: Deploy the function**

```bash
supabase functions deploy charge-campaign
```

Expected: `Deployed charge-campaign` with no errors.

- [ ] **Step 4: Smoke-test in Stripe test mode**

Manually charge a test campaign via the app. Then check:
```sql
SELECT * FROM operator_transfers ORDER BY created_at DESC LIMIT 5;
```
Confirm a row with `status = 'transferred'` and a real `stripe_transfer_id` appears.

- [ ] **Step 5: Commit**

```
git add supabase/functions/charge-campaign/index.ts
git commit -m "feat(payments): auto-transfer operator cut on successful charge"
```

---

## Task 3: Fix trigger-payout (backfill safety net)

`trigger-payout` is no longer the primary path but is kept for admin backfills of failed transfers. Fix its three bugs.

**Files:**
- Modify: `supabase/functions/trigger-payout/index.ts`

- [ ] **Step 1: Fix the bookings query — add payment_status filter and correct revenue math**

Find the bookings query (lines 82-89) and the payout calculation (lines 91-97). Replace:

```typescript
  // Sum campaign budgets within period
  const { data: campaigns } = campaignIds.length > 0
    ? await supabase
        .from("bookings")
        .select("budget")
        .in("id", campaignIds)
        .gte("start_date", periodStart)
        .lte("end_date", periodEnd)
    : { data: [] };

  const totalBudget = (campaigns ?? []).reduce(
    (sum: number, c: { budget: number }) => sum + (c.budget ?? 0),
    0
  );

  const revenueShare = profile.owner_revenue_share ?? 0.40;
  const payoutAmount = Math.round(totalBudget * revenueShare * 100); // cents
```

With:

```typescript
  // Sum PAID campaign budgets within period (exclude failed/refunded)
  const { data: campaigns } = campaignIds.length > 0
    ? await supabase
        .from("bookings")
        .select("budget, currency")
        .in("id", campaignIds)
        .gte("start_date", periodStart)
        .lte("end_date", periodEnd)
        .eq("payment_status", "paid")
    : { data: [] };

  const totalBudget = (campaigns ?? []).reduce(
    (sum: number, c: { budget: number }) => sum + (c.budget ?? 0),
    0
  );

  // Derive currency from the first booking (platform only charges one currency per operator)
  const payoutCurrency = (campaigns as { currency?: string }[])[0]?.currency ?? "cad";

  const PLATFORM_FEE_RATE = 0.12;
  const revenueShare = profile.owner_revenue_share ?? 0.40;
  // Match Revenue.jsx math: budget × (1 - platformFee) × revenueShare
  const payoutAmount = Math.round(totalBudget * (1 - PLATFORM_FEE_RATE) * revenueShare * 100); // cents
```

- [ ] **Step 2: Fix the hardcoded "gbp" currency in the transfer and payout log**

Find these two lines (around line 107-119) and replace both `"gbp"` occurrences with `payoutCurrency`:

```typescript
  // Create Stripe Transfer
  const transfer = await stripe.transfers.create({
    amount: payoutAmount,
    currency: payoutCurrency,
    destination: profile.stripe_connect_account_id,
    metadata: { operator_id: user.id, period_start: periodStart, period_end: periodEnd },
  });

  // Log payout
  await supabase.from("payouts").insert({
    operator_id: user.id,
    amount: payoutAmount / 100,
    currency: payoutCurrency,
    stripe_transfer_id: transfer.id,
    status: "transferred",
    period_start: periodStart,
    period_end: periodEnd,
  });
```

- [ ] **Step 3: Deploy**

```bash
supabase functions deploy trigger-payout
```

- [ ] **Step 4: Commit**

```
git add supabase/functions/trigger-payout/index.ts
git commit -m "fix(payments): trigger-payout — paid filter, correct revenue math, dynamic currency"
```

---

## Task 4: Fix Revenue.jsx math to match payout reality

The UI currently shows operators get `budget × 0.88 × 0.40`. After Task 3 this is now the correct formula. But the Billing.jsx `ownerShare` display should also reflect this. Both already use `budget * 0.88 * 0.40`, so no change needed there. Verify:

- [ ] **Step 1: Confirm Revenue.jsx line 33 already matches**

Check [`src/views/operator/Revenue.jsx:33`](src/views/operator/Revenue.jsx:33):
```js
const owners = Math.round(total * 0.88 * 0.40);
```
This is correct. No change needed.

- [ ] **Step 2: Confirm Billing.jsx line 51 already matches**

Check [`src/views/operator/Billing.jsx:51`](src/views/operator/Billing.jsx:51):
```js
const ownerShare = Math.round(totalCharged * 0.88 * 0.40);
```
Correct. No change needed.

No code changes required for this task. ✅

---

## Task 5: Screen-agent display setup — systemd unit + README

The screen-agent docker-compose handles camera/CV/impression tracking only. The actual ad display (`DisplayPlayer.jsx`) runs in a browser at `https://<your-app>.vercel.app/display/<SCREEN_TOKEN>`. Physical screens need Chromium in kiosk mode autostarted on boot.

**Files:**
- Create: `screen-agent/display/adgrid-display.service`
- Modify: `screen-agent/README.md`

- [ ] **Step 1: Create systemd unit file**

```ini
# screen-agent/display/adgrid-display.service
#
# Autostart AdGrid display player in kiosk mode.
# Install: sudo cp adgrid-display.service /etc/systemd/system/
#          sudo systemctl enable adgrid-display
#          sudo systemctl start adgrid-display
#
# Set DISPLAY_URL in /etc/adgrid-display.env before starting.

[Unit]
Description=AdGrid Display Player
After=network-online.target graphical.target
Wants=network-online.target

[Service]
Type=simple
User=pi
EnvironmentFile=-/etc/adgrid-display.env
Environment=DISPLAY=:0
ExecStartPre=/bin/sleep 5
ExecStart=/usr/bin/chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --no-first-run \
  --disable-session-crashed-bubble \
  --disable-translate \
  --check-for-update-interval=604800 \
  --app=${DISPLAY_URL}
Restart=always
RestartSec=10

[Install]
WantedBy=graphical.target
```

- [ ] **Step 2: Create the env template**

Create `screen-agent/display/adgrid-display.env.example`:
```bash
# Copy to /etc/adgrid-display.env and fill in your screen token
DISPLAY_URL=https://app.adgrid.io/display/YOUR_SCREEN_TOKEN_HERE
```

- [ ] **Step 3: Update README — add Display Setup section**

Add this section to `screen-agent/README.md` **before** the existing "Setup" section:

```markdown
## Quick Start (Physical Screen)

A physical AdGrid screen needs **two things running**:

| What | Does |
|------|------|
| **Display (kiosk browser)** | Shows ads on screen |
| **Screen agent (Docker)** | Tracks viewers via camera |

Both are required. Set up the display first, then the screen agent.

---

## Display Setup (Kiosk Browser)

The display player is a web page at:
```
https://app.adgrid.io/display/<YOUR_SCREEN_TOKEN>
```

Get your `SCREEN_TOKEN` from the **Setup Guide** tab on your screen's detail page in the AdGrid dashboard.

### Raspberry Pi / Debian Linux

**1. Install Chromium (if not already installed):**
```bash
sudo apt-get install -y chromium-browser
```

**2. Disable screen blanking** (add to `/etc/xdg/lxsession/LXDE-pi/autostart` or equivalent):
```
@xset s off
@xset -dpms
@xset s noblank
```

**3. Install the systemd service:**
```bash
# Copy the service and env files
sudo cp display/adgrid-display.service /etc/systemd/system/
sudo cp display/adgrid-display.env.example /etc/adgrid-display.env

# Fill in your screen token
sudo nano /etc/adgrid-display.env
# Set: DISPLAY_URL=https://app.adgrid.io/display/YOUR_SCREEN_TOKEN

# Enable autostart
sudo systemctl daemon-reload
sudo systemctl enable adgrid-display
sudo systemctl start adgrid-display
```

**4. Verify it's running:**
```bash
sudo systemctl status adgrid-display
```

The screen will now show ads on boot, auto-recover if Chromium crashes, and reload content every 30 seconds.

---
```

- [ ] **Step 4: Commit**

```
git add screen-agent/display/adgrid-display.service screen-agent/display/adgrid-display.env.example screen-agent/README.md
git commit -m "feat(screen-agent): add kiosk display autostart service + README setup guide"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** All 3 blockers addressed. BLOCKER 1 (missing transfer) → Task 2. BLOCKER 2 (no payment filter) → Task 3. BLOCKER 3 (no display setup) → Task 5. Should-fixes addressed: revenue math confirmed correct in Task 4, GBP fixed in Task 3.
- [x] **No placeholders:** All steps have actual SQL, TypeScript, and shell commands.
- [x] **Type consistency:** `distributeOperatorCuts` uses the same `supabase` and `stripe` instances already defined at module level in `charge-campaign/index.ts`. No new imports needed — Stripe SDK already imported.
- [x] **Idempotency:** Transfer uses `idempotencyKey` = `operator-transfer:{bookingId}:{operatorId}`. DB upsert uses `onConflict: "booking_id,operator_id"`. Double-fire safe.
- [x] **Operators without Connect:** Logged with a warning, skipped — they can be backfilled via `trigger-payout` once they complete Connect onboarding.
