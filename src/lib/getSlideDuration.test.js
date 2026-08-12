import { describe, it, expect } from 'vitest';
import { getSlideDurationMs } from './getSlideDuration.js';

describe('getSlideDurationMs', () => {
  it('converts a valid duration in seconds to milliseconds', () => {
    expect(getSlideDurationMs({ duration: 5 })).toBe(5000);
    expect(getSlideDurationMs({ duration: 20 })).toBe(20000);
    expect(getSlideDurationMs({ duration: 60 })).toBe(60000);
  });

  it('clamps a duration above 60s down to 60s', () => {
    expect(getSlideDurationMs({ duration: 999 })).toBe(60000);
  });

  it('clamps a duration below 5s up to 5s', () => {
    expect(getSlideDurationMs({ duration: 3 })).toBe(5000);
  });

  it('falls back to 10s when duration is missing', () => {
    expect(getSlideDurationMs({})).toBe(10000);
    expect(getSlideDurationMs(undefined)).toBe(10000);
  });

  it('falls back to 10s when duration is null, zero, negative, or non-numeric', () => {
    expect(getSlideDurationMs({ duration: null })).toBe(10000);
    expect(getSlideDurationMs({ duration: 0 })).toBe(10000);
    expect(getSlideDurationMs({ duration: -5 })).toBe(10000);
    expect(getSlideDurationMs({ duration: 'abc' })).toBe(10000);
  });
});
