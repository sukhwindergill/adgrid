// Scheduled report emails — pure helpers shared by the schedule UI
// (ShareReportModal) and, via the mirror in
// supabase/functions/_shared/reportSchedule.ts, the report-schedule-cron
// function that actually sends them. supabase/functions/ isn't part of the
// frontend build, so the logic lives twice; reportSchedule.test.js runs both
// copies against the same inputs to keep them from drifting.

import { toCsv } from './csv.js';

export const FREQUENCIES = ['weekly', 'monthly'];
export const MAX_RECIPIENTS = 5;

// 13:00 UTC is 09:00 Eastern / 06:00 Pacific — lands before the working day
// starts across Canada.
export const SEND_HOUR_UTC = 13;

const DAY_MS = 86_400_000;

function isoDay(d) {
  return d.toISOString().slice(0, 10);
}

// Weekly reports go out Monday morning; monthly ones on the 1st. Always
// strictly after `from`, so calling this with the run that just happened
// yields the following one rather than the same instant again.
export function nextRunAt(frequency, from = new Date()) {
  const base = new Date(from);
  if (frequency === 'weekly') {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), SEND_HOUR_UTC));
    const daysToMonday = (8 - d.getUTCDay()) % 7; // Sunday=0 … Monday=1
    d.setUTCDate(d.getUTCDate() + daysToMonday);
    if (d <= base) d.setUTCDate(d.getUTCDate() + 7);
    return d;
  }
  if (frequency === 'monthly') {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1, SEND_HOUR_UTC));
    if (d <= base) d.setUTCMonth(d.getUTCMonth() + 1);
    return d;
  }
  throw new Error(`Unknown report frequency: ${frequency}`);
}

// The window a report sent at `runAt` covers: the seven days before it for
// weekly, the previous calendar month for monthly. `end` is exclusive, both
// are YYYY-MM-DD so they compare directly against campaign_delivery_daily.day.
export function reportPeriod(frequency, runAt) {
  const run = new Date(runAt);
  const endDate = new Date(Date.UTC(run.getUTCFullYear(), run.getUTCMonth(), run.getUTCDate()));
  if (frequency === 'weekly') {
    const start = new Date(endDate.getTime() - 7 * DAY_MS);
    return { start: isoDay(start), end: isoDay(endDate) };
  }
  if (frequency === 'monthly') {
    const end = new Date(Date.UTC(run.getUTCFullYear(), run.getUTCMonth(), 1));
    const start = new Date(Date.UTC(run.getUTCFullYear(), run.getUTCMonth() - 1, 1));
    return { start: isoDay(start), end: isoDay(end) };
  }
  throw new Error(`Unknown report frequency: ${frequency}`);
}

const EMAIL = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

// Accepts a comma/semicolon/whitespace separated string or an array.
// Lower-cases and de-duplicates; returns the first problem as `error`.
export function parseRecipients(input) {
  const parts = Array.isArray(input) ? input : String(input ?? '').split(/[\s,;]+/);
  const emails = [];
  for (const raw of parts) {
    const e = String(raw ?? '').trim().toLowerCase();
    if (!e) continue;
    if (!EMAIL.test(e)) return { emails, error: `"${e}" isn't a valid email address` };
    if (!emails.includes(e)) emails.push(e);
  }
  if (emails.length === 0) return { emails, error: 'Add at least one recipient' };
  if (emails.length > MAX_RECIPIENTS) return { emails, error: `Up to ${MAX_RECIPIENTS} recipients per schedule` };
  return { emails, error: null };
}

// Daily rows (campaign_delivery_daily shape) restricted to [start, end).
export function rowsInPeriod(rows, period) {
  return (rows ?? []).filter(r => r?.day >= period.start && r?.day < period.end);
}

export function summarizeDelivery(rows) {
  return (rows ?? []).reduce((t, r) => ({
    plays: t.plays + (Number(r?.plays) || 0),
    impressions: t.impressions + (Number(r?.impressions) || 0),
    scans: t.scans + (Number(r?.billable_scans) || 0),
  }), { plays: 0, impressions: 0, scans: 0 });
}

export const REPORT_CSV_COLUMNS = [
  { key: 'campaign', label: 'Campaign' },
  { key: 'day', label: 'Day' },
  { key: 'plays', label: 'Plays' },
  { key: 'impressions', label: 'Impressions' },
  { key: 'billable_scans', label: 'Scans' },
  { key: 'basis', label: 'Basis' },
];

// One line per campaign per day, campaigns in the order given, days ascending.
// `campaigns` is [{ name, rows }].
export function buildReportCsv(campaigns) {
  const lines = [];
  for (const c of campaigns ?? []) {
    const sorted = [...(c.rows ?? [])].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
    for (const r of sorted) lines.push({ ...r, campaign: c.name });
  }
  return toCsv(REPORT_CSV_COLUMNS, lines);
}

export function describeSchedule(frequency) {
  return frequency === 'weekly' ? 'Every Monday' : 'On the 1st of each month';
}
