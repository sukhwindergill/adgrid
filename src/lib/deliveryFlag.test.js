import { describe, it, expect } from 'vitest';
import { campaignDeliveryFlag } from './deliveryFlag.js';

describe('campaignDeliveryFlag', () => {
  it('returns null when there is no health row yet', () => {
    expect(campaignDeliveryFlag(null)).toBeNull();
  });

  it('returns null when delivery is healthy', () => {
    expect(campaignDeliveryFlag({ offline_days: 0, delivery_pct: 98 })).toBeNull();
  });

  it('flags a campaign whose screen went offline during its flight', () => {
    const flag = campaignDeliveryFlag({ offline_days: 2, delivery_pct: 90 });
    expect(flag.severity).toBe('warning');
    expect(flag.label).toBe('Screen offline 2 days during flight');
  });

  it('uses singular phrasing for exactly one offline day', () => {
    expect(campaignDeliveryFlag({ offline_days: 1, delivery_pct: 100 }).label).toBe('Screen offline 1 day during flight');
  });

  it('flags low delivery percentage even with zero recorded offline days', () => {
    const flag = campaignDeliveryFlag({ offline_days: 0, delivery_pct: 62.4 });
    expect(flag.label).toBe('Delivery at 62% of scheduled plays');
  });

  it('does not flag a percentage right at the threshold', () => {
    expect(campaignDeliveryFlag({ offline_days: 0, delivery_pct: 85 })).toBeNull();
  });

  it('does not flag when delivery_pct is not yet known (no closed days)', () => {
    expect(campaignDeliveryFlag({ offline_days: 0, delivery_pct: null })).toBeNull();
  });

  it('prefers the offline-days message when both conditions are true', () => {
    const flag = campaignDeliveryFlag({ offline_days: 3, delivery_pct: 40 });
    expect(flag.label).toMatch(/Screen offline/);
  });
});
