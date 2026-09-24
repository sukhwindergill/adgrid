import { describe, it, expect } from 'vitest';
import { computeRevenueSplit, DEFAULT_OWNER_REVENUE_SHARE } from './revenueSplit.js';
import { DEFAULT_OWNER_REVENUE_SHARE as SERVER_DEFAULT } from '../../supabase/functions/_shared/payoutSharing.ts';

describe('computeRevenueSplit', () => {
  it('pays the owner 70% of gross and the platform 30% at the default share', () => {
    const { platform, owner } = computeRevenueSplit(10000, undefined);
    expect(owner).toBe(7000);
    expect(platform).toBe(3000);
  });

  it('falls back to the default share when null or missing (matches trigger-payout)', () => {
    expect(computeRevenueSplit(10000, null)).toEqual(computeRevenueSplit(10000, undefined));
    expect(DEFAULT_OWNER_REVENUE_SHARE).toBe(0.70);
  });

  it('matches the default the Stripe payout functions use', () => {
    expect(DEFAULT_OWNER_REVENUE_SHARE).toBe(SERVER_DEFAULT);
  });

  it('honors a custom per-operator revenue share instead of the default', () => {
    const { owner, platform } = computeRevenueSplit(10000, 0.80);
    expect(owner).toBe(8000);
    expect(platform).toBe(2000);
  });

  it('is not fooled by a falsy-but-valid 0% share', () => {
    const { owner, platform } = computeRevenueSplit(10000, 0);
    expect(owner).toBe(0);
    expect(platform).toBe(10000);
  });

  it('platform + owner always reconstructs the total', () => {
    for (const total of [0, 1, 999, 10000, 123456]) {
      for (const share of [0, 0.25, DEFAULT_OWNER_REVENUE_SHARE, 0.8, 1]) {
        const { platform, owner } = computeRevenueSplit(total, share);
        expect(platform + owner).toBe(total);
      }
    }
  });

  it('treats non-finite totals as zero rather than throwing', () => {
    expect(computeRevenueSplit(NaN, 0.7)).toEqual({ platform: 0, owner: 0 });
    expect(computeRevenueSplit(undefined, 0.7)).toEqual({ platform: 0, owner: 0 });
  });
});
