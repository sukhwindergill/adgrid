import { describe, it, expect } from 'vitest';
import { topPerformingProfile } from './screenRecommendation.js';

const screensById = new Map([
  ['s1', { venue_category: 'transit', environment: 'outdoor' }],
  ['s2', { venue_category: 'transit', environment: 'outdoor' }],
  ['s3', { venue_category: 'cafe', environment: 'indoor' }],
  ['s4', { venue_category: 'gym', environment: 'indoor' }], // no delivery rows below
]);

describe('topPerformingProfile', () => {
  it('returns null with no delivery rows', () => {
    expect(topPerformingProfile([], screensById)).toBeNull();
  });

  it('returns null when every profile is under the sample-size floor', () => {
    const rows = [{ screen_id: 's1', impressions: 100, billable_scans: 50 }];
    expect(topPerformingProfile(rows, screensById, 500)).toBeNull();
  });

  it('picks the profile with the higher scan rate once both clear the floor', () => {
    const rows = [
      { screen_id: 's1', impressions: 1000, billable_scans: 20 }, // transit/outdoor: 2%
      { screen_id: 's3', impressions: 1000, billable_scans: 50 }, // cafe/indoor: 5%
    ];
    const result = topPerformingProfile(rows, screensById, 500);
    expect(result).toEqual({ venue_category: 'cafe', environment: 'indoor', scan_rate: 0.05 });
  });

  it('aggregates multiple screens sharing the same profile', () => {
    const rows = [
      { screen_id: 's1', impressions: 600, billable_scans: 12 },
      { screen_id: 's2', impressions: 600, billable_scans: 12 },
    ];
    const result = topPerformingProfile(rows, screensById, 500);
    expect(result.venue_category).toBe('transit');
    expect(result.scan_rate).toBeCloseTo(24 / 1200, 6);
  });

  it('breaks a rate tie in favor of the larger sample', () => {
    const rows = [
      { screen_id: 's1', impressions: 500, billable_scans: 25 }, // 5%, smaller sample
      { screen_id: 's3', impressions: 2000, billable_scans: 100 }, // 5%, larger sample
    ];
    const result = topPerformingProfile(rows, screensById, 500);
    expect(result.venue_category).toBe('cafe');
  });

  it('ignores delivery rows for screens missing venue/environment data', () => {
    const rows = [{ screen_id: 'unknown-screen', impressions: 5000, billable_scans: 500 }];
    expect(topPerformingProfile(rows, screensById, 500)).toBeNull();
  });
});
