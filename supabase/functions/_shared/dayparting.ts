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

// Whether `currentTime` falls within [start, end]. Handles an overnight
// window (end < start, e.g. 22:00-02:00 for a late-night venue) by treating
// it as wrapping past midnight instead of an empty range -- a plain
// `currentTime >= start && currentTime <= end` can never be true when
// end < start, so a campaign scheduled for exactly that kind of window would
// otherwise silently never play, any day it's scheduled for.
export function isTimeInWindow(currentTime: string, start: string, end: string): boolean {
  if (end < start) {
    return currentTime >= start || currentTime <= end;
  }
  return currentTime >= start && currentTime <= end;
}
