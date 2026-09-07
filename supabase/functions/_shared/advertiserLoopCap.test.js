import { describe, it, expect } from 'vitest';
import { capAdvertiserLoopShare, DEFAULT_LOOP_SHARE_CAP_PCT } from './advertiserLoopCap.ts';

describe('capAdvertiserLoopShare', () => {
  it('returns everything unfiltered when only one advertiser is in the loop', () => {
    const paid = [
      { id: 'p1', advertiser_id: 'adv-a', duration: 30 },
      { id: 'p2', advertiser_id: 'adv-a', duration: 30 },
      { id: 'p3', advertiser_id: 'adv-a', duration: 30 },
    ];
    // Nobody else to protect variety for -- capping here would just blank the screen.
    expect(capAdvertiserLoopShare(paid, 40)).toEqual(paid);
  });

  it('keeps every entry when each advertiser is already under the cap', () => {
    const paid = [
      { id: 'p1', advertiser_id: 'adv-a', duration: 10 },
      { id: 'p2', advertiser_id: 'adv-b', duration: 10 },
      { id: 'p3', advertiser_id: 'adv-c', duration: 10 },
    ];
    expect(capAdvertiserLoopShare(paid, 40)).toEqual(paid);
  });

  it('trims a dominant advertiser once their combined duration would exceed their share, keeping earlier entries first', () => {
    const paid = [
      { id: 'p1', advertiser_id: 'adv-a', duration: 20 },
      { id: 'p2', advertiser_id: 'adv-a', duration: 20 },
      { id: 'p3', advertiser_id: 'adv-a', duration: 20 },
      { id: 'p4', advertiser_id: 'adv-b', duration: 20 },
    ];
    // total = 80; 40% cap = 32s allowed for adv-a -- p1+p2 (40s) already over,
    // so only p1 fits; adv-b is untouched.
    expect(capAdvertiserLoopShare(paid, 40)).toEqual([
      { id: 'p1', advertiser_id: 'adv-a', duration: 20 },
      { id: 'p4', advertiser_id: 'adv-b', duration: 20 },
    ]);
  });

  it('never drops another advertiser\'s slots to make room for a capped one', () => {
    const paid = [
      { id: 'p1', advertiser_id: 'adv-a', duration: 50 },
      { id: 'p2', advertiser_id: 'adv-b', duration: 10 },
      { id: 'p3', advertiser_id: 'adv-a', duration: 50 },
    ];
    const result = capAdvertiserLoopShare(paid, 40);
    expect(result.some((r) => r.id === 'p2')).toBe(true);
  });

  it('treats a 100% cap as unlimited', () => {
    const paid = [
      { id: 'p1', advertiser_id: 'adv-a', duration: 1000 },
      { id: 'p2', advertiser_id: 'adv-b', duration: 1 },
    ];
    expect(capAdvertiserLoopShare(paid, 100)).toEqual(paid);
  });

  it('handles an empty loop', () => {
    expect(capAdvertiserLoopShare([], 40)).toEqual([]);
  });

  it('defaults to the platform-wide 40% share when no cap is given', () => {
    expect(DEFAULT_LOOP_SHARE_CAP_PCT).toBe(40);
    const paid = [
      { id: 'p1', advertiser_id: 'adv-a', duration: 25 },
      { id: 'p2', advertiser_id: 'adv-a', duration: 25 },
      { id: 'p3', advertiser_id: 'adv-b', duration: 25 },
      { id: 'p4', advertiser_id: 'adv-b', duration: 25 },
    ];
    // total = 100; 40% = 40s -- only the first of each advertiser's two 25s spots fits.
    expect(capAdvertiserLoopShare(paid).map((r) => r.id)).toEqual(['p1', 'p3']);
  });
});
