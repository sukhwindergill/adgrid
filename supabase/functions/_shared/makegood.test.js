import { describe, it, expect } from 'vitest';
import { shortfallPct, dailyBudgetShare, creditAmount, SHORTFALL_THRESHOLD } from './makegood.ts';

describe('shortfallPct', () => {
  it('is 0 when delivery meets expectation', () => {
    expect(shortfallPct(100, 100)).toBe(0);
  });

  it('is 0 when delivery exceeds expectation', () => {
    expect(shortfallPct(120, 100)).toBe(0);
  });

  it('is the missing fraction when delivery falls short', () => {
    expect(shortfallPct(75, 100)).toBeCloseTo(0.25, 6);
  });

  it('is 1 when nothing was delivered', () => {
    expect(shortfallPct(0, 100)).toBe(1);
  });

  it('is 0 when nothing was expected, so an idle day is never a credit', () => {
    expect(shortfallPct(0, 0)).toBe(0);
    expect(shortfallPct(5, 0)).toBe(0);
  });
});

describe('dailyBudgetShare', () => {
  it('splits the budget evenly across flight days and screens', () => {
    // $300 over 10 days across 3 screens = $10 per screen-day
    expect(dailyBudgetShare(300, 10, 3)).toBeCloseTo(10, 6);
  });

  it('returns 0 when any divisor is missing', () => {
    expect(dailyBudgetShare(300, 0, 3)).toBe(0);
    expect(dailyBudgetShare(300, 10, 0)).toBe(0);
    expect(dailyBudgetShare(0, 10, 3)).toBe(0);
  });
});

describe('creditAmount', () => {
  it('credits the shortfall fraction of the screen-day budget', () => {
    // 25% short of a $10 screen-day = $2.50
    expect(creditAmount(0.25, 10)).toBeCloseTo(2.5, 6);
  });

  it('rounds to cents', () => {
    expect(creditAmount(1 / 3, 10)).toBe(3.33);
  });

  it('is 0 below the threshold, so rounding noise is not a payout', () => {
    expect(SHORTFALL_THRESHOLD).toBe(0.05);
    expect(creditAmount(0.04, 10)).toBe(0);
    expect(creditAmount(0.05, 10)).toBeCloseTo(0.5, 6);
  });

  it('never exceeds the screen-day budget', () => {
    expect(creditAmount(1, 10)).toBe(10);
  });

  it('is 0 for nonsense input', () => {
    expect(creditAmount(NaN, 10)).toBe(0);
    expect(creditAmount(0.5, NaN)).toBe(0);
    expect(creditAmount(-1, 10)).toBe(0);
  });
});
