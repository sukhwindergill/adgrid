// Scheduled report emails — server copy of src/lib/reportSchedule.js (and the
// cell serialiser from src/lib/csv.js). supabase/functions/ isn't part of the
// frontend build and vice versa, so the logic is duplicated;
// src/lib/reportSchedule.test.js runs both copies against the same inputs.
// Change one, change the other.

export const FREQUENCIES = ["weekly", "monthly"];
export const MAX_RECIPIENTS = 5;
export const SEND_HOUR_UTC = 13;

const DAY_MS = 86_400_000;

type Period = { start: string; end: string };
type DailyRow = { day: string; plays?: unknown; impressions?: unknown; billable_scans?: unknown; basis?: unknown };

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function nextRunAt(frequency: string, from: Date | string = new Date()): Date {
  const base = new Date(from);
  if (frequency === "weekly") {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), SEND_HOUR_UTC));
    const daysToMonday = (8 - d.getUTCDay()) % 7;
    d.setUTCDate(d.getUTCDate() + daysToMonday);
    if (d <= base) d.setUTCDate(d.getUTCDate() + 7);
    return d;
  }
  if (frequency === "monthly") {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1, SEND_HOUR_UTC));
    if (d <= base) d.setUTCMonth(d.getUTCMonth() + 1);
    return d;
  }
  throw new Error(`Unknown report frequency: ${frequency}`);
}

export function reportPeriod(frequency: string, runAt: Date | string): Period {
  const run = new Date(runAt);
  const endDate = new Date(Date.UTC(run.getUTCFullYear(), run.getUTCMonth(), run.getUTCDate()));
  if (frequency === "weekly") {
    const start = new Date(endDate.getTime() - 7 * DAY_MS);
    return { start: isoDay(start), end: isoDay(endDate) };
  }
  if (frequency === "monthly") {
    const end = new Date(Date.UTC(run.getUTCFullYear(), run.getUTCMonth(), 1));
    const start = new Date(Date.UTC(run.getUTCFullYear(), run.getUTCMonth() - 1, 1));
    return { start: isoDay(start), end: isoDay(end) };
  }
  throw new Error(`Unknown report frequency: ${frequency}`);
}

export function rowsInPeriod<T extends DailyRow>(rows: T[] | null | undefined, period: Period): T[] {
  return (rows ?? []).filter((r) => r?.day >= period.start && r?.day < period.end);
}

export function summarizeDelivery(rows: DailyRow[] | null | undefined) {
  return (rows ?? []).reduce((t, r) => ({
    plays: t.plays + (Number(r?.plays) || 0),
    impressions: t.impressions + (Number(r?.impressions) || 0),
    scans: t.scans + (Number(r?.billable_scans) || 0),
  }), { plays: 0, impressions: 0, scans: 0 });
}

const NEEDS_QUOTING = /[",\n\r]/;
const FORMULA_START = /^[=+\-@]/;

function serialiseCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (FORMULA_START.test(s)) return `"'${s.replace(/"/g, '""')}"`;
  if (NEEDS_QUOTING.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export const REPORT_CSV_COLUMNS = [
  { key: "campaign", label: "Campaign" },
  { key: "day", label: "Day" },
  { key: "plays", label: "Plays" },
  { key: "impressions", label: "Impressions" },
  { key: "billable_scans", label: "Scans" },
  { key: "basis", label: "Basis" },
];

export function buildReportCsv(campaigns: { name: string; rows: DailyRow[] }[] | null | undefined): string {
  const lines: Record<string, unknown>[] = [];
  for (const c of campaigns ?? []) {
    const sorted = [...(c.rows ?? [])].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
    for (const r of sorted) lines.push({ ...r, campaign: c.name });
  }
  const header = REPORT_CSV_COLUMNS.map((c) => serialiseCell(c.label)).join(",");
  const body = lines.map((row) => REPORT_CSV_COLUMNS.map((c) => serialiseCell(row[c.key])).join(","));
  return [header, ...body].join("\n");
}

// Resend wants attachment content base64-encoded; btoa alone only takes
// Latin-1, and campaign names can be anything.
export function toBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}
