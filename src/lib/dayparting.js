// Frontend helpers for the wizard's per-day time-window override. Mirrors
// supabase/functions/_shared/dayparting.ts's resolution semantics (null/no
// entry for a day falls back to the flat time_start/time_end) but these two
// are UI-side conveniences, not the resolution logic itself -- that only
// runs server-side in display-feed.

// Builds a dayparting map covering exactly `days`, seeding any newly-added
// day from the flat fallback window and dropping any day no longer
// selected. Used both when first switching into "different times per day"
// and whenever the selected days-of-week change afterward.
export function syncDaypartingDays(dayparting, days, fallbackStart, fallbackEnd) {
  const next = {};
  for (const day of days) {
    next[day] = dayparting?.[day] ?? { time_start: fallbackStart || '00:00', time_end: fallbackEnd || '23:59' };
  }
  return next;
}
