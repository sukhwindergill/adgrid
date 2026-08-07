// src/lib/locationIndex.js
//
// Builds a client-side location suggestion index from already-fetched screen
// rows. Every suggestion is guaranteed to match at least one real screen —
// there is no separate geocoding call or network round-trip. StepTargeting
// already fetches `allScreens` for the radius map, so this is a pure
// derivation, not a new data source.

export function buildLocationIndex(screens) {
  const byKey = new Map();
  for (const s of screens) {
    if (!s.city) continue;
    const country = s.country ?? '';
    const state = s.state ?? '';
    const key = `${country}|${state}|${s.city}`;
    let entry = byKey.get(key);
    if (!entry) {
      entry = { country, state, city: s.city, count: 0, coordSumLat: 0, coordSumLon: 0, coordCount: 0 };
      byKey.set(key, entry);
    }
    entry.count += 1;
    const lat = Number(s.lat), lon = Number(s.lon);
    if (s.lat != null && s.lon != null && Number.isFinite(lat) && Number.isFinite(lon)) {
      entry.coordSumLat += lat;
      entry.coordSumLon += lon;
      entry.coordCount += 1;
    }
  }
  return [...byKey.values()].map(e => ({
    country: e.country,
    state: e.state,
    city: e.city,
    count: e.count,
    hasCoords: e.coordCount > 0,
    centroidLat: e.coordCount > 0 ? e.coordSumLat / e.coordCount : null,
    centroidLon: e.coordCount > 0 ? e.coordSumLon / e.coordCount : null,
  }));
}

export function distinctCountries(index) {
  const seen = new Set();
  const out = [];
  for (const e of index) {
    if (e.country && !seen.has(e.country)) { seen.add(e.country); out.push(e.country); }
  }
  return out.sort();
}

export function distinctStates(index, country) {
  const seen = new Set();
  const out = [];
  for (const e of index) {
    if (!e.state || (country && e.country !== country) || seen.has(e.state)) continue;
    seen.add(e.state);
    out.push(e.state);
  }
  return out.sort();
}
