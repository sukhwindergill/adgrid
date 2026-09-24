// Back-of-envelope monthly earnings for the homepage operator calculator.
// This is a marketing estimate, not a quote: every assumption is exported so
// the UI can print it next to the number instead of hiding it.
//
// Model: each visitor sees one pass of the ad loop, which holds
// AD_SPOTS_PER_LOOP paid spots. fillRate is the share of those spots that
// advertisers actually book. Sold impressions are priced at CPM, and the
// operator keeps DEFAULT_OWNER_REVENUE_SHARE of that (see revenueSplit.js).
import { DEFAULT_OWNER_REVENUE_SHARE } from './revenueSplit.js';

const DAYS_PER_MONTH = 30;
const AD_SPOTS_PER_LOOP = 4;
// Conservative end of what screens on the platform are floored at
// (screens.cpm_floor defaults to $3; the listing form assumes $8).
const CPM = 5;

export const ESTIMATE_ASSUMPTIONS = {
  daysPerMonth: DAYS_PER_MONTH,
  adSpotsPerLoop: AD_SPOTS_PER_LOOP,
  cpm: CPM,
  ownerShare: DEFAULT_OWNER_REVENUE_SHARE,
};

const nonNegative = n => (Number.isFinite(Number(n)) && Number(n) > 0 ? Number(n) : 0);

/**
 * @param {{ screens: number, dailyVisitors: number, fillRate: number }} input
 *   dailyVisitors is per screen; fillRate is 0..1.
 * @returns {{ soldImpressions: number, gross: number, operator: number }}
 *   gross/operator in whole dollars per month.
 */
export function estimateMonthlyEarnings({ screens, dailyVisitors, fillRate }) {
  const fill = Math.min(1, nonNegative(fillRate));
  const soldImpressions = Math.round(
    nonNegative(screens) * nonNegative(dailyVisitors) * DAYS_PER_MONTH * AD_SPOTS_PER_LOOP * fill,
  );
  const gross = Math.round((soldImpressions / 1000) * CPM);
  const operator = Math.round(gross * DEFAULT_OWNER_REVENUE_SHARE);
  return { soldImpressions, gross, operator };
}
