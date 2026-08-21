import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const CENSUS_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days — census data is slow-moving

// Resolves lat/lng to a US Census block group and pulls ACS 5-year age/income
// estimates. Non-US screens (no Census coverage) return { available: false }
// rather than erroring — the frontend renders "not available for this
// location" per spec, it never blocks the listing flow.
async function fetchCensusEstimate(lat: number, lng: number) {
  try {
    const geoRes = await fetch(
      `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&layers=10&format=json`,
    );
    if (!geoRes.ok) return null;
    const geoJson = await geoRes.json();
    const blockGroup = geoJson?.result?.geographies?.["Census Block Groups"]?.[0];
    if (!blockGroup) return null; // outside US Census coverage

    const { STATE, COUNTY, TRACT, BLKGRP } = blockGroup;
    const acsRes = await fetch(
      `https://api.census.gov/data/2022/acs/acs5?get=B01002_001E,B19013_001E&for=block%20group:${BLKGRP}&in=state:${STATE}%20county:${COUNTY}%20tract:${TRACT}`,
    );
    if (!acsRes.ok) return null;
    const acsJson = await acsRes.json();
    const row = acsJson?.[1]; // row 0 is headers
    if (!row) return null;

    const [medianAgeStr, medianIncomeStr] = row;
    const medianAge = Number(medianAgeStr);
    const medianIncome = Number(medianIncomeStr);
    const incomeBand =
      medianIncome < 40000 ? "under_40k" :
      medianIncome < 75000 ? "40k_75k" :
      medianIncome < 120000 ? "75k_120k" : "120k_plus";

    return {
      areaGeoId: `${STATE}${COUNTY}${TRACT}${BLKGRP}`,
      medianAge: Number.isFinite(medianAge) ? medianAge : null,
      incomeBand,
    };
  } catch (err) {
    // Network failure, DNS failure, timeout, or malformed JSON from either
    // Census API — degrade to "no estimate available" rather than throwing,
    // per the spec's "must never block a listing" constraint.
    console.error("fetchCensusEstimate failed", err);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  let screenId: string | undefined;
  try {
    ({ screenId } = await req.json());
  } catch (err) {
    return new Response(JSON.stringify({ error: "invalid JSON body" }), { status: 400, headers: CORS });
  }
  if (!screenId) {
    return new Response(JSON.stringify({ error: "screenId required" }), { status: 400, headers: CORS });
  }

  const { data: cached } = await supabase
    .from("screen_demographics")
    .select("*")
    .eq("screen_id", screenId)
    .maybeSingle();

  if (cached && Date.now() - new Date(cached.fetched_at).getTime() < CENSUS_MAX_AGE_MS) {
    return new Response(JSON.stringify({
      available: true, medianAge: cached.median_age, incomeBand: cached.income_band, source: cached.source,
    }), { headers: CORS });
  }

  const { data: screen } = await supabase.from("screens").select("lat, lng").eq("id", screenId).maybeSingle();
  if (!screen?.lat || !screen?.lng) {
    return new Response(JSON.stringify({ available: false }), { headers: CORS });
  }

  const estimate = await fetchCensusEstimate(screen.lat, screen.lng);
  if (!estimate) {
    return new Response(JSON.stringify({ available: false }), { headers: CORS });
  }

  await supabase.from("screen_demographics").upsert({
    screen_id: screenId,
    area_geo_id: estimate.areaGeoId,
    median_age: estimate.medianAge,
    income_band: estimate.incomeBand,
    source: "us_census_acs",
    fetched_at: new Date().toISOString(),
  });

  return new Response(JSON.stringify({
    available: true, medianAge: estimate.medianAge, incomeBand: estimate.incomeBand, source: "us_census_acs",
  }), { headers: CORS });
});
