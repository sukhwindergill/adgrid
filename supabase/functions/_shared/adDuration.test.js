import { describe, it, expect } from 'vitest';
import { clampDurationToScreen } from './adDuration.ts';

describe('clampDurationToScreen', () => {
  it('passes the booking duration through unchanged when it is below the screen max', () => {
    expect(clampDurationToScreen(15, 30)).toBe(15);
  });

  it('clamps the booking duration down to the screen max when it exceeds it', () => {
    expect(clampDurationToScreen(60, 30)).toBe(30);
  });

  it('passes the booking duration through unchanged when it exactly equals the screen max', () => {
    expect(clampDurationToScreen(30, 30)).toBe(30);
  });

  it('passes the booking duration through unchanged when the screen has no configured max', () => {
    expect(clampDurationToScreen(60, null)).toBe(60);
    expect(clampDurationToScreen(60, undefined)).toBe(60);
  });
});
