import { describe, it, expect } from 'vitest';
import { resolveDayWindow, isTimeInWindow } from './dayparting.ts';

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

describe('isTimeInWindow', () => {
  it('handles a same-day window normally', () => {
    expect(isTimeInWindow('12:00', '07:00', '22:00')).toBe(true);
    expect(isTimeInWindow('06:00', '07:00', '22:00')).toBe(false);
    expect(isTimeInWindow('23:00', '07:00', '22:00')).toBe(false);
  });

  it('includes both endpoints of a same-day window', () => {
    expect(isTimeInWindow('07:00', '07:00', '22:00')).toBe(true);
    expect(isTimeInWindow('22:00', '07:00', '22:00')).toBe(true);
  });

  it('wraps past midnight for an overnight window instead of matching nothing', () => {
    expect(isTimeInWindow('23:30', '22:00', '02:00')).toBe(true);
    expect(isTimeInWindow('01:00', '22:00', '02:00')).toBe(true);
    expect(isTimeInWindow('12:00', '22:00', '02:00')).toBe(false);
  });

  it('includes both endpoints of an overnight window', () => {
    expect(isTimeInWindow('22:00', '22:00', '02:00')).toBe(true);
    expect(isTimeInWindow('02:00', '22:00', '02:00')).toBe(true);
  });
});
