//
// Canonical list of notification events and the shared shape-normalization
// logic for `profiles.notification_prefs`. Both role's Settings >
// Notifications tabs import from here instead of hardcoding their own copy
// of this list, and both now write and read the nested per-channel shape
// (see supabase/functions/_shared/notificationPrefs.ts for the enforcement
// side, which still also accepts the legacy flat-boolean shape for rows
// saved before this module existed).

export const EVENTS = [
  { key: 'campaign_approved',  label: 'Campaign approved',         desc: 'When your campaign is approved by the operator', operatorOnly: false },
  { key: 'campaign_live',      label: 'Campaign live',             desc: 'When your campaign goes live on a screen', operatorOnly: false },
  { key: 'campaign_paused',    label: 'Campaign paused',           desc: 'When your campaign is paused due to low budget', operatorOnly: false },
  { key: 'low_budget',         label: 'Low budget alert',          desc: 'When a campaign has less than 20% of its run remaining', operatorOnly: false },
  { key: 'campaign_ended',     label: 'Campaign ended',            desc: 'When a campaign completes its scheduled run', operatorOnly: false },
  { key: 'scan_milestone',     label: 'Scan milestones',           desc: 'When a campaign hits 100, 500, 1k, or 5k QR scans', operatorOnly: false },
  { key: 'weekly_report',      label: 'Weekly performance report', desc: 'Summary of scans, spend, and active campaigns every Monday', operatorOnly: false },
  { key: 'payment_failed',     label: 'Payment failed',            desc: 'When a payment for your account fails', operatorOnly: false },
  { key: 'new_advertiser',     label: 'New advertiser joined',     desc: 'When a new advertiser signs up', operatorOnly: true },
  { key: 'campaign_submitted', label: 'Campaign submitted',        desc: 'When an advertiser submits a campaign for approval', operatorOnly: true },
  { key: 'payout_completed',   label: 'Payout completed',          desc: 'When a payout is transferred to your bank', operatorOnly: true },
  { key: 'weekly_revenue',     label: 'Weekly revenue summary',    desc: 'Weekly revenue across your screen network', operatorOnly: true },
  { key: 'team_member_joined', label: 'Team member joined',        desc: 'When someone accepts your team invite', operatorOnly: false },
  { key: 'account_suspended',  label: 'Account suspended',         desc: 'If your account is suspended', operatorOnly: false },
];

export function defaultChannelPrefs() {
  return Object.fromEntries(EVENTS.map(e => [e.key, { inApp: true, email: true }]));
}

export function normalizeChannelPrefs(raw) {
  const defaults = defaultChannelPrefs();
  if (typeof raw !== 'object' || raw === null) return defaults;

  const result = {};
  for (const event of EVENTS) {
    const stored = raw[event.key];
    if (typeof stored === 'object' && stored !== null) {
      result[event.key] = {
        inApp: stored.inApp !== false,
        email: stored.email !== false,
      };
    } else if (typeof stored === 'boolean') {
      result[event.key] = { inApp: stored, email: stored };
    } else {
      result[event.key] = defaults[event.key];
    }
  }
  return result;
}
