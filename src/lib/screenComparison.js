// src/lib/screenComparison.js
// Spec (Story Map, Advertiser epic): "compare performance screen-by-screen" --
// an advertiser running one campaign across several screens had no way to
// tell which screen was actually working, only an account-wide or
// per-campaign total. This breaks a campaign's own campaign_delivery_daily
// rows (already fetched by AdvDashboard.jsx for the reach estimate) down by
// screen instead of summing them away.
//
// Pure, so it's testable without touching Supabase or React.

export function perScreenBreakdown(deliveryRows = [], campaignId, screenNames = {}) {
  const byScreen = new Map();
  for (const row of deliveryRows) {
    if (row.campaign_id !== campaignId) continue;
    const entry = byScreen.get(row.screen_id) ?? { screen_id: row.screen_id, impressions: 0, scans: 0 };
    entry.impressions += Number(row.impressions) || 0;
    entry.scans += Number(row.billable_scans) || 0;
    byScreen.set(row.screen_id, entry);
  }
  return [...byScreen.values()]
    .map(e => ({ ...e, screen_name: screenNames[e.screen_id] ?? e.screen_id }))
    .sort((a, b) => b.impressions - a.impressions);
}
