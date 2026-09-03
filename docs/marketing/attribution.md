# Attribution — AdGrid

## Model
Two-sided marketplace, low-frequency high-consideration signup on both sides → recommend **last non-direct click** for now (simplicity, low volume doesn't support multi-touch modeling yet), with a note to move to **position-based (40/20/40)** once monthly signups exceed ~500/side.

## UTM taxonomy
`utm_source` (google, meta, linkedin, referral, directory) / `utm_medium` (cpc, organic, social, email, partner) / `utm_campaign` (operator-acquisition, advertiser-acquisition-{city}) / `utm_content` (creative id from `docs/marketing/ad-creative.md`).

## Side-specific attribution
Track attribution separately per marketplace side — an advertiser and an operator converting from the same campaign have very different LTV, so blended attribution reporting will mislead spend decisions.

## Offline/referral tracking
Operator referrals (see `docs/marketing/referrals.md`) and directory submissions (see `docs/marketing/directory-submissions.md`) should carry a unique `ref` param or referral code captured at signup, not just UTM, since these sources often arrive without query strings intact.
