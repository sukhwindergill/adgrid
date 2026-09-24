import { describe, it, expect } from 'vitest';
import { estimateMonthlyEarnings, ESTIMATE_ASSUMPTIONS } from './earningsEstimate.js';
import { DEFAULT_OWNER_REVENUE_SHARE } from './revenueSplit.js';

describe('estimateMonthlyEarnings', () => {
  it('computes sold impressions x CPM x operator share', () => {
    // 500/day x 30 days x 4 ad spots x 50% sold = 30,000 impressions
    // 30,000 / 1000 x $5 = $150 gross, operator keeps 70% = $105
    const r = estimateMonthlyEarnings({ screens: 1, dailyVisitors: 500, fillRate: 0.5 });
    expect(r.soldImpressions).toBe(30000);
    expect(r.gross).toBe(150);
    expect(r.operator).toBe(105);
  });

  it('scales linearly with screen count', () => {
    const one = estimateMonthlyEarnings({ screens: 1, dailyVisitors: 300, fillRate: 0.25 });
    const three = estimateMonthlyEarnings({ screens: 3, dailyVisitors: 300, fillRate: 0.25 });
    expect(three.soldImpressions).toBe(one.soldImpressions * 3);
    expect(three.gross).toBe(one.gross * 3);
  });

  it('uses the platform revenue share, not a hard-coded one', () => {
    const r = estimateMonthlyEarnings({ screens: 1, dailyVisitors: 1000, fillRate: 1 });
    expect(r.operator).toBe(Math.round(r.gross * DEFAULT_OWNER_REVENUE_SHARE));
    expect(ESTIMATE_ASSUMPTIONS.ownerShare).toBe(DEFAULT_OWNER_REVENUE_SHARE);
  });

  it('returns zeros for missing or invalid input instead of NaN', () => {
    const r = estimateMonthlyEarnings({ screens: -2, dailyVisitors: 'abc', fillRate: undefined });
    expect(r).toEqual({ soldImpressions: 0, gross: 0, operator: 0 });
  });

  it('clamps fill rate to 0..1', () => {
    const over = estimateMonthlyEarnings({ screens: 1, dailyVisitors: 100, fillRate: 5 });
    const full = estimateMonthlyEarnings({ screens: 1, dailyVisitors: 100, fillRate: 1 });
    expect(over).toEqual(full);
  });
});
