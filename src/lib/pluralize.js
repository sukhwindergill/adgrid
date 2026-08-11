// Simple English pluralizer for counted UI labels ("1 screen" vs "2 screens").
// Not for user-facing copy edge cases (irregular plurals) — pass `plural` explicitly for those.
export function pluralize(count, singular, plural = `${singular}s`) {
  return count === 1 ? singular : plural
}
