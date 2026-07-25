import { describe, it, expect } from 'vitest';
import { toCsv } from './csv.js';

const columns = [
  { key: 'day', label: 'Day' },
  { key: 'plays', label: 'Plays' },
];

describe('toCsv', () => {
  it('writes a header row from the column labels', () => {
    expect(toCsv(columns, []).split('\n')[0]).toBe('Day,Plays');
  });

  it('writes one line per row in column order', () => {
    const csv = toCsv(columns, [{ plays: 12, day: '2026-07-01' }]);
    expect(csv.split('\n')[1]).toBe('2026-07-01,12');
  });

  it('quotes values containing a comma', () => {
    const csv = toCsv([{ key: 'name', label: 'Name' }], [{ name: 'Cafe, Downtown' }]);
    expect(csv.split('\n')[1]).toBe('"Cafe, Downtown"');
  });

  it('escapes embedded double quotes by doubling them', () => {
    const csv = toCsv([{ key: 'name', label: 'Name' }], [{ name: 'The "Best" Cafe' }]);
    expect(csv.split('\n')[1]).toBe('"The ""Best"" Cafe"');
  });

  it('quotes values containing a newline', () => {
    const csv = toCsv([{ key: 'note', label: 'Note' }], [{ note: 'line1\nline2' }]);
    expect(csv).toContain('"line1\nline2"');
  });

  it('renders null and undefined as empty, not as the strings "null"/"undefined"', () => {
    const csv = toCsv(columns, [{ day: null, plays: undefined }]);
    expect(csv.split('\n')[1]).toBe(',');
  });

  it('renders zero as 0 rather than empty', () => {
    const csv = toCsv(columns, [{ day: '2026-07-01', plays: 0 }]);
    expect(csv.split('\n')[1]).toBe('2026-07-01,0');
  });

  it('neutralises a leading = + - or @ so spreadsheets do not execute it', () => {
    // CSV injection: a cell starting with = is run as a formula by Excel and
    // Sheets. Exported scan data contains user-controlled text.
    // Neutralised cells are always quoted so the apostrophe survives parsing.
    expect(toCsv([{ key: 'x', label: 'X' }], [{ x: '=cmd|calc' }]).split('\n')[1]).toBe(`"'=cmd|calc"`);
    expect(toCsv([{ key: 'x', label: 'X' }], [{ x: '+1' }]).split('\n')[1]).toBe(`"'+1"`);
    expect(toCsv([{ key: 'x', label: 'X' }], [{ x: '@SUM' }]).split('\n')[1]).toBe(`"'@SUM"`);
    expect(toCsv([{ key: 'x', label: 'X' }], [{ x: '-2' }]).split('\n')[1]).toBe(`"'-2"`);
  });

  it('returns just the header for no rows', () => {
    expect(toCsv(columns, [])).toBe('Day,Plays');
  });

  it('tolerates a null row list', () => {
    expect(toCsv(columns, null)).toBe('Day,Plays');
  });

  it('tolerates a missing key on a row', () => {
    expect(toCsv(columns, [{}]).split('\n')[1]).toBe(',');
  });
});
