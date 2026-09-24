// Single source of truth for how a paid campaign budget splits between the
// platform and the screen owner.
//
// The operator gets `profiles.owner_revenue_share` of what the advertiser
// paid (default 70%); the platform keeps the rest. There is no separate
// platform fee or network pool -- an earlier 12% fee + 40%-of-net + "pool"
// model paid operators ~35% of spend and left the pool unallocated.
//
// Keep DEFAULT_OWNER_REVENUE_SHARE in sync with
// supabase/functions/_shared/payoutSharing.ts, which the Stripe payout
// functions (charge-campaign, trigger-payout) use.
export const DEFAULT_OWNER_REVENUE_SHARE = 0.70;

/**
 * @param {number} totalBudget - gross campaign spend to split.
 * @param {number|null|undefined} ownerRevenueShare - profiles.owner_revenue_share
 *   for the operator receiving payout; falls back to the platform default
 *   when unset (matches trigger-payout/index.ts).
 * @returns {{ platform: number, owner: number }} rounded whole currency
 *   units; owner + platform reconstructs totalBudget.
 */
export function computeRevenueSplit(totalBudget, ownerRevenueShare) {
  const share = Number.isFinite(ownerRevenueShare) ? ownerRevenueShare : DEFAULT_OWNER_REVENUE_SHARE;
  const total = Number.isFinite(totalBudget) ? totalBudget : 0;

  const owner = Math.round(total * share);
  const platform = total - owner;

  return { platform, owner };
}
