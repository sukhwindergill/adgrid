// Data for the public /screens page. Reads only the two narrow anon-safe
// RPCs from 20260924175223_public_screen_access.sql -- never screens or
// advertiser_screens, which anon can't (and shouldn't) read.
import { VENUE_TAXONOMY } from './venueTypes.js';

// Below this many real live screens the map stays hidden and the page
// shows launch cities and venue types instead (same credibility reasoning
// as the hero stat). The RPC enforces the same floor server-side; keep the
// two in sync.
export const PUBLIC_MAP_MIN_SCREENS = 25;

export async function fetchPublicScreens(supabase) {
  const [{ data: count, error: countErr }, { data: rows, error: rowsErr }] = await Promise.all([
    supabase.rpc('live_screen_count'),
    supabase.rpc('public_screen_map'),
  ]);
  if (countErr || rowsErr) throw countErr || rowsErr;
  return { count: count ?? 0, rows: rows ?? [] };
}

/**
 * Rolls public rows up into what the page shows: cities, venue types with
 * counts, and the floor-price range.
 */
export function summarizePublicScreens(rows = []) {
  const cities = new Map();
  const venues = new Map();
  const prices = [];

  for (const r of rows) {
    if (r.city) cities.set(r.city, (cities.get(r.city) ?? 0) + 1);
    const venue = VENUE_TAXONOMY[r.venue_category]?.label ?? VENUE_TAXONOMY.other.label;
    venues.set(venue, (venues.get(venue) ?? 0) + 1);
    const cpm = Number(r.cpm_floor);
    if (Number.isFinite(cpm) && cpm > 0) prices.push(cpm);
  }

  const byCount = m => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }));

  return {
    cities: byCount(cities),
    venues: byCount(venues),
    cpmRange: prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
  };
}
