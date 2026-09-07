import { describe, it, expect } from 'vitest';
import { perScreenBreakdown } from './screenComparison.js';

const rows = [
  { campaign_id: 'c1', screen_id: 's1', day: '2026-09-01', impressions: 100, billable_scans: 2 },
  { campaign_id: 'c1', screen_id: 's1', day: '2026-09-02', impressions: 50, billable_scans: 1 },
  { campaign_id: 'c1', screen_id: 's2', day: '2026-09-01', impressions: 300, billable_scans: 5 },
  { campaign_id: 'c2', screen_id: 's1', day: '2026-09-01', impressions: 999, billable_scans: 9 },
];

describe('perScreenBreakdown', () => {
  it('sums impressions and scans per screen for the given campaign only', () => {
    const result = perScreenBreakdown(rows, 'c1', { s1: 'Yonge & Dundas', s2: 'King & Bay' });
    expect(result).toEqual([
      { screen_id: 's2', impressions: 300, scans: 5, screen_name: 'King & Bay' },
      { screen_id: 's1', impressions: 150, scans: 3, screen_name: 'Yonge & Dundas' },
    ]);
  });

  it('sorts by impressions descending', () => {
    const result = perScreenBreakdown(rows, 'c1', {});
    expect(result.map(r => r.screen_id)).toEqual(['s2', 's1']);
  });

  it('falls back to the screen id when no name is known', () => {
    const result = perScreenBreakdown(rows, 'c1', {});
    expect(result.find(r => r.screen_id === 's1').screen_name).toBe('s1');
  });

  it('returns an empty array for a campaign with no delivery rows', () => {
    expect(perScreenBreakdown(rows, 'nonexistent', {})).toEqual([]);
  });

  it('handles an empty delivery list', () => {
    expect(perScreenBreakdown([], 'c1', {})).toEqual([]);
  });
});
