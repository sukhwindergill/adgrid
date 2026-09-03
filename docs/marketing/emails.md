# Lifecycle Email Templates — AdGrid

## Operator lifecycle
1. **Welcome / listing incomplete** (T+1hr if no screen listed): "Finish setting up [Business Name]'s screen — takes 3 minutes." CTA: complete listing.
2. **First live confirmation**: "Your screen is live — here's what happens next." Sets expectation on fill rate and payout timing.
3. **First payout**: "You just earned $[X] from [Business Name]'s screen." Reinforces the core loop, invites referral (see `docs/marketing/referrals.md`).
4. **Low fill-rate nudge** (weekly digest, see `docs/marketing/churn-prevention.md`): "Your screen earned $[X] this week — here's how to earn more."

## Advertiser lifecycle
1. **Welcome / booking incomplete**: "Your campaign isn't live yet — finish in under 2 minutes." Reinforce "no minimums."
2. **Campaign live confirmation**: "Your ad is now playing on [N] screens in [City]."
3. **Campaign performance recap**: plays delivered, screens reached — sent at campaign end, includes a rebook CTA.
4. **Win-back** (30 days post last campaign, no new booking): "Ready to get back in front of [City] again?"

## Rules
- Every lifecycle email ties to one event in `docs/marketing/analytics.md` (e.g. `screen_listing_published` triggers email 2).
- Subject lines lead with the outcome/number, not the brand name.
- All emails link back through the `docs/marketing/attribution.md` UTM convention (`utm_medium=email`).
