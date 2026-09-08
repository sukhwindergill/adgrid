import { describe, it, expect } from 'vitest';
import { mockAdapterV1, fetchFillFromAdapter } from './programmaticAdapters.ts';

const inventory = {
  venue_category: 'retail', city: 'Toronto', country: 'CA',
  resolution_w: 1920, resolution_h: 1080, accepted_formats: ['jpg', 'mp4'], cpm_floor: 4.5,
};

describe('mockAdapterV1', () => {
  it('offers a fill at exactly the screen cpm_floor', () => {
    const fill = mockAdapterV1(inventory);
    expect(fill.cpm).toBe(4.5);
    expect(fill.media_url).toBeTruthy();
    expect(fill.duration).toBeGreaterThan(0);
  });

  it('falls back to a default CPM when the screen has no floor set', () => {
    const fill = mockAdapterV1({ ...inventory, cpm_floor: null });
    expect(fill.cpm).toBeGreaterThan(0);
  });
});

describe('fetchFillFromAdapter', () => {
  it('dispatches to the mock adapter for adapter_key "mock_v1"', () => {
    expect(fetchFillFromAdapter('mock_v1', inventory)).not.toBeNull();
  });

  it('returns null for an unrecognized adapter_key rather than throwing', () => {
    expect(fetchFillFromAdapter('some_future_partner', inventory)).toBeNull();
  });
});
