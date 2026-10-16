// Advertiser-facing campaign status, derived from bookings.status plus the
// per-screen review rows in campaign_screens. bookings.status values come
// from the web app's flow (pending_review -> scheduled/active <-> paused ->
// completed; 'completed' is the schema's only terminal status, see
// supabase/functions/_shared/campaignStatusRules.ts).

export const STATUS_META = {
  pending:  { label: 'Pending approval', variant: 'amber' },
  scheduled: { label: 'Scheduled', variant: 'blue' },
  live:     { label: 'Live', variant: 'green' },
  paused:   { label: 'Paused', variant: 'muted' },
  ended:    { label: 'Ended', variant: 'muted' },
  rejected: { label: 'Rejected', variant: 'red' },
};

// Filter pills on the Campaigns list. 'scheduled' sits under Live (approved
// and paid, just not started yet); 'rejected' sits under Ended.
export const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'live', label: 'Live' },
  { value: 'paused', label: 'Paused' },
  { value: 'ended', label: 'Ended' },
];

const FILTER_GROUP = {
  pending: 'pending', scheduled: 'live', live: 'live', paused: 'paused', ended: 'ended', rejected: 'ended',
};

export function matchesFilter(displayStatus, filter) {
  return filter === 'all' || FILTER_GROUP[displayStatus] === filter;
}

// screens: campaign_screens rows for this campaign ({ status, reject_reason }).
export function deriveDisplayStatus(bookingStatus, screens = []) {
  const allRejected = screens.length > 0 && screens.every(s => s.status === 'rejected');
  if (bookingStatus === 'rejected' || (bookingStatus === 'pending_review' && allRejected)) return 'rejected';
  if (bookingStatus === 'pending_review') return 'pending';
  if (bookingStatus === 'scheduled') return 'scheduled';
  if (bookingStatus === 'active') return 'live';
  if (bookingStatus === 'paused') return 'paused';
  if (bookingStatus === 'completed' || bookingStatus === 'cancelled') return 'ended';
  return 'pending';
}

// screenNames: { [screen_id]: name } from advertiser_screens.
export function rejectionReasons(screens = [], screenNames = {}) {
  return screens
    .filter(s => s.status === 'rejected')
    .map(s => ({
      screenId: s.screen_id,
      screenName: screenNames[s.screen_id] ?? 'A screen',
      reason: s.reject_reason || 'No reason given',
    }));
}

// Same transitions manage-campaign-status accepts (campaignStatusRules.ts) --
// only offer the button the server will actually honour.
export function canPause(bookingStatus) {
  return bookingStatus === 'active' || bookingStatus === 'scheduled';
}

export function canResume(bookingStatus) {
  return bookingStatus === 'paused';
}

export function sumDelivery(rows = []) {
  return rows.reduce((acc, r) => ({
    plays: acc.plays + (Number(r.plays) || 0),
    impressions: acc.impressions + (Number(r.impressions) || 0),
    scans: acc.scans + (Number(r.scans) || 0),
  }), { plays: 0, impressions: 0, scans: 0 });
}
