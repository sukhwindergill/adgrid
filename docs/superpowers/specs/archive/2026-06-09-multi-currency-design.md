# Multi-Currency Support — Design Spec

**Date:** 2026-06-09
**Scope:** CAD + USD at launch. Charge advertisers in their preferred currency, auto-detected from Stripe card country with manual override in settings.

---

## Currencies Supported

| Code | Name | Trigger |
|------|------|---------|
| `cad` | Canadian Dollar | Default for all accounts |
| `usd` | US Dollar | Auto-detected when card country = `US`, or manual override |

---

## Data Layer

### `profiles` table
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_currency text DEFAULT 'cad';
```
- Valid values: `'cad'`, `'usd'`
- Editable by advertiser in settings
- Auto-set on first card add if still default

### `bookings` table
```sql
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS currency text DEFAULT 'cad';
```
- Locked at checkout time — never updated after PaymentIntent created
- Drives all display and Stripe charge currency for that booking

### `payouts` table
- Already has `currency text DEFAULT 'usd'` — change default to `'cad'` in migration (operator is Canadian)

---

## Auto-Detect Flow

Triggered by `stripe-webhook` on `checkout.session.completed` (setup mode):

1. Retrieve `SetupIntent` from the session
2. Expand `payment_method` → read `card.country`
3. Map: `'US'` → `'usd'`, all other values → `'cad'`
4. Read current `profiles.preferred_currency` for the advertiser
5. **Only write** if current value is still `'cad'` (the default) — never overwrite a manual override
6. Update `profiles.preferred_currency` with mapped value

No new webhook event type needed — `checkout.session.completed` already handled in `stripe-webhook`.

---

## Charge Flow

### `charge-campaign`
- After fetching advertiser profile, also read `preferred_currency` (already fetching profile)
- Pass `currency: preferred_currency` to `stripe.paymentIntents.create` (replaces hardcoded `'cad'`)
- After successful PI, write `currency: preferred_currency` to `bookings` row alongside `payment_status: 'paid'`

### `setup-billing`
- Read `preferred_currency` from profile (already fetching profile for `stripe_customer_id`)
- Pass `currency: preferred_currency` to `stripe.checkout.sessions.create` (replaces hardcoded `'cad'`)

### `operator-billing`
- Default in `const { amount, currency = 'cad' }` already fixed — no further change needed here (operator always settles in CAD)

---

## Settings UI

**Location:** Advertiser Settings → Profile/Account tab (existing `AdvSettingsView.jsx`)

**Component:** New row in the profile form section:
- Label: `Billing Currency`
- Input: `<select>` with two options:
  - `CAD — Canadian Dollar`
  - `USD — US Dollar`
- On save: PATCH `profiles.preferred_currency` via existing settings save flow
- Helper text below field: *"Applies to new campaigns only. Existing bookings are not affected."*

No new route or page needed.

---

## Display Rules

| Context | Rule |
|---------|------|
| Campaign budget in advertiser views | Show `$X CAD` / `$X USD` using `booking.currency` |
| Invoice list (`BillingView`) | Already shows `inv.currency.toUpperCase()` — no change needed |
| Operator dashboard revenue totals | Always CAD (Stripe settles to operator's home currency) — no change |
| Campaign creation review step | Show currency from `profiles.preferred_currency` as suffix |

Helper: add a `formatCurrency(amount, currency)` utility in `src/lib/formatCurrency.js`:
```js
export function formatCurrency(amount, currency = 'cad') {
  const suffix = currency.toUpperCase();
  return `$${Number(amount).toFixed(2)} ${suffix}`;
}
```
Use this everywhere instead of bare `` `$${x}` `` template literals.

---

## Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| Advertiser adds US card, then manually switches back to CAD | Manual override wins — auto-detect only fires when value is still default |
| Advertiser changes currency after campaign created but before payment | Booking uses currency at payment time (read fresh from profile in `charge-campaign`) |
| Card country not returned by Stripe (virtual/prepaid) | `card.country` is `null` → keep existing `preferred_currency`, no write |
| Operator views campaign with USD booking | Show `$X USD` label so operator knows it's a foreign-currency booking |

---

## Out of Scope

- GBP, AUD, EUR, or any other currencies — add in v2 when real demand exists
- FX rate display or conversion in UI — Stripe handles settlement silently
- Retroactive currency change on existing bookings — not possible (PI currency is immutable)
- Operator-level currency configuration

---

## Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/YYYYMMDD_multi_currency.sql` | Add `preferred_currency` to profiles, `currency` to bookings, fix payouts default |
| `supabase/functions/stripe-webhook/index.ts` | Auto-detect currency on `checkout.session.completed` |
| `supabase/functions/charge-campaign/index.ts` | Read `preferred_currency`, pass to PI, write to booking |
| `supabase/functions/setup-billing/index.ts` | Read `preferred_currency`, pass to Checkout session |
| `src/views/advertiser/AdvSettingsView.jsx` | Add currency dropdown to profile tab |
| `src/views/advertiser/CreateCampaign.jsx` | Show currency suffix in StepReview |
| `src/lib/formatCurrency.js` | New utility — `formatCurrency(amount, currency)` |
| `src/views/advertiser/BillingView.jsx` | Use `formatCurrency` (already correct, minor cleanup) |
