import { describe, it, expect } from 'vitest';
import { syncDaypartingDays } from './dayparting.js';

describe('syncDaypartingDays', () => {
  it('seeds every day from the flat fallback when starting from nothing', () => {
    expect(syncDaypartingDays(null, ['Mon', 'Sat'], '07:00', '22:00')).toEqual({
      Mon: { time_start: '07:00', time_end: '22:00' },
      Sat: { time_start: '07:00', time_end: '22:00' },
    });
  });

  it('preserves an already-customized day', () => {
    const existing = { Mon: { time_start: '08:00', time_end: '11:00' } };
    expect(syncDaypartingDays(existing, ['Mon', 'Sat'], '07:00', '22:00')).toEqual({
      Mon: { time_start: '08:00', time_end: '11:00' },
      Sat: { time_start: '07:00', time_end: '22:00' },
    });
  });

  it('drops a day no longer in the selection', () => {
    const existing = { Mon: { time_start: '08:00', time_end: '11:00' }, Sat: { time_start: '10:00', time_end: '14:00' } };
    expect(syncDaypartingDays(existing, ['Mon'], '07:00', '22:00')).toEqual({
      Mon: { time_start: '08:00', time_end: '11:00' },
    });
  });

  it('falls back to an all-day default when the flat window is blank', () => {
    expect(syncDaypartingDays(null, ['Mon'], '', '')).toEqual({
      Mon: { time_start: '00:00', time_end: '23:59' },
    });
  });
});
