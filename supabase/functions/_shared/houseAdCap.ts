/**
 * Trims a screen's house-ad entries for one display-feed poll so their
 * combined duration never exceeds the operator's configured max share of
 * the loop (screens.house_ad_max_pct), and never reduces the paid list.
 *
 * capPct is a share of the COMBINED (paid + house) loop, not of paid alone,
 * so: houseDuration <= capPct/100 * (paidDuration + houseDuration), which
 * rearranges to houseDuration <= capPct/(100-capPct) * paidDuration.
 *
 * If there are no paid entries this poll, there's no paid revenue to
 * protect and leaving the screen dark under an unused cap would defeat
 * the point of the feature -- house ads are returned unfiltered.
 *
 * capPct === 100 is treated as unlimited (the (100-capPct) divisor would
 * otherwise be zero).
 */
export function capHouseAds<T extends { duration: number }>(
  paid: T[],
  house: T[],
  capPct: number,
): T[] {
  if (paid.length === 0) return house;
  if (capPct >= 100) return house;
  if (capPct <= 0) return [];

  const paidDuration = paid.reduce((sum, c) => sum + c.duration, 0);
  const allowedHouseDuration = (capPct / (100 - capPct)) * paidDuration;

  const kept: T[] = [];
  let runningDuration = 0;
  for (const entry of house) {
    if (runningDuration + entry.duration > allowedHouseDuration) break;
    kept.push(entry);
    runningDuration += entry.duration;
  }
  return kept;
}
