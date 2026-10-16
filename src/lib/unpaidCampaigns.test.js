import { describe, it, expect } from 'vitest';
import { isAwaitingPayment, awaitingPayment } from './unpaidCampaigns.js';

describe('isAwaitingPayment', () => {
  it('flags unpaid campaigns that can still run', () => {
    expect(isAwaitingPayment({ payment_status: 'unpaid', status: 'pending' })).toBe(true);
    expect(isAwaitingPayment({ payment_status: 'unpaid', status: 'approved' })).toBe(true);
  });

  it('ignores paid and closed campaigns', () => {
    expect(isAwaitingPayment({ payment_status: 'paid', status: 'pending' })).toBe(false);
    expect(isAwaitingPayment({ payment_status: 'unpaid', status: 'cancelled' })).toBe(false);
    expect(isAwaitingPayment({ payment_status: 'unpaid', status: 'rejected' })).toBe(false);
    expect(isAwaitingPayment(null)).toBe(false);
  });

  it('filters a list', () => {
    const list = [{ id: 1, payment_status: 'unpaid', status: 'pending' }, { id: 2, payment_status: 'paid', status: 'active' }];
    expect(awaitingPayment(list).map(c => c.id)).toEqual([1]);
  });
});
