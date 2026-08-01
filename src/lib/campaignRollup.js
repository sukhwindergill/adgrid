// Pure grouping/aggregation for the accordion campaign list. No DOM, no
// network -- same shape as creativeFit.js and creativeAssignment.js.

export function groupByCampaignId(bookings) {
  const groups = new Map();
  for (const b of bookings) {
    // A booking created before Phase 1's backfill logic ran, or by any path
    // that somehow skipped it, gets its own singleton group rather than
    // being silently dropped -- every booking must appear somewhere in the list.
    const key = b.campaign_id ?? b.id;
    const list = groups.get(key) ?? [];
    list.push(b);
    groups.set(key, list);
  }
  return groups;
}

export function rollupGroup(bookings) {
  return {
    budget: bookings.reduce((a, b) => a + (b.budget || 0), 0),
    spent: bookings.reduce((a, b) => a + (b.spent || 0), 0),
    impressions: bookings.reduce((a, b) => a + (b.impressions || 0), 0),
    scans: bookings.reduce((a, b) => a + (b.scans || 0), 0),
  };
}
