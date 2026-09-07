// src/lib/demandSignal.js
// Cold-start demand signal: pure helpers, no React or Supabase import here so
// they're trivially testable. See supabase/migrations/20260907120000_demand_signals.sql.

// Below this many recent searches, a raw count would misleadingly look like
// proof of demand in a market that's simply early. Stay honest about that
// instead of dressing up a small number.
export const DEMAND_SIGNAL_MIN_COUNT = 3;

// Log a search intent (city + venue category) once the advertiser's
// targeting settles on both. Fire-and-forget — a failed insert should never
// interrupt campaign creation, so errors are swallowed here, not surfaced.
export function logDemandSignal(supabase, { city, venueCategory }) {
  if (!city || !venueCategory) return;
  supabase.from('demand_signals').insert({ city, venue_category: venueCategory }).then(() => {});
}

// Turns a raw 30-day count into copy that's honest at every level, rather
// than a number with no context or a confident claim the data can't support.
export function demandSignalMessage({ count, city, venueLabel }) {
  if (count == null) return null;
  if (count === 0) {
    return {
      tone: 'early',
      text: `You'd be among the first ${venueLabel.toLowerCase()} screens listed in ${city} — early listings get first pick of advertiser interest as it grows.`,
    };
  }
  if (count < DEMAND_SIGNAL_MIN_COUNT) {
    return {
      tone: 'early',
      text: `${city} is an early market for ${venueLabel.toLowerCase()} screens — advertiser interest is just getting started here.`,
    };
  }
  return {
    tone: 'active',
    text: `${count} advertisers searched for ${venueLabel.toLowerCase()} screens in ${city} in the last 30 days.`,
  };
}
