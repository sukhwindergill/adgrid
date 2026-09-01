import { describe, it, expect } from 'vitest';
import { computeRevenueSplit, PLATFORM_FEE_RATE, DEFAULT_OWNER_REVENUE_SHARE } from './revenueSplit.js';

describe('computeRevenueSplit', () => {
  it('splits 12% platform / 40% owner / 48% pool at the default share', () => {
    const { platform, owner, pool } = computeRevenueSplit(10000, undefined);
    expect(platform).toBe(1200);
    expect(owner).toBe(3520); // 10000 * 0.88 * 0.40
    expect(pool).toBe(5280);
    expect(platform + owner + pool).toBe(10000);
  });

  it('falls back to the default share when null or missing (matches trigger-payout ?? 0.40)', () => {
    expect(computeRevenueSplit(10000, null)).toEqual(computeRevenueSplit(10000, undefined));
    expect(DEFAULT_OWNER_REVENUE_SHARE).toBe(0.40);
  });

  it('honors a custom per-operator revenue share instead of the hardcoded default', () => {
    const { owner } = computeRevenueSplit(10000, 0.70);
    expect(owner).toBe(6160); // 10000 * 0.88 * 0.70
  });

  it('is not fooled by a falsy-but-valid 0% share', () => {
    const { owner, pool } = computeRevenueSplit(10000, 0);
    expect(owner).toBe(0);
    expect(pool).toBe(8800);
  });

  it('platform + owner + pool always reconstructs the total', () => {
    for (const total of [0, 1, 999, 10000, 123456]) {
      for (const share of [0, 0.25, DEFAULT_OWNER_REVENUE_SHARE, 0.7, 1]) {
        const { platform, owner, pool } = computeRevenueSplit(total, share);
        expect(platform + owner + pool).toBe(total);
      }
    }
  });

  it('treats non-finite totals as zero rather than throwing', () => {
    expect(computeRevenueSplit(NaN, 0.4)).toEqual({ platform: 0, owner: 0, pool: 0 });
    expect(computeRevenueSplit(undefined, 0.4)).toEqual({ platform: 0, owner: 0, pool: 0 });
  });
});

describe('PLATFORM_FEE_RATE', () => {
  it('is 12%, matching supabase/functions/trigger-payout/index.ts', () => {
    expect(PLATFORM_FEE_RATE).toBe(0.12);
  });
});
