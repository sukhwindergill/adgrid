// Comparing one campaign against the network.
//
// Every path fails to "unavailable" rather than to a number. A benchmark drawn
// from too few campaigns is worse than none: it misleads the viewer AND leaks
// the performance of the handful of advertisers it was computed from.

export const MIN_CAMPAIGNS = 5;
export const MIN_ADVERTISERS = 3;

export function compareToBenchmark(value, stats) {
  const v = Number(value);
  if (value === null || value === undefined || !Number.isFinite(v)) {
    return { available: false, reason: 'no_value' };
  }
  if (!stats) return { available: false, reason: 'no_data' };

  const campaigns = Number(stats.campaign_count) || 0;
  const advertisers = Number(stats.advertiser_count) || 0;
  if (campaigns < MIN_CAMPAIGNS || advertisers < MIN_ADVERTISERS) {
    return { available: false, reason: 'insufficient_sample' };
  }

  const p25 = Number(stats.p25);
  const p50 = Number(stats.p50);
  const p75 = Number(stats.p75);

  let position;
  if (v >= p75) position = 'top_quartile';
  else if (v <= p25) position = 'bottom_quartile';
  else if (v > p50) position = 'above_median';
  else if (v < p50) position = 'below_median';
  else position = 'at_median';

  const pctVsMedian = Number.isFinite(p50) && p50 !== 0
    ? Math.round(((v - p50) / p50) * 100)
    : null;

  return { available: true, reason: null, position, median: p50, p25, p75, pctVsMedian };
}
