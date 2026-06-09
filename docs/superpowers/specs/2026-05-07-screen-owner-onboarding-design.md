# Screen Owner Onboarding Design

**Date:** 2026-05-07
**Status:** Approved

## Context

Operators in AdGrid own physical digital screens. Currently:
- Screen registration form exists in the UI but discards data (no DB insert)
- Stripe Connect buttons have no handlers — payouts are fully mocked
- There is no `payouts` table and no real Stripe transfer logic

This spec covers three things needed to make the operator money flow work end-to-end:
1. Screen registration saves to the database
2. Operators connect their bank via Stripe Connect Express
3. Operators can trigger real Stripe payouts to their connected account

---

## Section 1: Screen Registration

### What changes

The screen registration modal in `ScreensView` already exists but calls no backend. Wire it to Supabase on submit.

**On submit:** `INSERT INTO screens (name, owner, type, city, location, status, operator_id)`
- `status` defaults to `'pending'` (operator sets to `live` once screen is physically installed)
- `operator_id` links the screen to the operator who registered it
- After insert, reload the screens list so the new screen appears immediately

### DB change

```sql
ALTER TABLE screens ADD COLUMN IF NOT EXISTS operator_id uuid REFERENCES profiles(id);
```

`owner` stays as `text` (business/display name) — no FK needed since operators own their own screens.

### RLS

```sql
CREATE POLICY "operator_own_screens" ON screens
  FOR ALL USING (operator_id = auth.uid());
```

---

## Section 2: Stripe Connect Onboarding

### Flow

1. Operator clicks "Connect Bank Account" in Billing & Payouts → Screen Accounts tab
2. Edge function `create-connect-account`:
   - Creates a Stripe Connect Express account for the operator
   - Stores `stripe_connect_account_id` on their `profiles` row
   - Generates a Stripe Account Link URL (hosted onboarding)
   - Returns the URL to the frontend
3. Frontend redirects operator to Stripe's hosted onboarding (bank details, ID verification)
4. Stripe redirects back to AdGrid at `/?connect=success` or `/?connect=refresh`
5. App detects the query param → shows success state → marks operator `connect_status: 'active'`

### New `profiles` columns

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_connect_account_id text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS connect_status text; -- null | 'pending' | 'active'
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS owner_revenue_share numeric DEFAULT 0.40; -- payout % of campaign budget
```

### Edge function: `create-connect-account`

- **Auth:** required (operator JWT)
- **Input:** `{ returnUrl: string }` — where to redirect after onboarding
- **Logic:**
  1. If no `stripe_connect_account_id` on profile → create Stripe Express account → store ID
  2. If `stripe_connect_account_id` exists → reuse it (idempotent)
  3. Create Account Link with `type: 'account_onboarding'`, `return_url`, `refresh_url`
  4. Return `{ url: accountLinkUrl }`
- **Frontend:** redirects to `url`

### UI states in Screen Accounts tab

| State | Display |
|-------|---------|
| `connect_status` null | "Connect Bank Account" button |
| `connect_status = 'pending'` | "Complete Setup →" (resume link) |
| `connect_status = 'active'` | "✓ Connected" green badge + "View in Stripe ↗" link |

On app load, if URL contains `?connect=success`: update `connect_status` to `'active'` via Supabase, show success toast, clear query param.

---

## Section 3: Payout Triggering

### Flow

1. Operator clicks "Pay Now" (individual) or "Run All Pending Payouts" (bulk) in Payouts tab
2. Edge function `trigger-payout`:
   - Verifies operator has `stripe_connect_account_id` and `connect_status = 'active'`
   - Calculates payout amount: sum of `bookings.budget` for campaigns on operator's screens × owner revenue share
   - Owner revenue share: `owner_revenue_share ?? 0.40` (40% default, new column on profiles)
   - Creates a Stripe Transfer to the connected account
   - Inserts row into `payouts` table with `status: 'transferred'`
   - Returns `{ ok: true, transfer_id, amount }`
3. UI refreshes payout list

### New `payouts` table

```sql
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

CREATE POLICY "operator_own_payouts" ON payouts
  FOR SELECT USING (operator_id = auth.uid());
```

### Edge function: `trigger-payout`

- **Auth:** required (operator JWT)
- **Input:** `{ periodStart: string, periodEnd: string }` — ISO date strings for the payout period
- **Logic:**
  1. Get operator profile → verify `stripe_connect_account_id` + `connect_status = 'active'`
  2. Query `bookings` joined to `screens` where `screens.operator_id = operator.id` and campaign active in period
  3. Sum `budget` × revenue share → `payoutAmount`
  4. Check no existing payout for same period (prevent double-pay)
  5. Create Stripe Transfer: `amount: payoutAmount * 100` (cents), `destination: stripe_connect_account_id`
  6. Insert into `payouts` table
  7. Return transfer details

### UI changes

- "Pay Now" / "Run All Pending Payouts" buttons call `trigger-payout` edge function
- Payouts tab queries `payouts` table instead of mock `PAYOUTS` constant
- Shows `period_start → period_end`, `amount`, `status`, `stripe_transfer_id` (linked to Stripe dashboard)

---

## Verification

1. **Screen registration:** Register a screen via modal → confirm row appears in Supabase `screens` table with correct `operator_id` → confirm it appears in the screens list immediately
2. **Stripe Connect:** Click "Connect Bank Account" → confirm redirect to Stripe onboarding → complete with test bank details → confirm redirect back to AdGrid → confirm `connect_status = 'active'` in profiles table
3. **Payout:** With active Connect account, click "Pay Now" → confirm Stripe Transfer created in Stripe Dashboard → confirm row in `payouts` table with `status: 'transferred'`
