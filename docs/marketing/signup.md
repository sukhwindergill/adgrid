# Signup Flow — AdGrid

## Current entry points
- Operator: "List your screens" CTA (`Hero.jsx`, `OperatorsSection.jsx`) → `ScreenOnboard.jsx`.
- Advertiser: "Book a campaign" CTA → advertiser signup → `createCampaign/` flow.

## Recommendations
1. **Reduce signup-to-value time.** For operators, the fastest path to a retained user is seeing "your screen is live" — front-load whatever step gets a screen to `live` status, defer secondary details (tax/payout info) to just before the first payout is due rather than at signup.
2. **Social/SSO signup** — if not already present, adding Google sign-in reduces friction, especially for advertiser-side small business owners signing up on mobile.
3. **Progressive profiling** — don't ask for everything at once; the FAQ already promises "connect it in minutes," so the signup form should honor that promise literally.
4. **Post-signup redirect clarity** — ensure operator vs. advertiser signup routes to the correct next step (`ScreenOnboard.jsx` vs. campaign creation) with no ambiguous "choose your account type" detour if the entry CTA already disambiguated intent.

## Metric to own
Signup-form abandonment rate by field (which field causes the most drop-off) — feeds directly into `analytics.md` and `cro-audit.md`.
