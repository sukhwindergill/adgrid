import { describe, it, expect } from 'vitest';
import { parseHhMm, overlapSeconds, expectedPlays } from './deliveryExpectation.ts';

describe('parseHhMm', () => {
  it('parses HH:MM to seconds from midnight', () => {
    expect(parseHhMm('00:00')).toBe(0);
    expect(parseHhMm('07:30')).toBe(27_000);
    expect(parseHhMm('22:00')).toBe(79_200);
  });

  it('parses a postgres time with seconds', () => {
    expect(parseHhMm('07:30:00')).toBe(27_000);
  });

  it('returns null for junk', () => {
    expect(parseHhMm('')).toBeNull();
    expect(parseHhMm(null)).toBeNull();
    expect(parseHhMm('25:00')).toBeNull();
    expect(parseHhMm('nonsense')).toBeNull();
  });
});

describe('overlapSeconds', () => {
  it('returns the intersection of two windows', () => {
    expect(overlapSeconds('09:00', '17:00', '07:00', '22:00')).toBe(8 * 3600);
  });

  it('clamps to the narrower screen window', () => {
    expect(overlapSeconds('06:00', '23:00', '09:00', '17:00')).toBe(8 * 3600);
  });

  it('returns 0 when the windows do not overlap', () => {
    expect(overlapSeconds('06:00', '08:00', '09:00', '17:00')).toBe(0);
  });

  it('falls back to the full day when a bound is missing', () => {
    expect(overlapSeconds(null, null, '09:00', '17:00')).toBe(8 * 3600);
    expect(overlapSeconds('09:00', '17:00', null, null)).toBe(8 * 3600);
  });

  it('treats an inverted window as zero rather than negative', () => {
    expect(overlapSeconds('17:00', '09:00', '07:00', '22:00')).toBe(0);
  });
});

describe('expectedPlays', () => {
  const campaign = {
    schedule_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    time_start: '09:00',
    time_end: '17:00',
    duration: 15,
    slots: 10,
    start_date: '2026-07-01',
    end_date: '2026-07-31',
  };
  const screen = { operating_hours_start: '07:00', operating_hours_end: '22:00' };

  it('computes plays from the overlap, slot share and play duration', () => {
    // 8h overlap = 28800s; 10% = 2880s; / 15s = 192 plays
    const r = expectedPlays(campaign, screen, '2026-07-08'); // a Wednesday
    expect(r.expectedPlays).toBe(192);
    expect(r.scheduled).toBe(true);
  });

  it('returns 0 on a day not in schedule_days', () => {
    const r = expectedPlays(campaign, screen, '2026-07-11'); // a Saturday
    expect(r.expectedPlays).toBe(0);
    expect(r.scheduled).toBe(false);
    expect(r.reason).toBe('day_not_scheduled');
  });

  it('returns 0 before the campaign start date', () => {
    const r = expectedPlays(campaign, screen, '2026-06-30');
    expect(r.expectedPlays).toBe(0);
    expect(r.reason).toBe('outside_flight');
  });

  it('returns 0 after the campaign end date', () => {
    const r = expectedPlays(campaign, screen, '2026-08-03');
    expect(r.expectedPlays).toBe(0);
    expect(r.reason).toBe('outside_flight');
  });

  it('includes the first and last day of the flight', () => {
    expect(expectedPlays(campaign, screen, '2026-07-01').scheduled).toBe(true);  // Wednesday
    expect(expectedPlays(campaign, screen, '2026-07-31').scheduled).toBe(true);  // Friday
  });

  it('returns 0 when the daypart does not overlap operating hours', () => {
    const night = { ...campaign, time_start: '02:00', time_end: '05:00' };
    const r = expectedPlays(night, screen, '2026-07-08');
    expect(r.expectedPlays).toBe(0);
    expect(r.reason).toBe('no_overlap');
  });

  it('treats an empty schedule_days as every day', () => {
    const always = { ...campaign, schedule_days: [] };
    expect(expectedPlays(always, screen, '2026-07-11').scheduled).toBe(true);
  });

  it('defaults duration to 15s and slots to 10% when absent', () => {
    const bare = { ...campaign, duration: null, slots: null };
    expect(expectedPlays(bare, screen, '2026-07-08').expectedPlays).toBe(192);
  });

  it('clamps a slot share above 100 percent', () => {
    const greedy = { ...campaign, slots: 400 };
    // capped at 100% of the 8h overlap: 28800 / 15 = 1920
    expect(expectedPlays(greedy, screen, '2026-07-08').expectedPlays).toBe(1920);
  });

  it('returns 0 for a non-positive duration instead of dividing by zero', () => {
    const broken = { ...campaign, duration: 0 };
    const r = expectedPlays(broken, screen, '2026-07-08');
    expect(r.expectedPlays).toBe(0);
    expect(r.reason).toBe('invalid_duration');
  });

  it('accepts full day names as well as abbreviations', () => {
    const long = { ...campaign, schedule_days: ['Wednesday'] };
    expect(expectedPlays(long, screen, '2026-07-08').scheduled).toBe(true);
  });
});
