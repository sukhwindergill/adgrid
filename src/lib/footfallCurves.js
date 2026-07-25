// Modelled hourly footfall shapes by venue category.
//
// Used ONLY where camera data is too sparse to measure an audience. Anything
// derived from these curves must be labelled basis = 'modelled' in the UI —
// never presented as measured.
//
// Keys match VENUE_TAXONOMY in ./venueTypes.js. 'other' has no characteristic
// shape and deliberately falls through to the default curve.

const N = 0; // closed / negligible

// Raw relative weights per hour 0–23; normalized to sum to 1 on read.
const RAW = {
  //              0  1  2  3  4  5  6   7   8   9  10  11  12  13  14  15  16  17  18  19  20  21  22  23
  default:      [1, 1, N, N, 1, 2, 4,  6,  8,  7,  7,  8,  9,  8,  7,  7,  8,  9,  8,  6,  5,  4,  3,  2],
  transport:    [1, 1, N, N, 1, 3, 7, 12, 15,  9,  6,  6,  7,  6,  6,  7, 10, 14, 11,  7,  4,  3,  2,  1],
  retail:       [N, N, N, N, N, 1, 2,  3,  5,  7,  9, 10, 11, 10, 10, 10, 10,  9,  8,  6,  4,  2,  1,  N],
  food_drink:   [1, N, N, N, N, 1, 4,  8, 10,  6,  5,  9, 14, 11,  6,  5,  6,  9, 12, 10,  6,  4,  3,  2],
  fitness:      [N, N, N, N, 1, 4, 9, 11,  9,  6,  5,  5,  6,  5,  5,  5,  7, 11, 12,  9,  6,  3,  1,  N],
  healthcare:   [N, N, N, N, N, 1, 3,  6, 10, 11, 11, 10,  9,  9,  9,  8,  7,  5,  3,  2,  1,  N,  N,  N],
  hospitality:  [1, 1, 1, N, N, 1, 4,  8, 10,  8,  6,  6,  7,  6,  6,  6,  7,  8,  9,  8,  6,  4,  3,  2],
  education:    [N, N, N, N, N, 1, 3,  8, 12, 10,  9,  9, 11, 10,  9,  8,  6,  4,  2,  1,  1,  N,  N,  N],
  entertainment:[2, 1, 1, N, N, N, 1,  2,  3,  4,  5,  7,  8,  8,  8,  8,  9, 10, 11, 11, 10,  8,  6,  4],
};

function normalize(weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  return total === 0 ? weights.map(() => 0) : weights.map(w => w / total);
}

export const VENUE_CURVES = Object.fromEntries(
  Object.entries(RAW).map(([key, weights]) => [key, normalize(weights)]),
);

export function hourlyShare(venueCategory) {
  const key = String(venueCategory ?? '').toLowerCase();
  return VENUE_CURVES[key] ?? VENUE_CURVES.default;
}

export function modelledPeoplePerMin({ monthlyTraffic, venueCategory, hour, daysInMonth = 30 }) {
  const monthly = Number(monthlyTraffic);
  const h = Number(hour);
  if (!Number.isFinite(monthly) || monthly <= 0) return 0;
  if (!Number.isInteger(h) || h < 0 || h > 23) return 0;
  const perDay = monthly / daysInMonth;
  return (perDay * hourlyShare(venueCategory)[h]) / 60;
}
