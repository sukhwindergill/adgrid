// src/lib/fillRateTrend.js
// Story Map (Operator epic) / churn-prevention.md: "fill rate" is named
// directly as a leading indicator of operator churn, but nothing in the
// product actually computed or flagged it -- Revenue.jsx already tracked
// house-ad impressions (for the opportunity-cost KPI) but never compared
// them against paid impressions as a share, let alone trended that share.
//
// Fill rate here means the paid share of total (paid + house-ad)
// impressions -- a screen fully booked by paying advertisers has no house
// ads playing at all, so a rising house-ad share is a falling fill rate.
//
// Pure, so it's testable without touching Supabase or React.

// A double-digit percentage-point drop is a real trend, not day-to-day
// noise in a small sample -- matches the kind of threshold used elsewhere
// in this codebase for "worth surfacing" (see deliveryFlag.js's 85% bar).
export const FILL_RATE_DROP_THRESHOLD_PTS = 10;

function shareOf(paid, house) {
  const total = paid + house;
  return total > 0 ? (paid / total) * 100 : null;
}

export function computeFillRateTrend({ paidCurrent, houseCurrent, paidPrior, housePrior }) {
  const currentRate = shareOf(paidCurrent, houseCurrent);
  const priorRate = shareOf(paidPrior, housePrior);

  if (currentRate === null || priorRate === null) {
    return { currentRate, priorRate, deltaPts: null, flagged: false };
  }

  const deltaPts = Math.round(currentRate - priorRate);
  return {
    currentRate,
    priorRate,
    deltaPts,
    flagged: deltaPts <= -FILL_RATE_DROP_THRESHOLD_PTS,
  };
}
