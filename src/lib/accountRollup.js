// src/lib/accountRollup.js
// Spec #8 (agency console): per-account access already existed
// (GrantAccessModal/AccessSettingsView/TeamClientRoles) and AccountHub.jsx
// already listed every account a user has a role on with one-click
// switching -- no re-auth, no separate login. What was missing was the
// rollup itself: spend and active-campaign counts per account, so an
// agency user isn't switching into each one just to see whether anything
// needs attention.
//
// Pure, so it's testable without touching Supabase or React.

// bookings rows: { advertiser_id, status, spent }. accountIds: the account
// ids to summarize (own account + every granted account). Returns a map
// keyed by account id, always present for every requested id (zero rows
// still gets a zero-value entry, not an absent key) so a card never has to
// guess between "no data yet" and "loading."
export function summarizeAccountBookings(bookings = [], accountIds = []) {
  const ACTIVE_STATUSES = new Set(['active', 'scheduled']);
  const summary = {};
  for (const id of accountIds) {
    summary[id] = { spend: 0, activeCampaigns: 0 };
  }
  for (const b of bookings) {
    const entry = summary[b.advertiser_id];
    if (!entry) continue; // a row for an account not in this rollup -- ignore
    entry.spend += Number(b.spent) || 0;
    if (ACTIVE_STATUSES.has(b.status)) entry.activeCampaigns += 1;
  }
  return summary;
}
