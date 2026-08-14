import { describe, it, expect } from 'vitest';
import { compareDeliveryCheck, VERDICT } from './deliveryCheck.js';

describe('compareDeliveryCheck', () => {
  it('reports on-target when exposed rate is within 20% of control rate', () => {
    const r = compareDeliveryCheck({ exposed_rate: 9.5, control_rate: 10 });
    expect(r.available).toBe(true);
    expect(r.verdict).toBe(VERDICT.ON_TARGET);
    expect(r.ratio).toBeCloseTo(0.95, 5);
  });

  it('reports underperformed when exposed rate is well below control rate', () => {
    const r = compareDeliveryCheck({ exposed_rate: 5, control_rate: 10 });
    expect(r.available).toBe(true);
    expect(r.verdict).toBe(VERDICT.UNDERPERFORMED);
    expect(r.ratio).toBeCloseTo(0.5, 5);
  });

  it('reports exceeded when exposed rate is well above control rate', () => {
    const r = compareDeliveryCheck({ exposed_rate: 15, control_rate: 10 });
    expect(r.available).toBe(true);
    expect(r.verdict).toBe(VERDICT.EXCEEDED);
    expect(r.ratio).toBeCloseTo(1.5, 5);
  });

  it('treats exactly +/-20% as the boundary of on-target', () => {
    expect(compareDeliveryCheck({ exposed_rate: 8, control_rate: 10 }).verdict).toBe(VERDICT.ON_TARGET);
    expect(compareDeliveryCheck({ exposed_rate: 7.99, control_rate: 10 }).verdict).toBe(VERDICT.UNDERPERFORMED);
    expect(compareDeliveryCheck({ exposed_rate: 12, control_rate: 10 }).verdict).toBe(VERDICT.ON_TARGET);
    expect(compareDeliveryCheck({ exposed_rate: 12.01, control_rate: 10 }).verdict).toBe(VERDICT.EXCEEDED);
  });

  it('reports unavailable when there is no row at all', () => {
    const r = compareDeliveryCheck(null);
    expect(r.available).toBe(false);
    expect(r.reason).toBe('no_data');
  });

  it('reports unavailable when exposed_rate is missing', () => {
    const r = compareDeliveryCheck({ exposed_rate: null, control_rate: 10 });
    expect(r.available).toBe(false);
    expect(r.reason).toBe('no_data');
  });

  it('reports unavailable when control_rate is missing', () => {
    const r = compareDeliveryCheck({ exposed_rate: 10, control_rate: null });
    expect(r.available).toBe(false);
    expect(r.reason).toBe('no_data');
  });

  it('does not divide by a zero control rate', () => {
    const r = compareDeliveryCheck({ exposed_rate: 10, control_rate: 0 });
    expect(r.available).toBe(false);
    expect(r.reason).toBe('no_data');
  });
});
