import { describe, it, expect } from 'vitest';
import { compareLift, MIN_IMPRESSIONS_PER_GROUP } from './liftTest.js';

describe('compareLift', () => {
  it('reports a significant lift when exposed clearly outperforms control', () => {
    // Exposed: 200/10000 = 2.0% scan rate. Control: 100/10000 = 1.0%.
    const r = compareLift(
      { impressions: 10000, billable_scans: 200 },
      { impressions: 10000, billable_scans: 100 },
    );
    expect(r.available).toBe(true);
    expect(r.significant).toBe(true);
    expect(r.exposedRate).toBeCloseTo(2.0, 5);
    expect(r.controlRate).toBeCloseTo(1.0, 5);
    expect(r.liftPct).toBeCloseTo(100, 1); // 2.0 vs 1.0 = +100%
    expect(r.ci95.low).toBeGreaterThan(0);
  });

  it('reports not significant when rates are close', () => {
    const r = compareLift(
      { impressions: 1000, billable_scans: 20 },
      { impressions: 1000, billable_scans: 19 },
    );
    expect(r.available).toBe(true);
    expect(r.significant).toBe(false);
  });

  it('reports unavailable when exposed has too few impressions', () => {
    const r = compareLift(
      { impressions: MIN_IMPRESSIONS_PER_GROUP - 1, billable_scans: 5 },
      { impressions: 10000, billable_scans: 100 },
    );
    expect(r.available).toBe(false);
    expect(r.reason).toBe('insufficient_sample');
  });

  it('reports unavailable when control has too few impressions', () => {
    const r = compareLift(
      { impressions: 10000, billable_scans: 100 },
      { impressions: MIN_IMPRESSIONS_PER_GROUP - 1, billable_scans: 5 },
    );
    expect(r.available).toBe(false);
    expect(r.reason).toBe('insufficient_sample');
  });

  it('reports unavailable when either group is missing entirely', () => {
    expect(compareLift(null, { impressions: 10000, billable_scans: 100 }).reason).toBe('no_data');
    expect(compareLift({ impressions: 10000, billable_scans: 100 }, null).reason).toBe('no_data');
    expect(compareLift(null, null).reason).toBe('no_data');
  });

  it('does not divide by zero when control rate is zero', () => {
    const r = compareLift(
      { impressions: 10000, billable_scans: 50 },
      { impressions: 10000, billable_scans: 0 },
    );
    expect(r.available).toBe(true);
    expect(r.liftPct).toBeNull();
  });

  it('enforces a minimum of at least 500 impressions per group', () => {
    expect(MIN_IMPRESSIONS_PER_GROUP).toBeGreaterThanOrEqual(500);
  });

  it('never claims significance from a tiny absolute scan count even with high rate', () => {
    // 3/500 = 0.6% vs 1/500 = 0.2% "looks" like 3x lift, but n is too small
    // to be significant at 95% -- the z-test itself must catch this, not
    // just the impressions floor.
    const r = compareLift(
      { impressions: 500, billable_scans: 3 },
      { impressions: 500, billable_scans: 1 },
    );
    expect(r.available).toBe(true);
    expect(r.significant).toBe(false);
  });
});
