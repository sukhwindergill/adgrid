/**
 * Buy-side guardrails enforced by display-feed (gap analysis G23).
 *
 * Mirrors src/lib/adGuardrails.js's category matching (case/whitespace
 * insensitive) -- edge functions can't import from src/, so keep the two in
 * step.
 *
 * Three rules, applied in this order by display-feed:
 *  1. dropBlockedCategories -- an operator's per-screen exclusion list
 *     (screens.content_categories_blocked) always wins. The wizard already
 *     keeps those screens out of targeting, but campaigns created through
 *     api-campaigns, or before the operator added the exclusion, can still
 *     hold an approved campaign_screens row; this is the backstop.
 *  2. applyFrequencyCap -- bookings.frequency_cap_per_hour, counted from
 *     this screen's ad_plays in the trailing hour. A campaign at its cap is
 *     left out of this poll's loop; one under it keeps at most its remaining
 *     plays. The player only re-polls every 30s and ingests plays in
 *     batches, so the cap can be overshot by roughly one poll's worth of
 *     loops -- it bounds frequency, it isn't an exact counter.
 *  3. separateCompetitors -- reorders the final loop so two different
 *     advertisers in the same category never play back to back, including
 *     across the loop's wrap-around (the player cycles the list). Entries
 *     that can't be placed anywhere without a clash are dropped rather than
 *     played next to a competitor.
 */

export function normalizeCategory(category: unknown): string | null {
  if (typeof category !== "string") return null;
  const trimmed = category.trim().toLowerCase();
  return trimmed === "" ? null : trimmed;
}

export function isCategoryBlocked(category: unknown, blocked: unknown): boolean {
  const cat = normalizeCategory(category);
  if (!cat || !Array.isArray(blocked)) return false;
  return blocked.some((b) => normalizeCategory(b) === cat);
}

export function dropBlockedCategories<T extends { category?: string | null }>(
  entries: T[],
  blocked: string[] | null | undefined,
): T[] {
  if (!Array.isArray(blocked) || blocked.length === 0) return entries;
  return entries.filter((e) => !isCategoryBlocked(e.category, blocked));
}

export function applyFrequencyCap<T extends { id: string; frequency_cap_per_hour?: number | null }>(
  entries: T[],
  playsLastHour: Map<string, number>,
): T[] {
  const remaining = new Map<string, number>();
  const kept: T[] = [];
  for (const e of entries) {
    const cap = e.frequency_cap_per_hour;
    if (cap == null || !(cap > 0)) {
      kept.push(e);
      continue;
    }
    if (!remaining.has(e.id)) {
      remaining.set(e.id, Math.max(0, cap - (playsLastHour.get(e.id) ?? 0)));
    }
    const left = remaining.get(e.id)!;
    if (left <= 0) continue;
    remaining.set(e.id, left - 1);
    kept.push(e);
  }
  return kept;
}

type Separable = { category?: string | null; advertiser_id?: string | null };

// Same category, different advertiser. One advertiser's own creatives may
// run back to back -- they aren't competing with themselves.
export function isCompetitiveClash(a: Separable, b: Separable): boolean {
  const ca = normalizeCategory(a.category);
  if (!ca || ca !== normalizeCategory(b.category)) return false;
  return (a.advertiser_id ?? null) !== (b.advertiser_id ?? null);
}

/**
 * `rotation` only matters when some entry has to be dropped: without it the
 * same competitor would lose every poll and never air on a small loop. The
 * clash-free arrangement is tried first so the loop keeps its original
 * order whenever possible; only if that drops something is the input
 * rotated by `rotation` (display-feed passes the current minute) so which
 * competitor sits out changes over time.
 */
export function separateCompetitors<T extends Separable>(entries: T[], rotation = 0): T[] {
  const straight = arrangeWithoutClashes(entries);
  if (straight.length === entries.length || entries.length < 2) return straight;
  const k = ((Math.floor(rotation) % entries.length) + entries.length) % entries.length;
  if (k === 0) return straight;
  return arrangeWithoutClashes([...entries.slice(k), ...entries.slice(0, k)]);
}

function arrangeWithoutClashes<T extends Separable>(entries: T[]): T[] {
  if (entries.length < 2) return entries;

  const fitsAt = (list: T[], entry: T, i: number): boolean => {
    // Inserting at index i places entry between list[i-1] and list[i];
    // the loop wraps, so index 0's left neighbour is the last entry.
    if (list.length === 0) return true;
    const prev = list[(i - 1 + list.length) % list.length];
    const next = list[i % list.length];
    return !isCompetitiveClash(prev, entry) && !isCompetitiveClash(entry, next);
  };

  const remaining = [...entries];
  const result: T[] = [];
  while (remaining.length > 0) {
    // Prefer original order: the first remaining entry that doesn't clash
    // with whatever played just before it.
    const last = result[result.length - 1];
    const idx = last === undefined ? 0 : remaining.findIndex((e) => !isCompetitiveClash(last, e));
    if (idx !== -1) {
      result.push(remaining.splice(idx, 1)[0]);
      continue;
    }
    // Everything left clashes with the tail -- slot the next one into an
    // earlier gap where both neighbours are fine, or drop it.
    const entry = remaining.shift()!;
    for (let i = 1; i < result.length; i++) {
      if (fitsAt(result, entry, i)) {
        result.splice(i, 0, entry);
        break;
      }
    }
  }

  // Wrap-around: the last entry plays right before the first. Move the
  // tail into an internal gap if one fits, else drop it. Moves are bounded
  // so this always terminates; past the bound, clashing tails are dropped.
  let moves = result.length;
  while (result.length > 1 && isCompetitiveClash(result[result.length - 1], result[0])) {
    const tail = result.pop()!;
    if (moves-- <= 0) continue;
    for (let i = 1; i < result.length; i++) {
      if (fitsAt(result, tail, i)) {
        result.splice(i, 0, tail);
        break;
      }
    }
  }
  return result;
}
