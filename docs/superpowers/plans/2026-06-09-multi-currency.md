# Multi-Currency (CAD + USD) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Charge advertisers in CAD or USD based on their preferred currency, auto-detected from Stripe card country with manual override in settings.

**Architecture:** Add `preferred_currency` to profiles (default `'cad'`), `currency` to bookings (locked at charge time). Auto-detect fires in `stripe-webhook` on `checkout.session.completed`. Three edge functions read `preferred_currency` at runtime. UI adds a currency dropdown to advertiser settings and shows currency suffix on all budget displays.

**Tech Stack:** React 18, Supabase Edge Functions (Deno), Stripe API v2023-10-16, inline styles

---

## File Map

| File | Action |
|------|--------|
| `supabase/migrations/20260609000000_multi_currency.sql` | Create — add columns, fix payouts default |
| `src/lib/formatCurrency.js` | Create — `formatCurrency(amount, currency)` utility |
| `supabase/functions/charge-campaign/index.ts` | Modify — read `preferred_currency`, pass to PI, write to booking |
| `supabase/functions/setup-billing/index.ts` | Modify — read `preferred_currency`, pass to Checkout session |
| `supabase/functions/stripe-webhook/index.ts` | Modify — handle `checkout.session.completed`, auto-detect currency |
| `src/views/advertiser/SettingsView.jsx` | Modify — add currency dropdown to `ProfileTab` |
| `src/views/advertiser/CreateCampaign.jsx` | Modify — use `formatCurrency` in `StepReview` and `StepPay` |

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/20260609000000_multi_currency.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Add preferred_currency to profiles (advertiser account-level preference)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferred_currency text DEFAULT 'cad';

-- Add currency to bookings (locked at charge time, never changes)
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'cad';

-- Fix payouts default — operator is Canadian, payouts settle in CAD
ALTER TABLE payouts
  ALTER COLUMN currency SET DEFAULT 'cad';
```

- [ ] **Step 2: Apply migration locally**

```bash
npx supabase db push
```

Expected output: migration `20260609000000_multi_currency` applied successfully.

- [ ] **Step 3: Verify columns exist**

```bash
npx supabase db diff
```

Expected: empty diff (schema matches migrations).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260609000000_multi_currency.sql
git commit -m "feat(db): add preferred_currency to profiles, currency to bookings"
```

---

## Task 2: `formatCurrency` Utility

**Files:**
- Create: `src/lib/formatCurrency.js`

- [ ] **Step 1: Create utility**

```js
export function formatCurrency(amount, currency = 'cad') {
  const suffix = (currency ?? 'cad').toUpperCase();
  return `$${Number(amount).toFixed(2)} ${suffix}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/formatCurrency.js
git commit -m "feat: add formatCurrency utility"
```

---

## Task 3: `charge-campaign` — Read and Write Currency

**Files:**
- Modify: `supabase/functions/charge-campaign/index.ts`

Current advertiser profile select at line ~77:
```ts
const { data: advertiser } = await supabase
  .from("profiles")
  .select("stripe_customer_id, email")
  .eq("id", booking.advertiser_id)
  .single();
```

- [ ] **Step 1: Add `preferred_currency` to profile select**

```ts
const { data: advertiser } = await supabase
  .from("profiles")
  .select("stripe_customer_id, email, preferred_currency")
  .eq("id", booking.advertiser_id)
  .single();
```

- [ ] **Step 2: Use `preferred_currency` when creating PaymentIntent**

Find the `stripe.paymentIntents.create` call (~line 106). Replace `currency: "cad"` with:

```ts
paymentIntent = await stripe.paymentIntents.create({
  amount: amountPence,
  currency: advertiser.preferred_currency ?? "cad",
  customer: advertiser.stripe_customer_id,
  payment_method: paymentMethodId,
  confirm: true,
  off_session: true,
  description: `AdGrid: ${booking.advertiser_name} — ${booking.screen_name}`,
  metadata: { campaign_id: booking.id, advertiser_id: booking.advertiser_id },
}, {
  idempotencyKey: `charge-campaign:${booking.id}`,
});
```

- [ ] **Step 3: Write currency to booking on successful charge**

Find the bookings update after PI succeeds (~line 133). Add `currency`:

```ts
await supabase
  .from("bookings")
  .update({
    status: "scheduled",
    payment_intent_id: paymentIntent.id,
    payment_status: "paid",
    currency: advertiser.preferred_currency ?? "cad",
  })
  .eq("id", campaign_id);
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/charge-campaign/index.ts
git commit -m "feat(charge-campaign): charge in advertiser preferred currency"
```

---

## Task 4: `setup-billing` — Pass Currency to Checkout Session

**Files:**
- Modify: `supabase/functions/setup-billing/index.ts`

Current profile select at line ~33:
```ts
const { data: profile } = await supabase
  .from("profiles")
  .select("stripe_customer_id, email, full_name")
  .eq("id", user.id)
  .single();
```

- [ ] **Step 1: Add `preferred_currency` to profile select**

```ts
const { data: profile } = await supabase
  .from("profiles")
  .select("stripe_customer_id, email, full_name, preferred_currency")
  .eq("id", user.id)
  .single();
```

- [ ] **Step 2: Pass `preferred_currency` to Checkout session**

Find `stripe.checkout.sessions.create` (~line 55). Replace `currency: "cad"` with:

```ts
const session = await stripe.checkout.sessions.create({
  mode: "setup",
  customer: customerId,
  currency: profile?.preferred_currency ?? "cad",
  success_url: `${origin}/billing?setup=success`,
  cancel_url: `${origin}/billing?setup=cancelled`,
});
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/setup-billing/index.ts
git commit -m "feat(setup-billing): use advertiser preferred currency for checkout session"
```

---

## Task 5: `stripe-webhook` — Auto-Detect Currency from Card Country

**Files:**
- Modify: `supabase/functions/stripe-webhook/index.ts`

The webhook currently handles: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `charge.dispute.created`. Need to add `checkout.session.completed`.

- [ ] **Step 1: Add `checkout.session.completed` case to the switch**

Find the `switch (event.type)` block and add before `default:`:

```ts
case "checkout.session.completed": {
  const session = event.data.object as Stripe.Checkout.Session;
  if (session.mode !== "setup") break;

  // Resolve the customer's supabase user id
  const customerId = typeof session.customer === "string"
    ? session.customer
    : session.customer?.id;
  if (!customerId) break;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, preferred_currency")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (!profile) break;

  // Only auto-set if still on the default — never overwrite a manual override
  if (profile.preferred_currency !== "cad") break;

  // Expand the setup intent to get the payment method's card country
  const setupIntentId = typeof session.setup_intent === "string"
    ? session.setup_intent
    : (session.setup_intent as Stripe.SetupIntent | null)?.id;
  if (!setupIntentId) break;

  const setupIntent = await stripe.setupIntents.retrieve(setupIntentId, {
    expand: ["payment_method"],
  });

  const pm = setupIntent.payment_method as Stripe.PaymentMethod | null;
  const cardCountry = pm?.card?.country ?? null;

  const detectedCurrency = cardCountry === "US" ? "usd" : "cad";
  if (detectedCurrency === "cad") break; // already default, no write needed

  await supabase
    .from("profiles")
    .update({ preferred_currency: detectedCurrency })
    .eq("id", profile.id);

  break;
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/stripe-webhook/index.ts
git commit -m "feat(stripe-webhook): auto-detect preferred currency from card country on setup"
```

---

## Task 6: Settings UI — Currency Dropdown

**Files:**
- Modify: `src/views/advertiser/SettingsView.jsx`

`ProfileTab` starts at line ~62. It has state for `name`, `companyName`, `companyWebsite`, `timezone`. The `save()` function at line ~70 updates these four fields. The rendered form has a `<select>` for timezone (~line 100).

- [ ] **Step 1: Add `currency` state to `ProfileTab`**

In `ProfileTab`, after the existing `useState` calls (~line 66), add:

```jsx
const [currency, setCurrency] = useState(profile?.preferred_currency ?? 'cad');
```

- [ ] **Step 2: Add `preferred_currency` to the `save()` update**

Find the `.update(...)` call in `save()` (~line 74). Add `preferred_currency: currency`:

```js
.update({ name, company_name: companyName, company_website: companyWebsite, timezone, preferred_currency: currency })
```

Also update the `onSaved` call on line ~78 to include it:

```js
if (!error) onSaved({ name, company_name: companyName, company_website: companyWebsite, timezone, preferred_currency: currency });
```

- [ ] **Step 3: Add currency dropdown to the form**

Add after the timezone `<select>` block and before `<SaveBtn>`. Follow the exact same wrapper pattern used for timezone:

```jsx
<div>
  <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 6 }}>
    Billing Currency
  </div>
  <select
    value={currency}
    onChange={(e) => setCurrency(e.target.value)}
    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: F.sans, background: C.surface, color: C.text }}
  >
    <option value="cad">CAD — Canadian Dollar</option>
    <option value="usd">USD — US Dollar</option>
  </select>
  <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 4 }}>
    Applies to new campaigns only. Existing bookings are not affected.
  </div>
</div>
```

- [ ] **Step 4: Commit**

```bash
git add src/views/advertiser/SettingsView.jsx
git commit -m "feat(settings): add billing currency dropdown to advertiser profile tab"
```

---

## Task 7: `CreateCampaign` — Show Currency in StepReview and StepPay

**Files:**
- Modify: `src/views/advertiser/CreateCampaign.jsx`

`profile` is already available from `useAuth()` at line ~739. `StepReview` and `StepPay` are function components — `profile` needs to be passed as a prop. `StepPay` receives `campaign` (the saved booking) which will have `currency` after it's created — but at the time StepPay renders, the booking is already saved, so use `campaign.currency`. For StepReview (before submission), use `profile.preferred_currency`.

- [ ] **Step 1: Import `formatCurrency`**

At the top of `CreateCampaign.jsx`, add:

```js
import { formatCurrency } from '../../lib/formatCurrency.js';
```

- [ ] **Step 2: Pass `profile` to `StepReview`**

Find where `StepReview` is rendered in the wizard JSX. Add `profile={profile}` prop:

```jsx
<StepReview form={form} matchedScreens={matchedScreens} onSubmit={handleSubmit} submitting={submitting} err={submitErr} profile={profile} />
```

- [ ] **Step 3: Update `StepReview` to accept and use `profile`**

Find the `StepReview` function signature and the `Budget` row (~line 677):

```jsx
function StepReview({ form, matchedScreens, onSubmit, submitting, err, profile }) {
```

Find the `rows` array Budget entry:
```js
['Budget', `$${form.budget || '—'} (${form.budget_mode === 'daily' ? 'daily' : 'total'})`],
```

Replace with:
```js
['Budget', `${form.budget ? formatCurrency(form.budget, profile?.preferred_currency) : '—'} (${form.budget_mode === 'daily' ? 'daily' : 'total'})`],
```

- [ ] **Step 4: Update `StepPay` to use `formatCurrency`**

Find both budget references in `StepPay` (~lines 720 and 726):

```jsx
// line ~720 — paragraph text
Charge {formatCurrency(campaign.budget, campaign.currency)} to your card on file. Screens won't go live until payment is captured.

// line ~726 — button label
{paying ? 'Charging…' : `Pay now — ${formatCurrency(campaign.budget, campaign.currency)}`}
```

Full context for line ~720:
```jsx
<p style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, margin: '0 0 24px' }}>
  Charge {formatCurrency(campaign.budget, campaign.currency)} to your card on file. Screens won't go live until payment is captured.
</p>
```

Full context for line ~726:
```jsx
<Btn onClick={onPay} disabled={paying} style={{ width: '100%', fontSize: 15, padding: '14px 24px', marginBottom: 10 }}>
  {paying ? 'Charging…' : `Pay now — ${formatCurrency(campaign.budget, campaign.currency)}`}
</Btn>
```

- [ ] **Step 5: Also update the campaign card budget display in the sidebar list**

Find ~line 1002:
```jsx
<div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 2 }}>{c.city} · ${c.budget}</div>
```

Replace with:
```jsx
<div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 2 }}>{c.city} · {formatCurrency(c.budget, c.currency)}</div>
```

- [ ] **Step 6: Commit**

```bash
git add src/views/advertiser/CreateCampaign.jsx
git commit -m "feat(campaign): show currency suffix on budget in review and pay steps"
```

---

## Task 8: Deploy Edge Functions

- [ ] **Step 1: Deploy all modified functions**

```bash
npx supabase functions deploy charge-campaign
npx supabase functions deploy setup-billing
npx supabase functions deploy stripe-webhook
```

Expected: each returns `Deployed Function <name> on project <id>`

- [ ] **Step 2: Verify env vars are set in Supabase dashboard**

Required secrets (check via Supabase Dashboard → Edge Functions → Secrets):
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- `INTERNAL_NOTIFICATION_SECRET`
- `PUBLIC_APP_URL`
- `RESEND_API_KEY`

- [ ] **Step 3: Final commit**

```bash
git add .
git commit -m "chore: deploy multi-currency edge functions"
```
