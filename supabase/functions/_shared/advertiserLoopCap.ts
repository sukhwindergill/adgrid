/**
 * Caps how much of a screen's paid loop a single advertiser can occupy in
 * one display-feed poll (spec #7 — ad frequency & loop-share capping).
 *
 * max-ad-duration-enforcement already caps how long any one spot can run;
 * nothing capped how many of the paid slots in a loop can all belong to the
 * same advertiser. An advertiser booking several creatives/slots on one
 * screen could otherwise crowd out everyone else's variety on it — the
 * fastest way an operator's own venue experience turns hostile.
 *
 * capPct is a share of the total PAID loop duration (house ads are already
 * capped separately by house_ad_max_pct — see houseAdCap.ts — and are never
 * touched here). If there is only one advertiser among the paid entries,
 * capping would just blank part of the loop for no protective purpose, so
 * it's skipped: there's no variety to protect when there's only one buyer.
 *
 * DEFAULT_LOOP_SHARE_CAP_PCT is the sane platform default named in the
 * spec's own "cut for v1" line — ship this before any per-operator
 * configurability.
 */
export const DEFAULT_LOOP_SHARE_CAP_PCT = 40;

export function capAdvertiserLoopShare<T extends { duration: number; advertiser_id: string | null }>(
  paid: T[],
  capPct: number = DEFAULT_LOOP_SHARE_CAP_PCT,
): T[] {
  if (paid.length === 0) return paid;
  if (capPct >= 100) return paid;

  const totalDuration = paid.reduce((sum, c) => sum + c.duration, 0);
  if (totalDuration <= 0) return paid;

  const uniqueAdvertisers = new Set(paid.map((c) => c.advertiser_id));
  if (uniqueAdvertisers.size <= 1) return paid;

  const allowedPerAdvertiser = capPct >= 0 ? (capPct / 100) * totalDuration : 0;

  const runningByAdvertiser = new Map<string | null, number>();
  const kept: T[] = [];
  for (const entry of paid) {
    const running = runningByAdvertiser.get(entry.advertiser_id) ?? 0;
    if (running + entry.duration > allowedPerAdvertiser) continue;
    kept.push(entry);
    runningByAdvertiser.set(entry.advertiser_id, running + entry.duration);
  }
  return kept;
}
