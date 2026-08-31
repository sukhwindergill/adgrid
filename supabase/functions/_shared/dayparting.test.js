import { describe, it, expect } from 'vitest';
import { resolveDayWindow } from './dayparting.ts';

describe('resolveDayWindow', () => {
  it('falls back to the flat window when dayparting is null', () => {
    expect(resolveDayWindow(null, 'Mon', '07:00', '22:00')).toEqual({ time_start: '07:00', time_end: '22:00' });
  });

  it('falls back to the flat window when dayparting has no entry for the current day', () => {
    const dp = { Sat: { time_start: '10:00', time_end: '14:00' } };
    expect(resolveDayWindow(dp, 'Mon', '07:00', '22:00')).toEqual({ time_start: '07:00', time_end: '22:00' });
  });

  it('uses the per-day override when present', () => {
    const dp = { Mon: { time_start: '08:00', time_end: '11:00' }, Sat: { time_start: '10:00', time_end: '14:00' } };
    expect(resolveDayWindow(dp, 'Mon', '07:00', '22:00')).toEqual({ time_start: '08:00', time_end: '11:00' });
    expect(resolveDayWindow(dp, 'Sat', '07:00', '22:00')).toEqual({ time_start: '10:00', time_end: '14:00' });
  });

  it('falls back to all-day when both dayparting and the flat window are missing', () => {
    expect(resolveDayWindow(null, 'Mon', null, null)).toEqual({ time_start: '00:00', time_end: '23:59' });
  });

  it('ignores a malformed override missing a field', () => {
    const dp = { Mon: { time_start: '08:00' } };
    expect(resolveDayWindow(dp, 'Mon', '07:00', '22:00')).toEqual({ time_start: '07:00', time_end: '22:00' });
  });
});
