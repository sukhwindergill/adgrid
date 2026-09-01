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

// Flattens the city-level index into one list spanning all three
// granularities (country / state / city) so a single combobox can offer
// "United States", "Ontario", and "Toronto" side by side, each tagged with
// its level. Screen counts roll up: a country entry's count is the sum of
// every city under it, same for state. Used by the consolidated targeting
// combobox in StepTargeting — replaces the old stacked Country/State/City
// selects.
export function buildFlatLocationOptions(index) {
  const countries = new Map(); // code -> { count, hasCoords }
  const states = new Map();    // "country|state" -> { country, state, count, hasCoords }
  const cities = [];

  for (const e of index) {
    if (e.country) {
      const c = countries.get(e.country) ?? { count: 0, hasCoords: false };
      c.count += e.count;
      c.hasCoords = c.hasCoords || e.hasCoords;
      countries.set(e.country, c);
    }
    if (e.country && e.state) {
      const key = `${e.country}|${e.state}`;
      const s = states.get(key) ?? { country: e.country, state: e.state, count: 0, hasCoords: false };
      s.count += e.count;
      s.hasCoords = s.hasCoords || e.hasCoords;
      states.set(key, s);
    }
    cities.push({ level: 'city', country: e.country, state: e.state, city: e.city, count: e.count, hasCoords: e.hasCoords, centroidLat: e.centroidLat, centroidLon: e.centroidLon });
  }

  const countryOpts = [...countries.entries()].map(([country, v]) => ({ level: 'country', country, count: v.count, hasCoords: v.hasCoords }));
  const stateOpts = [...states.values()].map(v => ({ level: 'state', country: v.country, state: v.state, count: v.count, hasCoords: v.hasCoords }));

  return [...countryOpts, ...stateOpts, ...cities];
}
