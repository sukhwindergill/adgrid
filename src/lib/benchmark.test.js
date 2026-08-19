import { describe, it, expect } from 'vitest';
import { compareToBenchmark, MIN_CAMPAIGNS, MIN_ADVERTISERS } from './benchmark.js';

const stats = { p25: 0.2, p50: 0.31, p75: 0.5, campaign_count: 12, advertiser_count: 6 };

describe('compareToBenchmark', () => {
  it('reports a value above the median', () => {
    const r = compareToBenchmark(0.42, stats);
    expect(r.available).toBe(true);
    expect(r.position).toBe('above_median');
    expect(r.median).toBe(0.31);
  });

  it('reports a value below the median', () => {
    expect(compareToBenchmark(0.25, stats).position).toBe('below_median');
  });

  it('reports top quartile', () => {
    expect(compareToBenchmark(0.6, stats).position).toBe('top_quartile');
  });

  it('reports bottom quartile', () => {
    expect(compareToBenchmark(0.1, stats).position).toBe('bottom_quartile');
  });

  it('treats a value exactly at the median as at_median', () => {
    expect(compareToBenchmark(0.31, stats).position).toBe('at_median');
  });

  it('computes the percent difference from the median', () => {
    // 0.42 vs 0.31 median -> +35%
    expect(compareToBenchmark(0.42, stats).pctVsMedian).toBe(35);
  });

  it('reports unavailable when there is no stats row', () => {
    const r = compareToBenchmark(0.42, null);
    expect(r.available).toBe(false);
    expect(r.reason).toBe('no_data');
  });

  it('reports unavailable below the campaign floor', () => {
    const r = compareToBenchmark(0.42, { ...stats, campaign_count: MIN_CAMPAIGNS - 1 });
    expect(r.available).toBe(false);
    expect(r.reason).toBe('insufficient_sample');
  });

  it('reports unavailable below the advertiser floor, even with many campaigns', () => {
    // One advertiser running 50 campaigns is not a benchmark — publishing it
    // would expose that single advertiser's performance.
    const r = compareToBenchmark(0.42, { ...stats, campaign_count: 50, advertiser_count: MIN_ADVERTISERS - 1 });
    expect(r.available).toBe(false);
    expect(r.reason).toBe('insufficient_sample');
  });

  it('reports unavailable for a non-numeric value', () => {
    expect(compareToBenchmark(null, stats).reason).toBe('no_value');
    expect(compareToBenchmark(NaN, stats).reason).toBe('no_value');
  });

  it('does not divide by a zero median', () => {
    const r = compareToBenchmark(0.4, { ...stats, p50: 0 });
    expect(r.pctVsMedian).toBeNull();
  });

  it('enforces a k-anonymity floor of at least 5 campaigns and 3 advertisers', () => {
    expect(MIN_CAMPAIGNS).toBeGreaterThanOrEqual(5);
    expect(MIN_ADVERTISERS).toBeGreaterThanOrEqual(3);
  });
});
