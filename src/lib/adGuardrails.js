// Buy-side guardrails (gap analysis G23): frequency caps, competitive
// separation and operator category exclusions.
//
// Category matching is case/whitespace-insensitive on purpose: a booking's
// category comes from the wizard's fixed CATEGORIES list, but
// screens.content_categories_blocked is a free text[] that predates this UI
// and may hold hand-typed values ("alcohol", " Alcohol "). Keep this in step
// with supabase/functions/_shared/adGuardrails.ts, which display-feed uses
// for the same rules server-side.

// Categories operators most often refuse to run. Shown first in the screen
// exclusion picker; any CATEGORIES value can still be blocked.
export const SENSITIVE_CATEGORIES = ['Alcohol', 'Cannabis', 'Gambling'];

// 5s is the shortest ad duration the wizard allows, so 720 plays (one every
// 5s, back to back for a full hour) is the most any cap could ever mean.
export const MAX_FREQUENCY_CAP = 720;

export function normalizeCategory(category) {
  if (typeof category !== 'string') return null;
  const trimmed = category.trim().toLowerCase();
  return trimmed === '' ? null : trimmed;
}

// True when `category` is in the screen's blocked list. A campaign with no
// category is never blocked -- there is nothing to match against.
export function isCategoryBlocked(category, blockedCategories) {
  const cat = normalizeCategory(category);
  if (!cat || !Array.isArray(blockedCategories)) return false;
  return blockedCategories.some(b => normalizeCategory(b) === cat);
}

// Splits screens into those that accept `category` and those whose operator
// has excluded it (via screens.content_categories_blocked).
export function partitionScreensByCategory(screens, category) {
  const allowed = [];
  const blocked = [];
  for (const s of screens) {
    (isCategoryBlocked(category, s.content_categories_blocked) ? blocked : allowed).push(s);
  }
  return { allowed, blocked };
}

// Parses the wizard's optional "max plays per screen per hour" input.
// Blank means no cap (value null). Anything else must be a whole number in
// 1..MAX_FREQUENCY_CAP.
export function parseFrequencyCap(input) {
  if (input == null) return { value: null, error: null };
  const raw = String(input).trim();
  if (raw === '') return { value: null, error: null };
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > MAX_FREQUENCY_CAP) {
    return { value: null, error: `Frequency cap must be a whole number from 1 to ${MAX_FREQUENCY_CAP}, or blank for no cap.` };
  }
  return { value: n, error: null };
}

// Toggles one category in a screen's blocked list, preserving the existing
// entries' original spelling and dropping case-insensitive duplicates.
export function toggleBlockedCategory(blockedCategories, category) {
  const list = Array.isArray(blockedCategories) ? blockedCategories : [];
  if (isCategoryBlocked(category, list)) {
    const cat = normalizeCategory(category);
    return list.filter(b => normalizeCategory(b) !== cat);
  }
  return [...list, category];
}
