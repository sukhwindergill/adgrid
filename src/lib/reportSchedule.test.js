import { describe, it, expect } from 'vitest';
import * as client from './reportSchedule.js';
import * as server from '../../supabase/functions/_shared/reportSchedule.ts';
import {
  nextRunAt, reportPeriod, parseRecipients, rowsInPeriod, summarizeDelivery,
  buildReportCsv, MAX_RECIPIENTS, SEND_HOUR_UTC,
} from './reportSchedule.js';

describe('nextRunAt', () => {
  it('weekly: next Monday at the send hour', () => {
    // 2026-10-16 is a Friday.
    expect(nextRunAt('weekly', new Date('2026-10-16T10:00:00Z')).toISOString())
      .toBe(`2026-10-19T${SEND_HOUR_UTC}:00:00.000Z`);
  });

  it('weekly: Monday before the send hour runs the same day', () => {
    expect(nextRunAt('weekly', new Date('2026-10-19T08:00:00Z')).toISOString())
      .toBe('2026-10-19T13:00:00.000Z');
  });

  it('weekly: strictly after `from`, so a run at the send hour rolls a week', () => {
    expect(nextRunAt('weekly', new Date('2026-10-19T13:00:00Z')).toISOString())
      .toBe('2026-10-26T13:00:00.000Z');
  });

  it('weekly: Sunday goes to the next day', () => {
    expect(nextRunAt('weekly', new Date('2026-10-18T23:00:00Z')).toISOString())
      .toBe('2026-10-19T13:00:00.000Z');
  });

  it('monthly: 1st of next month', () => {
    expect(nextRunAt('monthly', new Date('2026-10-16T10:00:00Z')).toISOString())
      .toBe('2026-11-01T13:00:00.000Z');
  });

  it('monthly: rolls over the year', () => {
    expect(nextRunAt('monthly', new Date('2026-12-01T13:00:00Z')).toISOString())
      .toBe('2027-01-01T13:00:00.000Z');
  });

  it('monthly: the 1st before the send hour runs the same day', () => {
    expect(nextRunAt('monthly', new Date('2026-11-01T02:00:00Z')).toISOString())
      .toBe('2026-11-01T13:00:00.000Z');
  });

  it('rejects unknown frequencies', () => {
    expect(() => nextRunAt('daily', new Date())).toThrow();
  });
});

describe('reportPeriod', () => {
  it('weekly covers the previous seven days, end exclusive', () => {
    expect(reportPeriod('weekly', '2026-10-19T13:00:00Z')).toEqual({ start: '2026-10-12', end: '2026-10-19' });
  });

  it('monthly covers the previous calendar month', () => {
    expect(reportPeriod('monthly', '2026-11-01T13:00:00Z')).toEqual({ start: '2026-10-01', end: '2026-11-01' });
  });

  it('monthly in January covers December of the prior year', () => {
    expect(reportPeriod('monthly', '2027-01-01T13:00:00Z')).toEqual({ start: '2026-12-01', end: '2027-01-01' });
  });
});

describe('parseRecipients', () => {
  it('splits on commas, semicolons and whitespace, lower-cases and dedupes', () => {
    expect(parseRecipients('A@x.com, b@y.ca;a@x.com\nc@z.org')).toEqual({
      emails: ['a@x.com', 'b@y.ca', 'c@z.org'], error: null,
    });
  });

  it('accepts an array', () => {
    expect(parseRecipients(['a@x.com']).error).toBeNull();
  });

  it('requires at least one', () => {
    expect(parseRecipients('  ').error).toMatch(/at least one/);
  });

  it(`caps at ${MAX_RECIPIENTS}`, () => {
    const many = Array.from({ length: MAX_RECIPIENTS + 1 }, (_, i) => `u${i}@x.com`);
    expect(parseRecipients(many).error).toMatch(/Up to 5/);
    expect(parseRecipients(many.slice(0, MAX_RECIPIENTS)).error).toBeNull();
  });

  it('rejects malformed addresses', () => {
    expect(parseRecipients('a@x.com, nope').error).toMatch(/nope/);
    expect(parseRecipients('a@b').error).toMatch(/a@b/);
  });
});

const ROWS = [
  { day: '2026-10-11', plays: 5, impressions: 50, billable_scans: 1, basis: 'measured' },
  { day: '2026-10-12', plays: 10, impressions: 100, billable_scans: 2, basis: 'measured' },
  { day: '2026-10-18', plays: '3', impressions: null, billable_scans: 0, basis: 'modelled' },
  { day: '2026-10-19', plays: 7, impressions: 70, billable_scans: 4, basis: 'measured' },
];

describe('rowsInPeriod / summarizeDelivery', () => {
  it('keeps [start, end) only', () => {
    const p = { start: '2026-10-12', end: '2026-10-19' };
    expect(rowsInPeriod(ROWS, p).map(r => r.day)).toEqual(['2026-10-12', '2026-10-18']);
  });

  it('sums plays, impressions and scans, tolerating strings and nulls', () => {
    expect(summarizeDelivery(ROWS.slice(1, 3))).toEqual({ plays: 13, impressions: 100, scans: 2 });
    expect(summarizeDelivery(null)).toEqual({ plays: 0, impressions: 0, scans: 0 });
  });
});

describe('buildReportCsv', () => {
  it('writes one line per campaign-day, days ascending', () => {
    const csv = buildReportCsv([
      { name: 'Fall Sale', rows: [ROWS[1], ROWS[0]] },
      { name: 'Launch', rows: [ROWS[3]] },
    ]);
    expect(csv.split('\n')).toEqual([
      'Campaign,Day,Plays,Impressions,Scans,Basis',
      'Fall Sale,2026-10-11,5,50,1,measured',
      'Fall Sale,2026-10-12,10,100,2,measured',
      'Launch,2026-10-19,7,70,4,measured',
    ]);
  });

  it('neutralises formula-looking campaign names', () => {
    const csv = buildReportCsv([{ name: '=HYPERLINK("x")', rows: [ROWS[0]] }]);
    expect(csv.split('\n')[1]).toBe(`"'=HYPERLINK(""x"")",2026-10-11,5,50,1,measured`);
  });

  it('header only when there is nothing to report', () => {
    expect(buildReportCsv([])).toBe('Campaign,Day,Plays,Impressions,Scans,Basis');
  });
});

describe('server mirror stays in sync', () => {
  const instants = [
    '2026-10-16T10:00:00Z', '2026-10-19T08:00:00Z', '2026-10-19T13:00:00Z',
    '2026-10-18T23:59:59Z', '2026-12-01T13:00:00Z', '2026-02-28T20:00:00Z', '2028-02-29T00:00:00Z',
  ];

  it('nextRunAt and reportPeriod agree', () => {
    for (const f of client.FREQUENCIES) {
      for (const t of instants) {
        expect(server.nextRunAt(f, new Date(t)).toISOString()).toBe(client.nextRunAt(f, new Date(t)).toISOString());
        expect(server.reportPeriod(f, t)).toEqual(client.reportPeriod(f, t));
      }
    }
  });

  it('CSV, summaries and constants agree', () => {
    const campaigns = [{ name: 'a,"b"', rows: ROWS }, { name: '+1', rows: ROWS.slice(2) }];
    expect(server.buildReportCsv(campaigns)).toBe(client.buildReportCsv(campaigns));
    expect(server.summarizeDelivery(ROWS)).toEqual(client.summarizeDelivery(ROWS));
    expect(server.rowsInPeriod(ROWS, { start: '2026-10-12', end: '2026-10-19' }))
      .toEqual(client.rowsInPeriod(ROWS, { start: '2026-10-12', end: '2026-10-19' }));
    expect(server.MAX_RECIPIENTS).toBe(client.MAX_RECIPIENTS);
    expect(server.SEND_HOUR_UTC).toBe(client.SEND_HOUR_UTC);
    expect(server.REPORT_CSV_COLUMNS).toEqual(client.REPORT_CSV_COLUMNS);
  });

  it('toBase64Utf8 round-trips non-Latin-1 text', () => {
    const text = 'Café, Montréal — 東京';
    const decoded = new TextDecoder().decode(Uint8Array.from(atob(server.toBase64Utf8(text)), ch => ch.charCodeAt(0)));
    expect(decoded).toBe(text);
  });
});
