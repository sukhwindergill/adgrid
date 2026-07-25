// How many plays a (campaign, screen, day) SHOULD have had.
//
// Pure — no Deno APIs, no database — so vitest runs it directly. This is the
// billing-side counterpart to ad_plays: what the advertiser paid for, versus
// what actually ran.
//
// Model: on a scheduled day the campaign occupies `slots` PERCENT of the
// airtime where its daypart overlaps the screen's operating hours.

export interface CampaignSchedule {
  schedule_days?: string[] | null;
  time_start?: string | null;
  time_end?: string | null;
  duration?: number | null;   // seconds per play
  slots?: number | null;      // percent of airtime, 1-100
  start_date?: string | null;
  end_date?: string | null;
}

export interface ScreenHours {
  operating_hours_start?: string | null;
  operating_hours_end?: string | null;
}

export interface Expectation {
  expectedPlays: number;
  scheduled: boolean;
  overlapSeconds: number;
  reason: string | null;
}

const DEFAULT_DURATION_S = 15;
const DEFAULT_SLOT_PCT = 10;
const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function parseHhMm(value: string | null | undefined): number | null {
  if (typeof value !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  const s = Number(m[3] ?? 0);
  if (h > 23 || min > 59 || s > 59) return null;
  return h * 3600 + min * 60 + s;
}

export function overlapSeconds(
  campaignStart: string | null | undefined,
  campaignEnd: string | null | undefined,
  screenStart: string | null | undefined,
  screenEnd: string | null | undefined,
): number {
  // A missing bound means "no restriction from this side".
  const cs = parseHhMm(campaignStart) ?? 0;
  const ce = parseHhMm(campaignEnd) ?? 86_400;
  const ss = parseHhMm(screenStart) ?? 0;
  const se = parseHhMm(screenEnd) ?? 86_400;

  const start = Math.max(cs, ss);
  const end = Math.min(ce, se);
  return Math.max(0, end - start);
}

function isScheduledDay(scheduleDays: string[] | null | undefined, day: Date): boolean {
  // An empty or absent list means every day.
  if (!Array.isArray(scheduleDays) || scheduleDays.length === 0) return true;
  const abbr = DAY_ABBR[day.getUTCDay()];
  return scheduleDays.some(d => typeof d === 'string' && d.slice(0, 3).toLowerCase() === abbr.toLowerCase());
}

export interface ReconciliationWindow {
  firstDay: string;
  lastDay: string;
  hasWork: boolean;
}

/**
 * Which days to reconcile for a campaign, given today's date in the screen's
 * own timezone.
 *
 * Two invariants:
 *   - Only CLOSED days. `lastDay` is never today or later, so a day still in
 *     progress can never be scored as a shortfall.
 *   - Bounded lookback, so a cron outage is covered without rescanning all of
 *     history. A flight that ended before the lookback window yields
 *     `hasWork: false` rather than an inverted range.
 */
export function reconciliationWindow(
  campaign: Pick<CampaignSchedule, 'start_date' | 'end_date'>,
  todayInScreenTz: string,
  lookbackDays: number,
): ReconciliationWindow {
  const yesterday = addDaysIso(todayInScreenTz, -1);
  const windowStart = addDaysIso(todayInScreenTz, -Math.abs(lookbackDays));

  const firstDay = campaign.start_date && campaign.start_date > windowStart
    ? campaign.start_date
    : windowStart;

  const lastDay = campaign.end_date && campaign.end_date < yesterday
    ? campaign.end_date
    : yesterday;

  return { firstDay, lastDay, hasWork: lastDay >= firstDay };
}

function addDaysIso(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function expectedPlays(
  campaign: CampaignSchedule,
  screen: ScreenHours,
  day: string,
): Expectation {
  const none = (reason: string, overlap = 0): Expectation =>
    ({ expectedPlays: 0, scheduled: false, overlapSeconds: overlap, reason });

  const dayDate = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(dayDate.getTime())) return none('invalid_day');

  if (campaign.start_date && day < campaign.start_date) return none('outside_flight');
  if (campaign.end_date && day > campaign.end_date) return none('outside_flight');
  if (!isScheduledDay(campaign.schedule_days, dayDate)) return none('day_not_scheduled');

  const overlap = overlapSeconds(
    campaign.time_start, campaign.time_end,
    screen.operating_hours_start, screen.operating_hours_end,
  );
  if (overlap <= 0) return none('no_overlap');

  // `Number(null)` is 0, not NaN — so an absent duration must be detected
  // explicitly, otherwise `|| DEFAULT` would also swallow a genuine 0 and
  // divide by zero below.
  const durationS = campaign.duration === null || campaign.duration === undefined
    ? DEFAULT_DURATION_S
    : Number(campaign.duration);
  if (!Number.isFinite(durationS) || durationS <= 0) return none('invalid_duration', overlap);

  const slotsRaw = campaign.slots === null || campaign.slots === undefined
    ? DEFAULT_SLOT_PCT
    : Number(campaign.slots);
  const slotPct = Math.min(Math.max(Number.isFinite(slotsRaw) ? slotsRaw : DEFAULT_SLOT_PCT, 0), 100);
  const airtimeS = overlap * (slotPct / 100);

  return {
    expectedPlays: Math.floor(airtimeS / durationS),
    scheduled: true,
    overlapSeconds: overlap,
    reason: null,
  };
}
