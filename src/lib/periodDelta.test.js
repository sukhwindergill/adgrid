import { describe, it, expect } from 'vitest';
import { periodDelta, splitByPeriod } from './periodDelta.js';

describe('periodDelta', () => {
  it('returns positive percent growth', () => {
    expect(periodDelta(120, 100)).toBe(20);
  });

  it('returns negative percent decline', () => {
    expect(periodDelta(75, 100)).toBe(-25);
  });

  it('rounds to a whole percent', () => {
    expect(periodDelta(103.7, 100)).toBe(4);
  });

  it('returns null when there is no prior baseline', () => {
    expect(periodDelta(120, 0)).toBeNull();
  });

  it('returns null when either value is not a finite number', () => {
    expect(periodDelta(120, null)).toBeNull();
    expect(periodDelta(undefined, 100)).toBeNull();
    expect(periodDelta(NaN, 100)).toBeNull();
  });
});

describe('splitByPeriod', () => {
  const now = new Date('2026-07-24T12:00:00Z');
  const rows = [
    { at: '2026-07-23T10:00:00Z', amount: 10 }, // current 7d
    { at: '2026-07-19T10:00:00Z', amount: 5 },  // current 7d
    { at: '2026-07-14T10:00:00Z', amount: 40 }, // prior 7d
    { at: '2026-06-01T10:00:00Z', amount: 99 }, // older than both
  ];

  it('sums the current and prior windows', () => {
    const { current, prior } = splitByPeriod(rows, 'at', 'amount', 7, now);
    expect(current).toBe(15);
    expect(prior).toBe(40);
  });

  it('ignores rows with an unparseable date', () => {
    const { current } = splitByPeriod([{ at: 'not-a-date', amount: 7 }], 'at', 'amount', 7, now);
    expect(current).toBe(0);
  });

  it('counts rows when no value key is given', () => {
    const { current, prior } = splitByPeriod(rows, 'at', null, 7, now);
    expect(current).toBe(2);
    expect(prior).toBe(1);
  });
});
