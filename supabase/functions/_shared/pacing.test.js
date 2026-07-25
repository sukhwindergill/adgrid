import { describe, it, expect } from 'vitest';
import { flightProgress, pacingRatio, projectedFinalSpend } from './pacing.ts';

const on = (d) => new Date(`${d}T12:00:00Z`);

describe('flightProgress', () => {
  it('is 0 before the flight starts', () => {
    expect(flightProgress('2026-07-10', '2026-07-20', on('2026-07-01'))).toBe(0);
  });

  it('is 1 after the flight ends', () => {
    expect(flightProgress('2026-07-10', '2026-07-20', on('2026-07-25'))).toBe(1);
  });

  it('is the elapsed fraction mid-flight', () => {
    // Continuous time, not whole days: an 11-day flight at noon on day 6 is
    // 5.5 of 11 days elapsed.
    expect(flightProgress('2026-07-10', '2026-07-20', on('2026-07-15'))).toBeCloseTo(0.5, 2);
  });

  it('progresses through a single-day flight rather than jumping to 1', () => {
    expect(flightProgress('2026-07-15', '2026-07-15', on('2026-07-15'))).toBeCloseTo(0.5, 1);
  });

  it('returns 0 for unparseable dates', () => {
    expect(flightProgress(null, '2026-07-20', on('2026-07-15'))).toBe(0);
    expect(flightProgress('2026-07-10', 'nonsense', on('2026-07-15'))).toBe(0);
  });
});

describe('pacingRatio', () => {
  it('is 1 when spend tracks the flight exactly', () => {
    expect(pacingRatio(50, 100, 0.5)).toBeCloseTo(1, 6);
  });

  it('is below 1 when underspending', () => {
    expect(pacingRatio(25, 100, 0.5)).toBeCloseTo(0.5, 6);
  });

  it('is above 1 when overspending', () => {
    expect(pacingRatio(75, 100, 0.5)).toBeCloseTo(1.5, 6);
  });

  it('is null when the flight has not started, so nothing is "behind" yet', () => {
    expect(pacingRatio(0, 100, 0)).toBeNull();
  });

  it('is null when there is no budget to pace against', () => {
    expect(pacingRatio(0, 0, 0.5)).toBeNull();
  });

  it('is null for non-numeric input rather than NaN', () => {
    expect(pacingRatio(null, 100, 0.5)).toBeNull();
    expect(pacingRatio(50, null, 0.5)).toBeNull();
  });
});

describe('projectedFinalSpend', () => {
  it('extrapolates current spend across the full flight', () => {
    expect(projectedFinalSpend(25, 0.5)).toBeCloseTo(50, 6);
  });

  it('returns null before the flight starts', () => {
    expect(projectedFinalSpend(0, 0)).toBeNull();
  });
});
