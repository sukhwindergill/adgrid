// Default operator payout share when a profile has no custom
// owner_revenue_share override. Must match src/lib/revenueSplit.js's
// DEFAULT_OWNER_REVENUE_SHARE on the web app -- this was previously 0.70,
// disagreeing with the real platform default (0.40) and overstating every
// revenue estimate shown on mobile (dashboard, revenue tab, approval cards)
// by 75%, for every operator without a custom rate.
export const SCREEN_OWNER_SHARE = 0.40;

// Platform-audit finding: mobile's Revenue tab (useRevenue.js, revenue.jsx)
// computed an operator's earnings as `budget * revenueShare` -- gross
// budget, with no platform fee deducted. The web app already fixed this
// exact bug (see src/lib/revenueSplit.js's own history/comment: hardcoded
// literals across Billing.jsx, Revenue.jsx, ScreenDetail.jsx, and
// ApprovalQueue.jsx were replaced by one computeRevenueSplit matching what
// trigger-payout/charge-campaign actually pay out) -- mobile never got the
// same fix and was still overstating every operator's mobile revenue
// figures by ~14% (the uncounted 12% platform fee). Keep in sync with
// PLATFORM_FEE_RATE in supabase/functions/trigger-payout/index.ts and
// src/lib/revenueSplit.js.
export const PLATFORM_FEE_RATE = 0.12;

/**
 * What an operator actually nets from a campaign's gross budget, after the
 * platform fee and their revenue share -- matches trigger-payout's and
 * charge-campaign's distributeOperatorCuts' own math exactly.
 * @param {number} budget - gross campaign spend.
 * @param {number|null|undefined} revenueShare - profiles.owner_revenue_share;
 *   falls back to SCREEN_OWNER_SHARE when unset.
 */
export function operatorNetRevenue(budget, revenueShare) {
  const b = Number.isFinite(budget) ? budget : 0;
  const share = Number.isFinite(revenueShare) ? revenueShare : SCREEN_OWNER_SHARE;
  return b * (1 - PLATFORM_FEE_RATE) * share;
}
