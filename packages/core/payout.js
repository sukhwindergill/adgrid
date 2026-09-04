// Default operator payout share when a profile has no custom
// owner_revenue_share override. Must match src/lib/revenueSplit.js's
// DEFAULT_OWNER_REVENUE_SHARE on the web app -- this was previously 0.70,
// disagreeing with the real platform default (0.40) and overstating every
// revenue estimate shown on mobile (dashboard, revenue tab, approval cards)
// by 75%, for every operator without a custom rate.
export const SCREEN_OWNER_SHARE = 0.40;
