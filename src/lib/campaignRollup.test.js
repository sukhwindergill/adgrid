import { describe, it, expect } from 'vitest';
import { groupByCampaignId, rollupGroup } from './campaignRollup.js';

describe('groupByCampaignId', () => {
  it('groups bookings sharing the same campaign_id together', () => {
    const bookings = [
      { id: 'b1', campaign_id: 'c1' },
      { id: 'b2', campaign_id: 'c1' },
      { id: 'b3', campaign_id: 'c2' },
    ];
    const groups = groupByCampaignId(bookings);
    expect(groups.get('c1')).toHaveLength(2);
    expect(groups.get('c2')).toHaveLength(1);
    expect(groups.size).toBe(2);
  });

  it('falls back to the booking\'s own id as its group key when campaign_id is missing', () => {
    const bookings = [{ id: 'b1', campaign_id: null }];
    const groups = groupByCampaignId(bookings);
    expect(groups.get('b1')).toEqual(bookings);
  });

  it('returns an empty map for an empty list', () => {
    expect(groupByCampaignId([]).size).toBe(0);
  });
});

describe('rollupGroup', () => {
  it('sums budget, spent, impressions, and scans across the group', () => {
    const group = [
      { budget: 100, spent: 40, impressions: 1000, scans: 5 },
      { budget: 50, spent: 10, impressions: 500, scans: 2 },
    ];
    expect(rollupGroup(group)).toEqual({ budget: 150, spent: 50, impressions: 1500, scans: 7 });
  });

  it('treats missing numeric fields as zero rather than NaN', () => {
    const group = [{ budget: 100 }, { spent: 5 }];
    expect(rollupGroup(group)).toEqual({ budget: 100, spent: 5, impressions: 0, scans: 0 });
  });

  it('returns all zeros for an empty group', () => {
    expect(rollupGroup([])).toEqual({ budget: 0, spent: 0, impressions: 0, scans: 0 });
  });
});
