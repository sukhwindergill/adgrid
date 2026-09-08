// Programmatic backfill fill-priority logic (Competitive Parity Program,
// Phase 6, G20 -- see docs/superpowers/specs/2026-09-08-programmatic-
// backfill-design.md). Pure -- no Deno APIs -- so vitest can run it
// directly, same pattern as houseAdCap.ts.
//
// Extends display-feed's existing fill-priority tiers (paid -> house ads)
// with a third, lowest tier: programmatic fill only ever claims loop time
// nothing else claimed. There is no fixed "loop length" concept in this
// codebase (house-ad capping is proportional, not slot-count-based), so
// "unsold time" is defined pragmatically as: the loop this poll has
// nothing paid or house-ad in it at all. That's the one unambiguous case
// where filling with programmatic content can never bump a higher tier.

export interface ProgrammaticFillRow {
  id: string;
  played: boolean;
  expires_at: string;
}

/** A fetched fill is only usable if it hasn't been served yet and hasn't expired. */
export function isFillValid(fill: ProgrammaticFillRow | null | undefined, now: Date = new Date()): boolean {
  if (!fill) return false;
  if (fill.played) return false;
  return new Date(fill.expires_at) > now;
}

/** A partner's offered CPM must meet or exceed the screen's own floor. */
export function meetsCpmFloor(offeredCpm: number, cpmFloor: number | null | undefined): boolean {
  const floor = cpmFloor ?? 0;
  return Number.isFinite(offeredCpm) && offeredCpm >= floor;
}

/**
 * Should fetch-programmatic-fill bother fetching a new fill for this
 * screen this cycle? Only if the operator has opted in and there isn't
 * already a valid (unexpired, unplayed) fill cached.
 */
export function shouldFetchFill(
  screen: { programmatic_backfill_enabled: boolean },
  existingFill: ProgrammaticFillRow | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!screen.programmatic_backfill_enabled) return false;
  return !isFillValid(existingFill, now);
}

/**
 * Should display-feed append the cached fill to this poll's loop? Only
 * when the operator has opted in, this poll's loop is otherwise
 * completely empty (nothing paid, no house ad -- the one case where
 * appending programmatic content can never bump a higher-priority tier),
 * and a valid fill exists.
 */
export function shouldServeProgrammaticFill(
  screen: { programmatic_backfill_enabled: boolean },
  feedEntryCount: number,
  fill: ProgrammaticFillRow | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!screen.programmatic_backfill_enabled) return false;
  if (feedEntryCount > 0) return false;
  return isFillValid(fill, now);
}
