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

// Whether a screen is inside its operating hours at `currentTime` (HH:MM).
// screens.operating_hours_* are Postgres `time` columns, which come back as
// "HH:MM:SS" -- compared as raw strings against an "HH:MM" clock, "07:00"
// sorts before "07:00:00" and the opening minute would read as closed, so
// both bounds are trimmed to HH:MM first. A missing bound means no
// restriction. start === end means open around the clock (there is no
// meaningful zero-length operating day). Overnight hours (e.g. 18:00-02:00
// for a bar) wrap past midnight via isTimeInWindow -- the plain
// `currentTime < start || currentTime > end` check this replaces was always
// true for them, so a late-night venue's screen never served a single ad.
export function isWithinOperatingHours(
  currentTime: string,
  start: string | null | undefined,
  end: string | null | undefined,
): boolean {
  if (!start || !end) return true;
  const s = start.slice(0, 5);
  const e = end.slice(0, 5);
  if (s === e) return true;
  return isTimeInWindow(currentTime, s, e);
}
