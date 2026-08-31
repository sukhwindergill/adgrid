// Recommends the (venue_category, environment) profile an advertiser's own
// past campaigns performed best on, from delivery data that already exists
// (campaign_delivery_daily + screen attributes) -- no new tracking, no new
// backend. Pure aggregation so it's directly testable.

// deliveryRows: [{ screen_id, impressions, billable_scans }]
// screensById: Map<screen_id, { venue_category, environment }>
// Returns null when there isn't enough signal to recommend anything --
// a brand-new advertiser with no delivery history, or every profile under
// the sample-size floor, gets no (fake) recommendation rather than a
// confident-looking guess from a handful of impressions.
export function topPerformingProfile(deliveryRows, screensById, minImpressions = 500) {
  const byProfile = new Map(); // "venue|env" -> { venue_category, environment, impressions, billable_scans }

  for (const row of deliveryRows) {
    const screen = screensById.get(row.screen_id);
    if (!screen || !screen.venue_category || !screen.environment) continue;
    const key = `${screen.venue_category}|${screen.environment}`;
    const acc = byProfile.get(key) ?? {
      venue_category: screen.venue_category,
      environment: screen.environment,
      impressions: 0,
      billable_scans: 0,
    };
    acc.impressions += Number(row.impressions) || 0;
    acc.billable_scans += Number(row.billable_scans) || 0;
    byProfile.set(key, acc);
  }

  let best = null;
  let bestRate = -1;
  for (const profile of byProfile.values()) {
    if (profile.impressions < minImpressions) continue;
    const rate = profile.billable_scans / profile.impressions;
    // Tie-break on impressions (the larger, more-trusted sample) rather
    // than Map iteration order, which is insertion order and would
    // otherwise silently favor whichever profile happened to appear first.
    if (rate > bestRate || (rate === bestRate && profile.impressions > (best?.impressions ?? 0))) {
      best = profile;
      bestRate = rate;
    }
  }

  return best ? { venue_category: best.venue_category, environment: best.environment, scan_rate: bestRate } : null;
}
