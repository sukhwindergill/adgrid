export async function geocodeAddress(query, token, fetchImpl = fetch) {
  if (!query?.trim() || !token) return null;
  const res = await fetchImpl(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?limit=1&access_token=${token}`
  );
  const data = await res.json();
  const feature = data.features?.[0];
  if (!feature) return null;
  const [lng, lat] = feature.center;
  return { lat, lng };
}
