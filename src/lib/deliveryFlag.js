// src/lib/deliveryFlag.js
// Spec #1 (proof-of-play & screen alerting), the remaining v1 slice: the
// operator alert (screen-health-cron's "screen_offline" notification) and
// the account-wide delivery-health rollup (DeliveryHealthCard on
// AdvDashboard) already existed. What didn't: an advertiser scanning "Your
// Campaigns" had no way to tell WHICH campaign was affected by downtime --
// only an account-wide sum. This flags an individual campaign's own
// campaign_delivery_health row so a delivery problem shows up right where
// the advertiser is already looking, not just in an aggregate elsewhere.
//
// Pure, so it's testable without touching Supabase or React.

// Matches the red threshold DeliveryHealthCard already uses, so a single
// campaign is flagged by the same bar the account-wide card judges itself by.
export const DELIVERY_FLAG_PCT_THRESHOLD = 85;

export function campaignDeliveryFlag(healthRow) {
  if (!healthRow) return null;

  const offlineDays = Number(healthRow.offline_days) || 0;
  const pct = healthRow.delivery_pct;
  const hasPct = pct !== null && pct !== undefined && Number.isFinite(Number(pct));

  if (offlineDays > 0) {
    return {
      severity: 'warning',
      label: `Screen offline ${offlineDays} ${offlineDays === 1 ? 'day' : 'days'} during flight`,
    };
  }
  if (hasPct && Number(pct) < DELIVERY_FLAG_PCT_THRESHOLD) {
    return {
      severity: 'warning',
      label: `Delivery at ${Number(pct).toFixed(0)}% of scheduled plays`,
    };
  }
  return null;
}
