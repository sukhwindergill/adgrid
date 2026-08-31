// Per-day time-window override for a booking's flat time_start/time_end.
// Pure — no Deno APIs — so vitest runs it directly (same pattern as pacing.ts).

export interface DaypartingMap {
  [day: string]: { time_start: string; time_end: string } | undefined;
}

// Resolves the effective [start, end] window for `currentDay`. A booking
// with no dayparting configured (null/undefined/empty), or with no entry
// for the current day, falls straight back to the flat time_start/time_end
// -- unchanged from today's behavior for every existing campaign.
export function resolveDayWindow(
  dayparting: DaypartingMap | null | undefined,
  currentDay: string,
  fallbackStart: string | null | undefined,
  fallbackEnd: string | null | undefined,
): { time_start: string; time_end: string } {
  const override = dayparting?.[currentDay];
  if (override && override.time_start && override.time_end) {
    return { time_start: override.time_start, time_end: override.time_end };
  }
  return {
    time_start: fallbackStart ?? "00:00",
    time_end: fallbackEnd ?? "23:59",
  };
}
