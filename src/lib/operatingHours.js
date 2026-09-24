// screens.operating_hours_* gate ad serving in display-feed (see
// isWithinOperatingHours in supabase/functions/_shared/dayparting.ts). The DB
// default is 07:00-22:00, and until OperatingHoursFields existed the web app had
// no way to change it -- a 24h gym or an 18:00-02:00 bar registered on web
// silently lost those hours of paid inventory.
//
// "Open 24 hours" is stored as 00:00-23:59: at display-feed's HH:MM
// granularity that covers every minute, and it reads sensibly wherever the
// raw hours are shown (mobile screen detail, advertiser screen listing).
const ALL_DAY_START = '00:00';
const ALL_DAY_END = '23:59';
const DEFAULT_START = '07:00';
const DEFAULT_END = '22:00';

// Postgres `time` comes back as HH:MM:SS; <input type="time"> wants HH:MM.
const hhmm = (v) => (typeof v === 'string' && v.length >= 5 ? v.slice(0, 5) : null);

export function hoursFormFromScreen(screen) {
  const start = hhmm(screen?.operating_hours_start) ?? DEFAULT_START;
  const end = hhmm(screen?.operating_hours_end) ?? DEFAULT_END;
  const allDay = start === end || (start === ALL_DAY_START && end === ALL_DAY_END);
  return { start, end, allDay };
}

export function hoursUpdates(hours) {
  if (hours.allDay) {
    return { operating_hours_start: ALL_DAY_START, operating_hours_end: ALL_DAY_END };
  }
  return { operating_hours_start: hours.start, operating_hours_end: hours.end };
}

// Returns an error string, or null when the hours can be saved. Overnight
// (end before start) is valid -- it wraps past midnight.
export function hoursError(hours) {
  if (hours.allDay) return null;
  if (!hhmm(hours.start) || !hhmm(hours.end)) return 'Enter an opening and closing time.';
  if (hours.start === hours.end) return 'Opening and closing times are the same — tick "Open 24 hours" instead.';
  return null;
}
