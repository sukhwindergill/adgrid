// Great-circle distance. Extracted from CreateCampaign so radius targeting and
// the reach overlap model share one tested implementation.
//
// Returns null rather than NaN for missing coordinates: callers must decide
// what an unknown distance means, and NaN silently poisons comparisons.

const EARTH_RADIUS_KM = 6371;

// `Number(null)` and `Number('')` are both 0, which is a perfectly finite
// latitude on the equator — so absent coordinates must be rejected before
// coercion, not after. Without this, a screen with no position silently
// reports a distance measured from off the coast of Africa.
function coord(value) {
  if (value === null || value === undefined || value === '') return NaN;
  return Number(value);
}

export function haversineKm(lat1, lon1, lat2, lon2) {
  const a1 = coord(lat1), o1 = coord(lon1), a2 = coord(lat2), o2 = coord(lon2);
  if (![a1, o1, a2, o2].every(Number.isFinite)) return null;

  const dLat = (a2 - a1) * Math.PI / 180;
  const dLon = (o2 - o1) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(a1 * Math.PI / 180) * Math.cos(a2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
