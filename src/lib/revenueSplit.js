// Single source of truth for how a paid campaign budget splits between the
// platform, a screen owner, and the wider network pool (bundle/marketplace
// listings that share revenue across multiple screens).
//
// This used to be copy-pasted as literals across Billing.jsx, Revenue.jsx,
// ScreenDetail.jsx, and ApprovalQueue.jsx — each hardcoding 40% (or, in
// ApprovalQueue's case, an unrelated 70%) instead of reading the operator's
// actual `profiles.owner_revenue_share`. An operator on a custom rate saw a
// different wrong number on every page, none matching the real Stripe
// payout computed server-side in supabase/functions/trigger-payout.
//
// Keep PLATFORM_FEE_RATE in sync with trigger-payout/index.ts.
export const PLATFORM_FEE_RATE = 0.12;
export const DEFAULT_OWNER_REVENUE_SHARE = 0.40;

/**
 * @param {number} totalBudget - gross campaign spend to split.
 * @param {number|null|undefined} ownerRevenueShare - profiles.owner_revenue_share
 *   for the operator receiving payout; falls back to the platform default
 *   when unset (matches trigger-payout/index.ts:97).
 * @returns {{ platform: number, owner: number, pool: number }} rounded whole
 *   currency units; owner + pool + platform reconstructs totalBudget.
 */
export function computeRevenueSplit(totalBudget, ownerRevenueShare) {
  const share = Number.isFinite(ownerRevenueShare) ? ownerRevenueShare : DEFAULT_OWNER_REVENUE_SHARE;
  const total = Number.isFinite(totalBudget) ? totalBudget : 0;

  const platform = Math.round(total * PLATFORM_FEE_RATE);
  const net = total - platform;
  const owner = Math.round(net * share);
  const pool = total - platform - owner;

  return { platform, owner, pool };
}
