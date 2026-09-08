import { describe, it, expect } from 'vitest';
import { computeFillRateTrend, FILL_RATE_DROP_THRESHOLD_PTS } from './fillRateTrend.js';

describe('computeFillRateTrend', () => {
  it('returns null rates and no flag when there is no delivery data at all', () => {
    const result = computeFillRateTrend({ paidCurrent: 0, houseCurrent: 0, paidPrior: 0, housePrior: 0 });
    expect(result.currentRate).toBeNull();
    expect(result.priorRate).toBeNull();
    expect(result.flagged).toBe(false);
  });

  it('computes the paid share of total impressions for each period', () => {
    const result = computeFillRateTrend({ paidCurrent: 90, houseCurrent: 10, paidPrior: 90, housePrior: 10 });
    expect(result.currentRate).toBe(90);
    expect(result.priorRate).toBe(90);
    expect(result.deltaPts).toBe(0);
    expect(result.flagged).toBe(false);
  });

  it('flags a fill-rate drop at or beyond the threshold', () => {
    const result = computeFillRateTrend({ paidCurrent: 60, houseCurrent: 40, paidPrior: 90, housePrior: 10 });
    // current 60%, prior 90% -- a 30pt drop
    expect(result.deltaPts).toBe(-30);
    expect(result.flagged).toBe(true);
  });

  it('does not flag a drop smaller than the threshold', () => {
    const result = computeFillRateTrend({ paidCurrent: 85, houseCurrent: 15, paidPrior: 90, housePrior: 10 });
    expect(result.deltaPts).toBe(-5);
    expect(result.flagged).toBe(false);
  });

  it('does not flag a rising fill rate', () => {
    const result = computeFillRateTrend({ paidCurrent: 95, houseCurrent: 5, paidPrior: 70, housePrior: 30 });
    expect(result.deltaPts).toBeGreaterThan(0);
    expect(result.flagged).toBe(false);
  });

  it('treats no prior-period delivery as no baseline, not a 100% drop', () => {
    const result = computeFillRateTrend({ paidCurrent: 50, houseCurrent: 50, paidPrior: 0, housePrior: 0 });
    expect(result.priorRate).toBeNull();
    expect(result.flagged).toBe(false);
  });

  it('exposes the threshold used', () => {
    expect(FILL_RATE_DROP_THRESHOLD_PTS).toBe(10);
  });
});
